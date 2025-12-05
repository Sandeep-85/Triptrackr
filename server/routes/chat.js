const express = require('express');
const axios = require('axios');
const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
// Prefer a widely available Gemini model; allow override via env
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
      // Slightly lower temperature improves determinism/accuracy for planning tasks
      temperature: 0.4,
      topK: 40,
      topP: 0.9,
      maxOutputTokens: 2048,
      responseMimeType: 'text/plain'
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

// Determine if a real Gemini key is configured (avoid placeholders)
function isValidGeminiKey(key) {
  if (!key) return false;
  const s = String(key).trim();
  if (!s || /your_.*_here/i.test(s)) return false; // from env.example
  if (/placeholder|changeme/i.test(s)) return false;
  // Most Gemini keys start with AIza; accept anything that looks similar
  return /^AIza[0-9A-Za-z_\-]{10,}$/.test(s) || s.length >= 25;
}

function getGeminiKey(req) {
  const headerKey = req?.headers?.['x-gemini-key'];
  if (isValidGeminiKey(GEMINI_API_KEY)) return GEMINI_API_KEY;
  if (isValidGeminiKey(headerKey)) return String(headerKey);
  return null;
}

// Lightweight rule-based fallback when Gemini is unavailable
function ruleBasedReply(userText = '') {
  const text = String(userText || '').toLowerCase();
  const tips = [];

  if (/budget|cost|price|expense/.test(text)) {
    return (
      'Here’s a quick budget planning guide:\n' +
      '- Budget: ₹1.5k–₹3k per person/day (local transport, hostels, simple meals)\n' +
      '- Mid‑range: ₹3k–₹6k per person/day (cabs/metros, 3★ hotels, restaurants)\n' +
      '- Luxury: ₹6k–₹12k+ per person/day (private transport, 4–5★, fine dining)\n' +
      'Tip: Book stays near transit hubs, eat where locals queue, and pre‑book popular sights to avoid surge pricing.'
    );
  }

  if (/weather|rain|temperature|forecast|hot|cold|wind/.test(text)) {
    return (
      'For weather‑aware planning: check the Weather page for current and 5‑day trends.\n' +
      'General rules: <10°C pack warm layers; >25°C carry sunscreen and hydrate; rain >70% pack a raincoat; strong winds avoid high viewpoints.'
    );
  }

  if (/hotel|stay|accommodation/.test(text)) {
    tips.push('Use the Maps page search for “hotels near <area>” and sort by rating and recent reviews.');
  }
  if (/itinerary|plan|things to do|what to do|activities/.test(text)) {
    tips.push('Balance days: 1) landmark highlights, 2) local neighborhoods/food walk, 3) nature or day‑trip. Keep 20% buffer time.');
  }
  if (/visa|entry|passport|document/.test(text)) {
    tips.push('Always verify visa/entry rules on the official government site for your nationality before booking.');
  }
  if (!tips.length) {
    tips.push('Tell me your destination, dates, budget style, and interests. I’ll suggest an itinerary, packing list, and must‑try food.');
  }
  return tips.join('\n');
}

