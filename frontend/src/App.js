import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './index.css';

function App() {
  const [apiKey, setApiKey] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [status, setStatus] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const showStatus = (message, type) => {
    setStatus({ message, type });
    setTimeout(() => setStatus(null), 5000);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showStatus('Please select a PDF file', 'error');
      return;
    }

    if (!apiKey.trim()) {
      showStatus('Please enter your OpenAI API key', 'error');
      return;
    }

    setIsUploading(true);
    setStatus({ message: 'Uploading and processing PDF...', type: 'info' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);

    try {
      const response = await axios.post('/api/upload-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { session_id, filename, chunks_count } = response.data;
      setSessionId(session_id);
      setSessionInfo({ filename, chunks_count });
      setMessages([{
        type: 'system',
        content: `PDF "${filename}" uploaded successfully! It has been split into ${chunks_count} chunks and indexed. You can now ask questions about the document.`
      }]);
      showStatus('PDF uploaded and indexed successfully!', 'success');
    } catch (error) {
      console.error('Upload error:', error);
      showStatus(
        error.response?.data?.detail || 'Failed to upload PDF. Please try again.',
        'error'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    handleFileUpload(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleChat = async () => {
    if (!inputMessage.trim() || !sessionId || !apiKey.trim()) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);
    setIsChatting(true);

    try {
      const response = await axios.post('/api/rag-chat', {
        user_message: userMessage,
        session_id: sessionId,
        api_key: apiKey,
        model: 'gpt-4o-mini'
      }, {
        responseType: 'stream'
      });

      setMessages(prev => [...prev, { type: 'assistant', content: '' }]);

      const reader = response.data.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        assistantMessage += chunk;
        
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = assistantMessage;
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        type: 'system',
        content: `Error: ${error.response?.data?.detail || 'Failed to get response. Please try again.'}`
      }]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleChat();
    }
  };

  const clearSession = () => {
    setSessionId(null);
    setSessionInfo(null);
    setMessages([]);
    showStatus('Session cleared', 'info');
  };

  return (
    <div className="container">
      <header className="header">
        <h1>📚 RAG PDF Chat</h1>
        <p>Upload a PDF document and chat with it using AI-powered retrieval-augmented generation</p>
      </header>

      {status && (
        <div className={`status ${status.type}`}>
          {status.message}
        </div>
      )}

      <div className="main-content">
        {/* Upload Section */}
        <div className="card">
          <h2>📄 Upload PDF</h2>
          
          <input
            type="password"
            className="api-key-input"
            placeholder="Enter your OpenAI API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />

          <div
            className={`upload-area ${dragOver ? 'dragover' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="upload-icon">📁</div>
            <div className="upload-text">
              {isUploading ? 'Processing PDF...' : 'Click to upload or drag & drop'}
            </div>
            <div className="upload-subtext">PDF files only</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="file-input"
              disabled={isUploading}
            />
          </div>

          <button
            className="upload-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <span className="loading"></span>
                Processing...
              </>
            ) : (
              'Choose PDF File'
            )}
          </button>
        </div>

        {/* Chat Section */}
        <div className="card">
          <h2>💬 Chat with PDF</h2>
          
          {sessionInfo && (
            <div className="session-info">
              <h3>📋 Current Session</h3>
              <p><strong>File:</strong> {sessionInfo.filename}</p>
              <p><strong>Chunks:</strong> {sessionInfo.chunks_count}</p>
              <button className="clear-button" onClick={clearSession}>
                Clear Session
              </button>
            </div>
          )}

          <div className="chat-container">
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="message system">
                  {sessionId 
                    ? 'Ask me anything about your uploaded PDF!' 
                    : 'Please upload a PDF first to start chatting.'
                  }
                </div>
              ) : (
                messages.map((message, index) => (
                  <div key={index} className={`message ${message.type}`}>
                    {message.content}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
              <input
                type="text"
                className="chat-input"
                placeholder={sessionId ? "Ask a question about the PDF..." : "Upload a PDF first..."}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!sessionId || isChatting}
              />
              <button
                className="send-button"
                onClick={handleChat}
                disabled={!sessionId || !inputMessage.trim() || isChatting}
              >
                {isChatting ? (
                  <>
                    <span className="loading"></span>
                    Sending...
                  </>
                ) : (
                  'Send'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
