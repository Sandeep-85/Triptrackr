import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, Trash2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId] = useState(() => {
    try {
      const stored = localStorage.getItem('triptrackr_user_id');
      if (stored) return stored;
      const id = `user_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      localStorage.setItem('triptrackr_user_id', id);
      return id;
    } catch (_) {
      return `user_${Date.now()}`;
    }
  });
  const messagesEndRef = useRef(null);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [statusChecked, setStatusChecked] = useState(false);
  const [apiKey, setApiKey] = useState('');

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

  // Load any locally saved key (dev convenience)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('triptrackr_gemini_key') || '';
      if (saved) setApiKey(saved);
    } catch (_) {}
  }, []);

  // Check backend AI configuration once
  useEffect(() => {
    (async () => {
      try {
        const resp = await axios.get('/api/chat/status', {
          headers: apiKey ? { 'x-gemini-key': apiKey } : {}
        });
        const ok = Boolean(resp?.data?.configured);
        setAiConfigured(ok);
        setStatusChecked(true);
        if (!ok) {
          toast('AI running in fallback mode (no API key configured)', { icon: '⚠️' });
        }
      } catch (_) {
        setStatusChecked(true);
      }
    })();
  }, [apiKey]);

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
      const response = await axios.post(
        '/api/chat',
        {
          message: inputMessage,
          userId: userId,
          context: 'travel'
        },
        {
          headers: (!aiConfigured && (apiKey || process.env.REACT_APP_GEMINI_KEY))
            ? { 'x-gemini-key': (apiKey || process.env.REACT_APP_GEMINI_KEY) }
            : {}
        }
      );

      const assistantMessage = {
        role: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const serverMsg = error?.response?.data?.message || error?.response?.data?.error || 'Failed to send message';
      toast.error(serverMsg);
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
    <div className="chatbot-page" style={{ minHeight: '100vh' }}>
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          AI Travel Assistant
        </h1>
        <p className="text-lg text-gray-600">
          Get personalized travel advice and weather-based recommendations
        </p>
      </div>

      <div className="card w-full">
        <div className="card-header flex justify-between items-center">
          <div>
            <h3 className="card-title">Chat with TripTrackr</h3>
            <p className="card-subtitle">
              {statusChecked && aiConfigured ? (
                'Powered by Gemini 2.5 Pro - Advanced AI Travel Assistant'
              ) : (
                <span>
                  Assistant ready • Fallback mode.
                  <button
                    type="button"
                    className="ml-2 underline text-blue-700"
                    onClick={() => {
                      const k = window.prompt('Paste your Gemini API Key (kept in this browser only):');
                      if (k && k.trim()) {
                        try { localStorage.setItem('triptrackr_gemini_key', k.trim()); } catch(_) {}
                        setApiKey(k.trim());
                        toast.success('API key saved for this browser');
                      }
                    }}
                  >Set API key</button>
                </span>
              )}
            </p>
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
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{String(message.content || '')}</ReactMarkdown>
                    </div>
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

          {/* Quick reply suggestions */}
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {['Plan a 3-day Goa itinerary', 'Budget for 2 in Manali, 4 days (INR)', 'Weather in Hyderabad this weekend', 'Best time to visit Jaipur?'].map((q) => (
              <button
                key={q}
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (!loading) {
                    setInputMessage(q);
                    // auto-send
                    setTimeout(() => {
                      const fakeEvent = { preventDefault: () => {} };
                      sendMessage(fakeEvent);
                    }, 0);
                  }
                }}
              >{q}</button>
            ))}
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
