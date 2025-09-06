import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Bot, User, Trash2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId] = useState(`user_${Date.now()}`);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: 'Hello! I\'m TripTrackr, your AI travel planning assistant. How can I help you plan your trip?',
        timestamp: Date.now()
      }
    ]);
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await axios.post('/api/chat', {
        message: inputMessage,
        userId: userId,
        context: 'travel'
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast.error('Failed to send message');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Hello! I\'m TripTrackr, your AI travel planning assistant. How can I help you plan your trip?',
        timestamp: Date.now()
      }
    ]);
  };

  return (
    <div className="chatbot-page">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          AI Travel Assistant
        </h1>
        <p className="text-lg text-gray-600">
          Get personalized travel advice and weather-based recommendations
        </p>
      </div>

      <div className="card max-w-4xl mx-auto">
        <div className="card-header flex justify-between items-center">
          <div>
            <h3 className="card-title">Chat with TripTrackr</h3>
            <p className="card-subtitle">Powered by Gemini 2.5 Pro - Advanced AI Travel Assistant</p>
          </div>
          <button onClick={clearChat} className="btn btn-secondary btn-sm">
            <Trash2 size={16} />
            <span>Clear Chat</span>
          </button>
        </div>

        <div className="chat-container">
          <div className="chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`chat-message ${message.role}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className="flex-1">
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="chat-message assistant">
                <div className="flex items-center gap-2">
                  <div className="spinner w-4 h-4"></div>
                  <span>Thinking...</span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="chat-input-container">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask me about travel planning, weather, or destinations..."
              className="form-input chat-input"
              disabled={loading}
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Send size={18} />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
