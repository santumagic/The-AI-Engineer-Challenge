# RAG PDF Chat Frontend

A modern React frontend for the RAG PDF Chat application that allows users to upload PDF documents and chat with them using AI-powered retrieval-augmented generation.

## Features

- 📄 **PDF Upload**: Drag & drop or click to upload PDF files
- 🔐 **API Key Management**: Secure OpenAI API key input
- 💬 **Real-time Chat**: Stream responses from the AI model
- 🎨 **Modern UI**: Beautiful, responsive design with gradient backgrounds
- 📱 **Mobile Friendly**: Works on desktop and mobile devices
- ⚡ **Fast Processing**: Efficient PDF processing and indexing

## Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- OpenAI API key

## Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

### Development Mode

1. Start the React development server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to `http://localhost:3000`

3. Make sure the backend API is running on `http://localhost:8000`

### Production Build

1. Create a production build:
   ```bash
   npm run build
   ```

2. The built files will be in the `build` directory

## Usage

1. **Enter API Key**: Input your OpenAI API key in the provided field
2. **Upload PDF**: Drag and drop a PDF file or click to select one
3. **Wait for Processing**: The PDF will be processed and indexed automatically
4. **Start Chatting**: Ask questions about the PDF content
5. **Clear Session**: Use the "Clear Session" button to start over

## API Integration

The frontend communicates with the backend API through the following endpoints:

- `POST /api/upload-pdf` - Upload and index PDF files
- `POST /api/rag-chat` - Send chat messages and receive AI responses
- `GET /api/session/{session_id}` - Get session information

## Technologies Used

- **React 18** - Frontend framework
- **Axios** - HTTP client for API calls
- **CSS3** - Modern styling with gradients and animations
- **HTML5** - Semantic markup

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

The application uses Create React App with the following scripts:

- `npm start` - Start development server
- `npm run build` - Create production build
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App (not recommended)

## Troubleshooting

### Common Issues

1. **API Connection Error**: Ensure the backend is running on port 8000
2. **CORS Issues**: The backend should have CORS enabled for localhost:3000
3. **PDF Upload Fails**: Check that the file is a valid PDF and under the size limit
4. **API Key Invalid**: Verify your OpenAI API key is correct and has sufficient credits

### Getting Help

If you encounter issues:

1. Check the browser console for error messages
2. Verify the backend API is running and accessible
3. Ensure your OpenAI API key is valid
4. Check the network tab for failed requests