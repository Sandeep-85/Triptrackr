import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin, Calendar, DollarSign, Cloud } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    loadItineraries();
  }, []);

  const loadItineraries = async () => {
    try {
      const response = await axios.get('/api/itineraries');
      setItineraries(response.data.itineraries);
    } catch (error) {
      console.error('Failed to load itineraries:', error);
      toast.error('Failed to load itineraries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    // Pick the nearest upcoming trip's first destination, fallback to Mumbai
    try {
      const now = new Date();
      const upcoming = [...itineraries]
        .filter(t => new Date(t.endDate) >= now)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      const defaultCity = upcoming[0]?.destinations?.[0]?.name || 'Mumbai';

      if (defaultCity) {
        setWeatherLoading(true);
        axios.get(`/api/weather/${encodeURIComponent(defaultCity)}?units=metric`)
          .then(res => setWeather(res.data))
          .catch(() => {/* silent */})
          .finally(() => setWeatherLoading(false));
      }
    } catch (e) {
      // noop
    }
  }, [loading, itineraries]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'planning': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to format currency display
  const formatCurrency = (amount, currency) => {
    if (currency === 'INR') {
      return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <span className="ml-3">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Hello, {localStorage.getItem('tt_name') || 'Traveler'} 👋
          </h1>
          <p className="text-lg text-gray-600">
            Manage your trips and get weather insights
          </p>
        </div>
        <Link to="/create-trip" className="btn btn-primary">
          <Plus size={20} />
          <span>Create New Trip</span>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="card text-center">
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {itineraries.length}
          </div>
          <div className="text-gray-600">Total Trips</div>
        </div>
        
        <div className="card text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">
            {itineraries.filter(t => t.status === 'active').length}
          </div>
          <div className="text-gray-600">Active Trips</div>
        </div>
        
        <div className="card text-center">
          <div className="text-3xl font-bold text-purple-600 mb-2">
            {itineraries.filter(t => t.status === 'planning').length}
          </div>
          <div className="text-gray-600">Planning</div>
        </div>
        
        <div className="card text-center">
          <div className="text-3xl font-bold text-orange-600 mb-2">
            {itineraries.filter(t => t.status === 'completed').length}
          </div>
          <div className="text-gray-600">Completed</div>
        </div>

        <div className="card text-center">
          <div className="text-3xl font-bold text-yellow-600 mb-2">
            {formatCurrency(
              itineraries.reduce((total, trip) => total + (Number(trip.budget?.total) || 0), 0),
              'INR'
            )}
          </div>
          <div className="text-gray-600">Total Budget</div>
        </div>
      </div>

      {/* Weather Widget */}
      <div className="mb-8">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Weather Now</h3>
            <p className="card-subtitle">Based on your upcoming destination</p>
          </div>
          {weatherLoading ? (
            <div className="text-center py-6">
              <div className="spinner w-6 h-6 mx-auto"></div>
            </div>
          ) : weather ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-semibold text-gray-900">{weather.city}, {weather.country}</div>
                <div className="text-gray-600">{weather.current.description}</div>
              </div>
              <div className="flex items-center gap-3">
                <Cloud className="text-blue-600" />
                <div className="text-3xl font-bold">{Math.round(weather.current.temperature)}°C</div>
              </div>
            </div>
          ) : (
            <div className="text-gray-600">No upcoming destinations found. Plan a trip to see weather here.</div>
          )}
        </div>
      </div>

      {/* Recent Itineraries */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Itineraries</h3>
          <p className="card-subtitle">Your latest travel plans</p>
        </div>
        
        {itineraries.length === 0 ? (
          <div className="text-center py-12">
            <MapPin size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No trips planned yet
            </h3>
            <p className="text-gray-500 mb-6">
              Start planning your first adventure with TripTrackr
            </p>
            <Link to="/create-trip" className="btn btn-primary">
              <Plus size={20} />
              <span>Create Your First Trip</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {itineraries.slice(0, 5).map((itinerary) => (
              <div key={itinerary.id || itinerary._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900">
                      {itinerary.title}
                    </h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(itinerary.status)}`}>
                      {itinerary.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      <span>
                        {formatDate(itinerary.startDate)} - {formatDate(itinerary.endDate)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <MapPin size={16} />
                      <span>
                        {itinerary.destinations?.length || 0} destination{itinerary.destinations?.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    {Number(itinerary.budget?.total) > 0 && (
                      <div className="flex items-center gap-2">
                        <DollarSign size={16} />
                        <span>
                          {formatCurrency(Number(itinerary.budget.total), itinerary.budget.currency)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Link to={`/trip/${itinerary.id || itinerary._id}`} className="btn btn-secondary btn-sm">
                    View Details
                  </Link>
                </div>
              </div>
            ))}
            
            {itineraries.length > 5 && (
              <div className="text-center pt-4">
                <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">
                  View all {itineraries.length} itineraries
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Link to="/weather" className="card hover:scale-105 transition-transform duration-200">
          <div className="text-center">
            <Cloud size={48} className="mx-auto text-blue-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Check Weather</h3>
            <p className="text-gray-600">
              Get real-time weather forecasts for your destinations
            </p>
          </div>
        </Link>
        
        <Link to="/maps" className="card hover:scale-105 transition-transform duration-200">
          <div className="text-center">
            <MapPin size={48} className="mx-auto text-green-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Explore Maps</h3>
            <p className="text-gray-600">
              Find points of interest and plan optimal routes
            </p>
          </div>
        </Link>
        
        <Link to="/chatbot" className="card hover:scale-105 transition-transform duration-200">
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-lg">AI</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">AI Assistant</h3>
            <p className="text-gray-600">
              Get personalized travel advice and recommendations
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
