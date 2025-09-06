const express = require('express');
const axios = require('axios');
const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';

// Initialize conversation context for travel planning
const conversationContext = new Map();

// Helper function to create Gemini API request
const createGeminiRequest = (prompt, context = '') => {
  const fullPrompt = context ? `${context}\n\nUser: ${prompt}` : prompt;
  
  return {
    contents: [{
      parts: [{
        text: fullPrompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  };
};

// Main chat endpoint
router.post('/', async (req, res) => {
  try {
    const { message, userId, context = 'travel' } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    // Get or create conversation context for the user
    if (!conversationContext.has(userId)) {
      conversationContext.set(userId, {
        messages: [],
        tripContext: null,
        lastActivity: Date.now()
      });
    }

    const userContext = conversationContext.get(userId);
    userContext.lastActivity = Date.now();

    // Create system prompt based on context
    let systemPrompt = '';
    if (context === 'travel') {
      systemPrompt = `You are TripTrackr, an intelligent travel planning assistant. You help users plan trips, suggest activities, provide weather-based recommendations, and offer travel tips. 

Key capabilities:
- Suggest activities based on weather conditions
- Recommend packing items for different climates
- Provide travel tips for specific destinations
- Help with itinerary planning and optimization
- Offer alternative plans when weather changes occur
- Suggest indoor/outdoor activities based on conditions
- Provide cultural and practical travel advice

Always be helpful, friendly, and provide practical, actionable advice. Keep responses concise but informative.`;
    }

    // Add conversation history to context
    const conversationHistory = userContext.messages
      .slice(-5) // Keep last 5 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Create the full prompt
    const fullPrompt = `${systemPrompt}

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n\n` : ''}User: ${message}

Please provide a helpful response as TripTrackr:`;

    // Call Gemini API
    const response = await axios.post(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, 
      createGeminiRequest(fullPrompt),
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Invalid response from Gemini API');
    }

    const aiResponse = response.data.candidates[0].content.parts[0].text;

    // Store conversation
    userContext.messages.push(
      { role: 'user', content: message, timestamp: Date.now() },
      { role: 'assistant', content: aiResponse, timestamp: Date.now() }
    );

    // Keep only last 20 messages to prevent memory issues
    if (userContext.messages.length > 20) {
      userContext.messages = userContext.messages.slice(-20);
    }

    res.json({
      response: aiResponse,
      conversationId: userId,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Chat API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

// Get travel recommendations based on destination and weather
router.post('/recommendations', async (req, res) => {
  try {
    const { destination, weather, tripDuration, interests, budget } = req.body;

    if (!destination) {
      return res.status(400).json({ error: 'Destination is required' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const prompt = `As TripTrackr, provide detailed travel recommendations for ${destination}.

${weather ? `Weather conditions: ${weather}` : ''}
${tripDuration ? `Trip duration: ${tripDuration}` : ''}
${interests ? `Interests: ${interests.join(', ')}` : ''}
${budget ? `Budget: ${budget}` : ''}

Please provide:
1. Top attractions and activities
2. Weather-appropriate clothing and gear recommendations
3. Best times to visit attractions
4. Local cuisine recommendations
5. Transportation tips
6. Budget-friendly options
7. Cultural considerations
8. Safety tips

Format your response in a clear, structured way.`;

    const response = await axios.post(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, 
      createGeminiRequest(prompt),
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Invalid response from Gemini API');
    }

    const recommendations = response.data.candidates[0].content.parts[0].text;

    res.json({
      destination,
      recommendations,
      generated_at: Date.now()
    });

  } catch (error) {
    console.error('Recommendations API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to generate recommendations',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

// Get weather-based activity suggestions
router.post('/weather-activities', async (req, res) => {
  try {
    const { destination, weather, temperature, precipitation, windSpeed } = req.body;

    if (!destination || !weather) {
      return res.status(400).json({ error: 'Destination and weather are required' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const prompt = `As TripTrackr, suggest activities for ${destination} based on these weather conditions:

Weather: ${weather}
Temperature: ${temperature}°C
Precipitation: ${precipitation}%
Wind Speed: ${windSpeed} km/h

Please provide:
1. Indoor activities (if weather is poor)
2. Outdoor activities (if weather is good)
3. Alternative plans for different weather scenarios
4. Packing recommendations
5. Timing suggestions for activities
6. Safety considerations

Format your response clearly and provide practical, actionable advice.`;

    const response = await axios.post(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, 
      createGeminiRequest(prompt),
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Invalid response from Gemini API');
    }

    const suggestions = response.data.candidates[0].content.parts[0].text;

    res.json({
      destination,
      weather,
      suggestions,
      generated_at: Date.now()
    });

  } catch (error) {
    console.error('Weather activities API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to generate weather-based suggestions',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

// Get conversation history for a user
router.get('/history/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const userContext = conversationContext.get(userId);

    if (!userContext) {
      return res.json({ messages: [], conversationId: userId });
    }

    res.json({
      messages: userContext.messages,
      conversationId: userId,
      lastActivity: userContext.lastActivity
    });

  } catch (error) {
    console.error('History API error:', error.message);
    res.status(500).json({ 
      error: 'Failed to retrieve conversation history',
      message: error.message
    });
  }
});

// Clear conversation history for a user
router.delete('/history/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    if (conversationContext.has(userId)) {
      conversationContext.delete(userId);
    }

    res.json({ 
      message: 'Conversation history cleared',
      conversationId: userId
    });

  } catch (error) {
    console.error('Clear history API error:', error.message);
    res.status(500).json({ 
      error: 'Failed to clear conversation history',
      message: error.message
    });
  }
});

// Cleanup old conversations (run periodically)
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [userId, context] of conversationContext.entries()) {
    if (now - context.lastActivity > oneHour) {
      conversationContext.delete(userId);
    }
  }
}, 30 * 60 * 1000); // Run every 30 minutes

module.exports = router;
