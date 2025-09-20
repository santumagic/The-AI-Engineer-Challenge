# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
import tempfile
import uuid
from typing import Optional, Dict, List
from pathlib import Path

# Import aimakerspace library components for RAG
from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.chatmodel import ChatOpenAI
from aimakerspace.openai_utils.prompts import SystemRolePrompt, UserRolePrompt

# Initialize FastAPI application with a title
app = FastAPI(title="OpenAI Chat API")

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

# Define the data model for RAG chat requests
class RAGChatRequest(BaseModel):
    user_message: str      # Message from the user
    session_id: str        # Session ID to identify the PDF context
    api_key: str          # OpenAI API key for authentication
    model: Optional[str] = "gpt-4o-mini"  # Optional model selection with default

# Global storage for RAG sessions
# In production, this should be replaced with a proper database
rag_sessions: Dict[str, Dict] = {}

# RAG system prompt
RAG_SYSTEM_PROMPT = """You are a helpful assistant that answers questions based on the provided context from uploaded PDF documents. 
You should only answer questions using information from the provided context. If the context doesn't contain enough information to answer a question, 
you should say "I don't have enough information in the provided context to answer that question." 
Do not make up or hallucinate information that isn't in the context."""

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=request.api_key)
        
        # Create an async generator function for streaming responses
        async def generate():
            # Create a streaming chat completion request
            stream = client.chat.completions.create(
                model=request.model,
                messages=[
                    {"role": "developer", "content": request.developer_message},
                    {"role": "user", "content": request.user_message}
                ],
                stream=True  # Enable streaming response
            )
            
            # Yield each chunk of the response as it becomes available
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))

# Define PDF upload endpoint for RAG
@app.post("/api/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    api_key: str = Form(...)
):
    """Upload a PDF file and create a RAG session for it."""
    try:
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")
        
        # Generate a unique session ID
        session_id = str(uuid.uuid4())
        
        # Create temporary file to store the PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Load and process the PDF using aimakerspace library
            pdf_loader = PDFLoader(temp_file_path)
            pdf_loader.load_file()
            
            # Split the text into chunks
            text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            chunks = text_splitter.split_texts(pdf_loader.documents)
            
            # Create vector database and index the chunks
            vector_db = VectorDatabase()
            vector_db = await vector_db.abuild_from_list(chunks)
            
            # Store the session data
            rag_sessions[session_id] = {
                "vector_db": vector_db,
                "filename": file.filename,
                "chunks": chunks,
                "created_at": str(uuid.uuid4())  # Simple timestamp placeholder
            }
            
            return {
                "session_id": session_id,
                "filename": file.filename,
                "chunks_count": len(chunks),
                "message": "PDF uploaded and indexed successfully"
            }
            
        finally:
            # Clean up temporary file
            Path(temp_file_path).unlink(missing_ok=True)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

# Define RAG chat endpoint
@app.post("/api/rag-chat")
async def rag_chat(request: RAGChatRequest):
    """Chat with the uploaded PDF using RAG."""
    try:
        # Check if session exists
        if request.session_id not in rag_sessions:
            raise HTTPException(status_code=404, detail="Session not found. Please upload a PDF first.")
        
        session_data = rag_sessions[request.session_id]
        vector_db = session_data["vector_db"]
        
        # Search for relevant chunks
        relevant_chunks = vector_db.search_by_text(
            request.user_message, 
            k=3,  # Get top 3 most relevant chunks
            return_as_text=True
        )
        
        # Combine relevant chunks into context
        context = "\n\n".join(relevant_chunks)
        
        # Create the chat messages
        system_prompt = SystemRolePrompt(RAG_SYSTEM_PROMPT)
        user_prompt = UserRolePrompt("Context from PDF:\n{context}\n\nUser question: {question}")
        
        messages = [
            system_prompt.create_message(),
            user_prompt.create_message(context=context, question=request.user_message)
        ]
        
        # Initialize chat model
        chat_model = ChatOpenAI(model_name=request.model)
        
        # Create streaming response
        async def generate():
            async for chunk in chat_model.astream(messages):
                yield chunk
        
        return StreamingResponse(generate(), media_type="text/plain")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in RAG chat: {str(e)}")

# Define endpoint to get session info
@app.get("/api/session/{session_id}")
async def get_session_info(session_id: str):
    """Get information about a RAG session."""
    if session_id not in rag_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = rag_sessions[session_id]
    return {
        "session_id": session_id,
        "filename": session_data["filename"],
        "chunks_count": len(session_data["chunks"]),
        "created_at": session_data["created_at"]
    }

# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
