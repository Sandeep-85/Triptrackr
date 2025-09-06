import React, { useState } from 'react';
import { Search, MapPin, Navigation, Clock, Star } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const Maps = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const searchPlaces = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`/api/maps/places/${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data.results || []);
      if (response.data.results.length === 0) {
        toast.info('No places found for your search');
      }
    } catch (error) {
      console.error('Places search error:', error);
      toast.error('Failed to search places');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getPlaceDetails = async (placeId) => {
    try {
      const response = await axios.get(`/api/maps/place/${placeId}`);
      setSelectedPlace(response.data);
    } catch (error) {
      console.error('Place details error:', error);
      toast.error('Failed to load place details');
    }
  };

  const getPriceLevel = (level) => {
    if (!level) return 'N/A';
    return '$'.repeat(level);
  };

  const getRatingStars = (rating) => {
    if (!rating) return 'No rating';
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  };

  return (
    <div className="maps-page">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Explore Destinations
        </h1>
        <p className="text-lg text-gray-600">
          Find points of interest, restaurants, and attractions with Google Maps integration
        </p>
      </div>

      {/* Search Section */}
      <div className="card mb-8">
        <form onSubmit={searchPlaces} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for restaurants, hotels, attractions..."
              className="form-input text-lg"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <div className="spinner w-4 h-4"></div>
            ) : (
              <Search size={20} />
            )}
            <span>Search</span>
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Search Results */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Search Results</h3>
              <p className="card-subtitle">
                {searchResults.length > 0 ? `${searchResults.length} places found` : 'Search for places to explore'}
              </p>
            </div>
            
            {searchResults.length > 0 ? (
              <div className="space-y-4">
                {searchResults.map((place) => (
                  <div
                    key={place.place_id}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => getPlaceDetails(place.place_id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MapPin size={24} className="text-gray-600" />
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">{place.name}</h4>
                        <p className="text-gray-600 text-sm mb-2">{place.address}</p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {place.rating && (
                            <div className="flex items-center gap-1">
                              <Star size={16} className="text-yellow-500" />
                              <span>{place.rating}</span>
                              <span>({place.user_ratings_total})</span>
                            </div>
                          )}
                          
                          {place.price_level && (
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Price:</span>
                              <span>{getPriceLevel(place.price_level)}</span>
                            </div>
                          )}
                          
                          {place.types && place.types[0] && (
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Type:</span>
                              <span className="capitalize">{place.types[0].replace(/_/g, ' ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          getPlaceDetails(place.place_id);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <span>Details</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MapPin size={64} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  {loading ? 'Searching...' : 'No places found'}
                </h3>
                <p className="text-gray-500">
                  {loading ? 'Please wait while we search...' : 'Try searching for restaurants, hotels, or attractions'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Place Details Sidebar */}
        <div className="lg:col-span-1">
          {selectedPlace ? (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{selectedPlace.name}</h3>
                <p className="card-subtitle">Place Details</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="font-medium text-gray-900">Address</label>
                  <p className="text-gray-600">{selectedPlace.address}</p>
                </div>
                
                {selectedPlace.rating && (
                  <div>
                    <label className="font-medium text-gray-900">Rating</label>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-500">{getRatingStars(selectedPlace.rating)}</span>
                      <span className="text-gray-600">({selectedPlace.rating}/5)</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Based on {selectedPlace.user_ratings_total} reviews
                    </p>
                  </div>
                )}
                
                {selectedPlace.price_level && (
                  <div>
                    <label className="font-medium text-gray-900">Price Level</label>
                    <p className="text-gray-600">{getPriceLevel(selectedPlace.price_level)}</p>
                  </div>
                )}
                
                {selectedPlace.phone && (
                  <div>
                    <label className="font-medium text-gray-900">Phone</label>
                    <p className="text-gray-600">{selectedPlace.phone}</p>
                  </div>
                )}
                
                {selectedPlace.website && (
                  <div>
                    <label className="font-medium text-gray-900">Website</label>
                    <a
                      href={selectedPlace.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 break-all"
                    >
                      {selectedPlace.website}
                    </a>
                  </div>
                )}
                
                {selectedPlace.opening_hours && (
                  <div>
                    <label className="font-medium text-gray-900">Opening Hours</label>
                    <div className="text-sm text-gray-600">
                      {selectedPlace.opening_hours.open_now ? (
                        <span className="text-green-600 font-medium">Open Now</span>
                      ) : (
                        <span className="text-red-600 font-medium">Closed</span>
                      )}
                    </div>
                    {selectedPlace.opening_hours.weekday_text && (
                      <div className="mt-2 space-y-1">
                        {selectedPlace.opening_hours.weekday_text.map((day, index) => (
                          <div key={index} className="text-xs text-gray-500">{day}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {selectedPlace.types && (
                  <div>
                    <label className="font-medium text-gray-900">Categories</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedPlace.types.slice(0, 5).map((type, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full capitalize"
                        >
                          {type.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Place Details</h3>
                <p className="card-subtitle">Select a place to view details</p>
              </div>
              
              <div className="text-center py-12">
                <MapPin size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">
                  Click on a search result to see detailed information
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map Integration Note */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <MapPin size={20} className="text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Interactive Maps Coming Soon</h4>
            <p className="text-blue-800 text-sm">
              Full Google Maps integration with interactive maps, directions, and real-time location services 
              will be available in the next update. For now, you can search and explore places using our 
              comprehensive place search API.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Maps;