// Main chat endpoint
router.post('/', async (req, res) => {
  try {
    const { message, userId, context = 'travel' } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = getGeminiKey(req);
    const aiEnabled = isValidGeminiKey(apiKey);

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
      systemPrompt = `You are TripTrackr, an intelligent travel planning assistant.

Goals:
- Provide accurate, up-to-date, practical travel guidance.
- Be concise but complete. Prefer bullet points and checklists.
- Ask 1-2 clarifying questions if the request is underspecified.

When responding:
- Format using Markdown. Use headings (##/###), bullet lists, and tables when helpful.
- Include concrete names, prices (when asked), time estimates, and links if available.
- For itineraries, structure by day with travel time hints and local tips.
- For weather-sensitive advice, note contingencies and indoor alternatives.
- For budget queries, break down by category and show per‑day and total when possible.
- End with a short Next steps section with suggested follow‑ups.

Keep tone friendly and professional.`;
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

    let aiResponse;
    if (!aiEnabled) {
      // Graceful fallback without external AI
      aiResponse = ruleBasedReply(message);
    } else {
      try {
        // Call Gemini API
        const response = await axios.post(`${GEMINI_BASE_URL}?key=${apiKey}`, 
          createGeminiRequest(fullPrompt),
          { headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.data.candidates || !response.data.candidates[0]) {
          throw new Error('Invalid response from Gemini API');
        }

        aiResponse = response.data.candidates[0].content.parts[0].text;
      } catch (gemErr) {
        // Fallback on auth/network/model errors instead of 500
        console.warn('Gemini error, using fallback:', gemErr.response?.data || gemErr.message);
        aiResponse = ruleBasedReply(message);
      }
    }

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
    const apiKey = getGeminiKey(req);
    const { destination, weather, tripDuration, interests, budget } = req.body;

    if (!destination) {
      return res.status(400).json({ error: 'Destination is required' });
    }

    if (!apiKey) {
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

    const response = await axios.post(`${GEMINI_BASE_URL}?key=${apiKey}`, 
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
    const apiKey = getGeminiKey(req);
    const { destination, weather, temperature, precipitation, windSpeed } = req.body;

    if (!destination || !weather) {
      return res.status(400).json({ error: 'Destination and weather are required' });
    }

    if (!apiKey) {
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

    const response = await axios.post(`${GEMINI_BASE_URL}?key=${apiKey}`, 
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

// Lightweight status endpoint so the client can detect configuration
router.get('/status', (req, res) => {
  res.json({
    configured: Boolean(getGeminiKey(req)),
    model: GEMINI_MODEL,
    message: getGeminiKey(req) ? 'OK' : 'Gemini API key not configured (you can send x-gemini-key header in development)'
  });
});

// --- Budget estimation using Gemini ---
// Input: destination, days, travelers, style, currency
// Output: structured JSON with categories and totals
router.post('/budget-estimate', async (req, res) => {
  try {
    const apiKey = getGeminiKey(req);
    const { destination, days = 3, travelers = 2, style = 'mid-range', currency = 'INR', season } = req.body || {};

    if (!destination) {
      return res.status(400).json({ error: 'Destination is required' });
    }
    // Destination-aware heuristic (used when AI unavailable or errors)
    const styleBase = (s) => {
      const norm = String(s || '').toLowerCase();
      if (norm.includes('lux')) return { transport: 1200, hotel: 6000, food: 2000, activities: 2000, other: 800 };
      if (norm.includes('budget')) return { transport: 400, hotel: 1500, food: 800, activities: 600, other: 300 };
      return { transport: 700, hotel: 3000, food: 1200, activities: 1000, other: 500 };
    };

    const cityFactor = (name = '') => {
      const n = String(name).toLowerCase();
      if (/mumbai|bombay/.test(n)) return 1.35;
      if (/goa/.test(n)) return 1.20;
      if (/delhi|new\s*delhi/.test(n)) return 1.05;
      if (/bengaluru|bangalore/.test(n)) return 1.15;
      if (/hyderabad/.test(n)) return 1.00;
      if (/chennai/.test(n)) return 1.05;
      if (/kolkata|calcutta/.test(n)) return 0.95;
      if (/jaipur/.test(n)) return 0.90;
      if (/manali|shimla|leh|ladakh/.test(n)) return 1.10;
      if (/agra|varanasi|mathura/.test(n)) return 0.95;
      if (/singapore/.test(n)) return 2.50;
      if (/dubai|uae/.test(n)) return 2.00;
      return 1.00;
    };

    const applyHeuristic = () => {
      const base = styleBase(style);
      const factor = cityFactor(destination);
      const seasonal = /peak|dec|jan|new\s*year/.test(String(season || '').toLowerCase()) ? 1.15
        : /monsoon|rain/.test(String(season || '').toLowerCase()) ? 0.95
        : 1.00;
      const pd = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.round(v * factor * seasonal)]));
      const safeDays = Math.max(1, Number(days) || 3);
      const safeTrav = Math.max(1, Number(travelers) || 2);
      const totalTrip = {
        transport: Math.round(pd.transport * safeDays * safeTrav),
        hotel: Math.round(pd.hotel * safeDays * safeTrav),
        food: Math.round(pd.food * safeDays * safeTrav),
        activities: Math.round(pd.activities * safeDays * safeTrav),
        other: Math.round(pd.other * safeDays * safeTrav)
      };
      const total = Object.values(totalTrip).reduce((a, b) => a + b, 0);
      return { per_day: pd, total_trip: { ...totalTrip, total } };
    };

    // If Gemini key is missing, return a destination-aware heuristic instead of 500
    if (!apiKey) {
      const h = applyHeuristic();
      return res.json({
        currency,
        per_day: h.per_day,
        total_trip: h.total_trip,
        assumptions: [
          'Destination-aware heuristic used because AI key is not configured',
          `Destination: ${destination}`,
          `Style: ${style}`,
          season ? `Season considered: ${season}` : 'Season not specified'
        ]
      });
    }

    const system = `You are TripTrackr's budget planner. Produce realistic, destination-aware trip cost estimates.
Return STRICT JSON ONLY (no prose, no code fences), matching this TypeScript type:
type Budget = {
  currency: string;
  per_day: { transport: number; hotel: number; food: number; activities: number; other: number; };
  total_trip: { transport: number; hotel: number; food: number; activities: number; other: number; total: number; };
  assumptions: string[];
};`;

    const userPrompt = `Destination: ${destination}
Days: ${days}
Travelers: ${travelers}
Style: ${style} (budget | mid-range | luxury)
Currency: ${currency}
${season ? `Season: ${season}` : ''}

Estimate realistic per-person PER-DAY costs (per_day) and total TRIP costs (total_trip) for ALL travelers.
Rules:\n- All numbers MUST be numeric (no strings), currency = ${currency}\n- per_day are per-person per-day averages\n- total_trip amounts MUST equal per_day * Days * Travelers (rounded to nearest integer)\n- Provide 3-8 short assumptions capturing major drivers (season, city price level, style)`;

    const payload = createGeminiRequest(`${system}\n\n${userPrompt}`);
    // Encourage deterministic, JSON-only output
    payload.generationConfig = { ...payload.generationConfig, temperature: 0.15, responseMimeType: 'application/json' };

    const response = await axios.post(`${GEMINI_BASE_URL}?key=${apiKey}`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    const text = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      // Try to extract JSON block if model wrapped it
      const match = text.match(/```json[\s\S]*?```|\{[\s\S]*\}/);
      if (match) {
        const cleaned = match[0]
          .replace(/^```json/i, '')
          .replace(/```$/i, '')
          .trim();
        try { parsed = JSON.parse(cleaned); } catch (_) { parsed = null; }
      }
    }

    // Retry once with stricter JSON-only instruction if parsing failed
    if (!parsed) {
      const strictPayload = createGeminiRequest(
        `${system}\n\n${userPrompt}\n\nReturn ONLY valid minified JSON. Do not include any prose or code fences.`,
      );
      strictPayload.generationConfig = { ...payload.generationConfig, temperature: 0.0, responseMimeType: 'application/json' };
      const resp2 = await axios.post(`${GEMINI_BASE_URL}?key=${apiKey}`, strictPayload, { headers: { 'Content-Type': 'application/json' } });
      const text2 = resp2?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      try {
        parsed = JSON.parse(text2);
      } catch (_) {
        const m2 = text2.match(/\{[\s\S]*\}/);
        if (m2) {
          try { parsed = JSON.parse(m2[0]); } catch (_) { parsed = null; }
        }
      }
    }

    if (!parsed) {
      // Fallback to destination-aware heuristic if model responded with non-JSON
      const h = applyHeuristic();
      return res.json({
        currency,
        per_day: h.per_day,
        total_trip: h.total_trip,
        assumptions: ['Heuristic fallback used due to unparseable AI response']
      });
    }

    // Basic validation and totals safeguard
    const pd = parsed.per_day || {};
    const perDay = {
      transport: Number(pd.transport) || 0,
      hotel: Number(pd.hotel) || 0,
      food: Number(pd.food) || 0,
      activities: Number(pd.activities) || 0,
      other: Number(pd.other) || 0
    };
    const d = Math.max(1, Number(days) || 1);
    const t = Math.max(1, Number(travelers) || 1);
    const totalTrip = {
      transport: Math.round(perDay.transport * d * t),
      hotel: Math.round(perDay.hotel * d * t),
      food: Math.round(perDay.food * d * t),
      activities: Math.round(perDay.activities * d * t),
      other: Math.round(perDay.other * d * t)
    };
    const total = Object.values(totalTrip).reduce((a, b) => a + b, 0);

    res.json({
      currency: parsed.currency || currency,
      per_day: perDay,
      total_trip: { ...totalTrip, total },
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.slice(0, 10) : []
    });
  } catch (error) {
    console.error('Budget estimate API error:', error.response?.data || error.message);
    // Graceful fallback when Gemini call fails (invalid key, quota, network)
    try {
      const { currency = 'INR' } = req.body || {};
      const h = applyHeuristic();
      return res.json({
        currency,
        per_day: h.per_day,
        total_trip: h.total_trip,
        assumptions: [ 'Destination-aware fallback estimate used due to AI error' ]
      });
    } catch (fallbackErr) {
      console.error('Heuristic fallback failed:', fallbackErr?.message);
      res.status(200).json({
        currency: (req.body && req.body.currency) || 'INR',
        per_day: { transport: 700, hotel: 3000, food: 1200, activities: 1000, other: 500 },
        total_trip: { transport: 0, hotel: 0, food: 0, activities: 0, other: 0, total: 0 },
        assumptions: [ 'Minimal fallback used due to unexpected error' ]
      });
    }
  }
});