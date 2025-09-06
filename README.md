# TripTrackr - AI-Powered Travel Planning Platform

TripTrackr is an intelligent travel planning system that combines AI-powered insights, weather intelligence, and interactive mapping to deliver the most comprehensive travel planning experience available.

## ✨ Features

### 🌟 Core Features
- **AI Travel Assistant**: Powered by Google Gemini 2.5 Pro for personalized travel advice
- **Weather-Integrated Planning**: Real-time weather forecasts with intelligent recommendations
- **Interactive Maps**: Google Maps integration for destinations, routes, and points of interest
- **Smart Itineraries**: Create detailed day-by-day schedules with weather-based adjustments
- **Cost Management**: Multi-currency budgeting (INR, USD, EUR, GBP, JPY, CAD, AUD) with expense tracking
- **Export & Share**: Export itineraries as PDF or iCal files

### 🚀 Advanced Features
- **Database Integration**: MongoDB support with fallback to in-memory storage
- **Real-time Updates**: Live weather data and AI recommendations
- **Responsive Design**: Modern UI with JavaScript animations and smooth interactions
- **Multi-language Support**: Internationalization ready
- **Security**: JWT authentication, rate limiting, and CORS protection

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **Google Gemini 2.5 Pro** API for AI assistance
- **OpenWeatherMap API** for weather data
- **Google Maps API** for mapping and geolocation
- **JWT** for authentication
- **Helmet** for security

### Frontend
- **React 18** with modern hooks
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Framer Motion** for animations
- **React Router** for navigation
- **Axios** for API communication

## 📋 Prerequisites

- Node.js 18+ and npm
- MongoDB (optional - falls back to in-memory storage)
- Google Gemini API key
- OpenWeatherMap API key
- Google Maps API key

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/triptrackr.git
cd triptrackr
```

### 2. Install Dependencies
```bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 3. Environment Configuration
Copy the environment file and configure your API keys:
```bash
cp env.example .env
```

Edit `.env` with your API keys:
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Google Maps API
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# OpenWeatherMap API
OPENWEATHER_API_KEY=your_openweather_api_key_here

# Google Gemini AI API
GEMINI_API_KEY=your_gemini_api_key_here

# Database Configuration (optional)
MONGODB_URI=mongodb://localhost:27017/triptrackr

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here
```

### 4. Get API Keys

#### Google Gemini API
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Enable Gemini 2.5 Pro model

#### OpenWeatherMap API
1. Visit [OpenWeatherMap](https://openweathermap.org/api)
2. Sign up for a free account
3. Get your API key (1000 calls/day free)

#### Google Maps API
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable these APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
   - Directions API
4. Create credentials (API key)

### 5. Start the Application
```bash
# Development mode (runs both server and client)
npm run dev

# Or run separately:
npm run server    # Backend on port 5000
npm run client    # Frontend on port 3000
```

## 🗄️ Database Setup

### MongoDB (Recommended)
```bash
# Install MongoDB locally or use MongoDB Atlas
# Update .env with your connection string
MONGODB_URI=mongodb://localhost:27017/triptrackr
```

### In-Memory Storage (Fallback)
If no MongoDB connection is available, the app automatically falls back to in-memory storage.

## 📱 Usage

### 1. Create a Trip
- Navigate to "Create Trip"
- Enter trip details, dates, and destinations
- Set budget in your preferred currency
- Add notes and special requirements

### 2. AI Travel Assistant
- Visit the Chatbot page
- Ask questions about destinations, weather, or travel tips
- Get personalized recommendations powered by Gemini 2.5 Pro

### 3. Weather Integration
- Check real-time weather for your destinations
- Get weather-based activity recommendations
- Plan activities according to forecast conditions

### 4. Interactive Maps
- View destinations on Google Maps
- Find nearby attractions and restaurants
- Get optimal routes between locations

### 5. Budget Management
- Track expenses in multiple currencies
- Monitor budget vs. actual spending
- Get cost estimates for activities

## 🔧 Development

### Project Structure
```
triptrackr/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   └── App.js         # Main app component
├── server/                 # Node.js backend
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   └── index.js           # Server entry point
├── .env                   # Environment variables
└── package.json           # Dependencies and scripts
```

### Available Scripts
```bash
npm run dev          # Start both server and client
npm run server       # Start backend server
npm run client       # Start frontend development server
npm run build        # Build production frontend
npm run start        # Start production server
npm run install-all  # Install all dependencies
```

### API Endpoints
- `GET /api/health` - Health check
- `POST /api/itineraries` - Create trip
- `GET /api/itineraries` - Get all trips
- `GET /api/itineraries/:id` - Get specific trip
- `PUT /api/itineraries/:id` - Update trip
- `DELETE /api/itineraries/:id` - Delete trip
- `POST /api/chat` - AI chat endpoint
- `GET /api/weather/:city` - Weather data
- `GET /api/maps/places/:query` - Places search

## 🚀 Deployment

### Frontend Build
```bash
cd client
npm run build
```

### Production Server
```bash
npm run start
```

### Environment Variables for Production
```env
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
MONGODB_URI=your_production_mongodb_uri
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Gemini AI for intelligent travel assistance
- OpenWeatherMap for weather data
- Google Maps for mapping services
- React and Node.js communities for excellent tooling

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the API endpoints

---

**Made with ❤️ by the TripTrackr Team**
