const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Import routes
const weatherRoutes = require('./routes/weather');
const mapsRoutes = require('./routes/maps');
const chatRoutes = require('./routes/chat');
const itineraryRoutes = require('./routes/itineraries');

// Connect to MongoDB
const connectDB = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ MongoDB connected successfully');
    } else {
      console.log('⚠️  No MongoDB URI found, using in-memory storage');
    }
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('⚠️  Continuing with in-memory storage');
  }
};

connectDB();

// Security middleware
app.use(helmet());

// Rate limiting (enable in production only to avoid local proxy header issues)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use('/api/', limiter);
}

// CORS configuration
app.use(cors({
  origin: (origin, cb) => cb(null, true), // allow all for local dev
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (for production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// API Routes
app.use('/api/weather', weatherRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/itineraries', itineraryRoutes);

// API index - helpful landing when visiting /api directly
app.get('/api', (req, res) => {
  res.json({
    name: 'TripTrackr API',
    version: '1.0',
    status: 'OK',
    message: 'Welcome to TripTrackr. See available endpoints below.',
    endpoints: {
      health: '/api/health',
      weather: {
        current: '/api/weather/:city',
        forecast: '/api/weather/forecast/:city',
        alerts: '/api/weather/alerts/:city',
        tts: '/api/weather/tts'
      },
      maps: {
        config: '/api/maps/config',
        geocode: '/api/maps/geocode/:address',
        places: '/api/maps/places/:query',
        place_details: '/api/maps/place/:placeId',
        directions: '/api/maps/directions',
        accommodations: '/api/maps/accommodations',
        nearby: '/api/maps/nearby'
      },
      chat: {
        chat: '/api/chat',
        recommendations: '/api/chat/recommendations',
        weather_activities: '/api/chat/weather-activities',
        history: '/api/chat/history/:userId'
      },
      itineraries: '/api/itineraries'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'TripTrackr API is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Serve React app for production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TripTrackr server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 API available at: http://localhost:${PORT}/api`);
  console.log(`🗄️  Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'In-memory storage'}`);
});

module.exports = app;
