# TripTrackr Setup Guide 🚀

## Quick Start

Follow these steps to get TripTrackr running on your local machine:

### 1. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. Environment Configuration

1. Copy the environment template:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` and add your API keys:
   ```env
   PORT=5000
   NODE_ENV=development
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   OPENWEATHER_API_KEY=your_openweather_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

### 3. Get API Keys

#### Google Maps API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable these APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
   - Directions API
4. Create credentials (API Key)
5. Add the key to your `.env` file

#### OpenWeatherMap API
1. Go to [OpenWeatherMap](https://openweathermap.org/api)
2. Sign up for a free account
3. Get your API key (1000 calls/day free)
4. Add the key to your `.env` file

#### Gemini API
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add the key to your `.env` file

### 4. Start the Application

```bash
# Start both backend and frontend (recommended for development)
npm run dev

# Or start them separately:
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
cd client && npm start
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/api/health

## Project Structure

```
triptrackr/
├── server/                 # Backend Node.js/Express
│   ├── routes/            # API route handlers
│   │   ├── weather.js     # Weather API (OpenWeatherMap)
│   │   ├── maps.js        # Maps API (Google Maps)
│   │   ├── chat.js        # AI Chatbot (Gemini)
│   │   └── itineraries.js # Trip management
│   └── index.js           # Main server file
├── client/                 # Frontend React app
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── App.js         # Main app component
│   │   └── index.js       # React entry point
│   └── public/            # Static assets
├── package.json            # Backend dependencies
├── client/package.json     # Frontend dependencies
└── .env                    # Environment variables
```

## Features

### ✅ Implemented
- **Weather Integration**: Real-time weather data and 5-day forecasts
- **AI Chatbot**: Gemini 2.5 Pro powered travel assistant
- **Maps Integration**: Google Maps API for places search
- **Trip Management**: Create, view, edit, and delete itineraries
- **Responsive Design**: Mobile-friendly modern UI
- **Real-time Updates**: Live weather data and AI responses

### 🚧 Coming Soon
- Interactive Google Maps with directions
- PDF and iCal export functionality
- User authentication and profiles
- Advanced weather alerts
- Multi-currency expense tracking

## API Endpoints

### Weather
- `GET /api/weather/:city` - Current weather
- `GET /api/weather/forecast/:city` - 5-day forecast

### Maps
- `GET /api/maps/places/:query` - Search places
- `GET /api/maps/place/:id` - Place details

### AI Chatbot
- `POST /api/chat` - Send message to AI
- `GET /api/chat/history/:userId` - Chat history

### Itineraries
- `GET /api/itineraries` - List all trips
- `POST /api/itineraries` - Create new trip
- `GET /api/itineraries/:id` - Get trip details
- `PUT /api/itineraries/:id` - Update trip
- `DELETE /api/itineraries/:id` - Delete trip

## Development

### Available Scripts

```bash
# Development (both frontend and backend)
npm run dev

# Backend only
npm run server

# Frontend only
npm run client

# Build for production
npm run build

# Install all dependencies
npm run install-all
```

### Adding New Features

1. **Backend**: Add new routes in `server/routes/`
2. **Frontend**: Create new pages in `client/src/pages/`
3. **Components**: Add reusable components in `client/src/components/`
4. **Styling**: Use the existing CSS classes in `client/src/App.css`

## Troubleshooting

### Common Issues

1. **Port already in use**
   - Change `PORT` in `.env` file
   - Kill existing processes: `npx kill-port 3000 5000`

2. **API keys not working**
   - Verify keys are correctly set in `.env`
   - Check API quotas and billing
   - Ensure required APIs are enabled

3. **Dependencies not installing**
   - Clear npm cache: `npm cache clean --force`
   - Delete `node_modules` and reinstall

4. **Frontend not connecting to backend**
   - Verify backend is running on port 5000
   - Check CORS settings in server
   - Ensure proxy is set in `client/package.json`

### Getting Help

- Check the browser console for frontend errors
- Check the terminal for backend errors
- Verify all environment variables are set
- Ensure all dependencies are installed

## Deployment

### Production Build

```bash
# Build frontend
cd client && npm run build

# Start production server
npm start
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
GOOGLE_MAPS_API_KEY=your_production_key
OPENWEATHER_API_KEY=your_production_key
GEMINI_API_KEY=your_production_key
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

---

**Happy Travel Planning! 🌍✈️**

For support or questions, check the README.md file or create an issue in the repository.
