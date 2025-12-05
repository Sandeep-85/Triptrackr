import React, { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, Navigation, Clock, Star } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const Maps = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [radius, setRadius] = useState(5000);
  const [searchResults, setSearchResults] = useState([]);
  const [resultsMeta, setResultsMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [serverConfig, setServerConfig] = useState({ routing: false });
  const [etaLoading, setEtaLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeError, setRouteError] = useState('');
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Parse query params for directions intent: destination=lat,lng&origin=lat,lng&name=label
  const { origin, destination, name } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const o = params.get('origin') || '';
    const d = params.get('destination') || '';
    const n = params.get('name') || '';
    return { origin: o, destination: d, name: n };
  }, []);

  const embedKey = useMemo(() => (
    process.env.REACT_APP_GOOGLE_MAPS_EMBED_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY || ''
  ), []);

  // Fetch minimal server config once to know if routing is available
  useEffect(() => {
    (async () => {
      try {
        const resp = await axios.get('/api/maps/config');
        setServerConfig({ routing: Boolean(resp?.data?.routing) });
      } catch (_) {
        setServerConfig({ routing: false });
      }
    })();
  }, []);

  // Auto-fetch ETA when origin + destination are present
  useEffect(() => {
    // Clear any previous ETA when query params change
    setRouteInfo(null);
    setRouteError('');
  }, [origin, destination, serverConfig.routing]);

  const searchPlaces = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setLoading(true);
    try {
      // 1) Geocode to precise center (server handles Google or OSM fallback)
      const geo = await axios.get(`/api/maps/geocode/${encodeURIComponent(searchQuery.trim())}`);
      const lat = geo?.data?.coordinates?.lat;
      const lng = geo?.data?.coordinates?.lng;

      // 2) Nearby search anchored to the resolved center with targeted POI types
      const nearbyResp = await axios.get(`/api/maps/nearby`, {
        params: {
          location: `${lat},${lng}`,
          radius,
          types: 'restaurant,cafe,fast_food,bar,hotel,lodging,tourist_attraction,park,shopping_mall,point_of_interest'
        }
      });
      const nearbyResults = sanitizeResults(nearbyResp.data.results || []);
      const filtered = nearbyResults;
      setSearchResults(filtered);
      setResultsMeta({
        center: nearbyResp.data.center || `${lat},${lng}`,
        radius: nearbyResp.data.radius,
        total: filtered.length,
        source: nearbyResp.data.source
      });
      if (filtered.length === 0) toast.info('No places found for your search');
    } catch (error) {
      // 2) Fallback to plain text search (doesn't require resolving center)
      try {
        // Try category-focused text searches in parallel and merge
        const q = searchQuery.trim();
        const queries = [
          `restaurants in ${q}`,
          `hotels in ${q}`,
          `tourist attractions in ${q}`
        ];
        const requests = queries.map(s => axios.get(`/api/maps/places/${encodeURIComponent(s)}`).catch(() => null));
        const responses = await Promise.all(requests);
        const merged = [];
        const seen = new Set();
        for (const resp of responses) {
          const arr = resp?.data?.results || [];
          for (const p of arr) {
            const types = (p.types || []).map(String);
            const isAdmin = types.some(t => /administrative|boundary|locality|political/i.test(t));
            if (isAdmin) continue;
            if (p.place_id && !seen.has(p.place_id)) {
              seen.add(p.place_id);
              merged.push(p);
            }
          }
        }
        setSearchResults(sanitizeResults(merged));
        setResultsMeta({ center: null, radius, total: merged.length, source: 'TEXT-MERGE' });
        if (merged.length === 0) toast.info('No places found for your search');
      } catch (err2) {
        console.error('Places search error (text search fallback):', err2);
        // 3) Last resort: query OSM Nominatim directly from browser
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=15`;
          const resp = await fetch(url);
          const data = await resp.json();
          const mapped = Array.isArray(data)
          ? data.map(item => ({
                place_id: `osm-${item.osm_type}-${item.osm_id}`,
                name: item.display_name?.split(',')[0] || item.name || 'Place',
                address: item.display_name,
                coordinates: { lat: Number(item.lat), lng: Number(item.lon) },
                rating: null,
                user_ratings_total: null,
              types: [item.type, item.class].filter(Boolean),
                price_level: null,
                opening_hours: null,
                photos: []
            }))
          : [];
        const sanitized = sanitizeResults(mapped);
        setSearchResults(sanitized);
        setResultsMeta({ center: null, radius, total: sanitized.length, source: 'OSM-DIRECT' });
        if (sanitized.length === 0) toast.info('No places found for your search');
        } catch (err3) {
          toast.error('Search failed. Please try again in a moment.');
          setSearchResults([]);
          setResultsMeta(null);
        }
      }
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

  const openDetailsModal = async (placeId) => {
    setDetailsLoading(true);
    setDetailsModalOpen(true);
    try {
      const response = await axios.get(`/api/maps/place/${placeId}`);
      setSelectedPlace(response.data);
    } catch (error) {
      console.error('Place details error:', error);
      toast.error('Failed to load place details');
      setDetailsModalOpen(false);
    } finally {
      setDetailsLoading(false);
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

  // Final client-side safety: remove administrative results and de-duplicate
  const sanitizeResults = (arr) => {
    const seen = new Set();
    const out = [];
    for (const p of Array.isArray(arr) ? arr : []) {
      const types = (p.types || []).map(x => String(x || '').toLowerCase());
      const isGoogleAdmin = types.some(t =>
        t === 'political' ||
        t === 'locality' ||
        t === 'country' ||
        t === 'sublocality' ||
        t === 'neighborhood' ||
        t === 'colloquial_area' ||
        t === 'route' ||
        t === 'postal_code' ||
        /^administrative_area_level_\d+$/.test(t) ||
        t === 'sublocality_level_1' ||
        t === 'sublocality_level_2'
      );
      const hasPlaceClass = types.includes('place');
      const placeTokens = new Set(['city','state','region','province','county','district','quarter','town','village','hamlet','suburb','island','archipelago','continent','municipality','borough','state_district']);
      const isOsmAdmin = hasPlaceClass && types.some(t => placeTokens.has(t));
      if (isGoogleAdmin || isOsmAdmin) continue;
      const key = p.place_id || `${p.name}-${p.coordinates?.lat}-${p.coordinates?.lng}`;
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      out.push(p);
    }
    return out;
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

      {/* Directions embed when destination provided */}
      {destination && (
        <div className="card mb-8">
          <div className="card-header">
            <h3 className="card-title">Directions {name ? `to ${name}` : ''}</h3>
            <p className="card-subtitle">
              Using Google Maps directions
            </p>
          </div>
          <div className="space-y-4">
            {embedKey ? (
              <div className="aspect-video w-full overflow-hidden rounded-lg border">
                <iframe
                  title="Google Maps Directions"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/directions?key=${embedKey}&origin=${encodeURIComponent(origin || 'Current Location')}&destination=${encodeURIComponent(destination)}&mode=driving`}
                />
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 border rounded">
                <div className="text-sm text-yellow-800">
                  Google Maps embed key is not configured. Use the button below to open directions in Google Maps.
                </div>
              </div>
            )}
            <div className="flex gap-4 items-center flex-wrap">
              <a
                className="btn btn-primary"
                style={{ minWidth: 200 }}
                href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin || '')}&destination=${encodeURIComponent(destination)}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation size={18} /> <span>Open in Google Maps</span>
              </a>
              {origin && serverConfig.routing && (
                <button
                  className="btn btn-primary"
                  style={{ minWidth: 200 }}
                  onClick={async () => {
                    setEtaLoading(true);
                    setRouteError('');
                    setRouteInfo(null);
                    try {
                      const resp = await axios.get('/api/maps/directions', {
                        params: { origin, destination, mode: 'driving' }
                      });
                      const data = resp?.data || {};
                      setRouteInfo({
                        summary: data.summary || '',
                        durationText: data.duration?.text || '',
                        distanceText: data.distance?.text || '',
                        start: data.start_address || '',
                        end: data.end_address || ''
                      });
                    } catch (e) {
                      const msg = e?.response?.data?.message || e?.response?.data?.error || e.message || 'Failed to fetch server directions';
                      setRouteError(msg);
                      toast.error('Failed to fetch server directions');
                    } finally {
                      setEtaLoading(false);
                    }
                  }}
                  disabled={etaLoading}
                >
                  <Clock size={16} /> <span>{etaLoading ? 'Getting ETA…' : 'Show ETA'}</span>
                </button>
              )}
            </div>
            {(routeInfo || routeError) && (
              <div className="p-4 bg-gray-50 rounded border">
                {routeInfo ? (
                  <div className="text-sm text-gray-800">
                    <div className="font-medium mb-1">{routeInfo.summary || 'Route details'}</div>
                    <div className="flex flex-wrap gap-4">
                      {routeInfo.durationText && (<div><span className="text-gray-500">ETA:</span> {routeInfo.durationText}</div>)}
                      {routeInfo.distanceText && (<div><span className="text-gray-500">Distance:</span> {routeInfo.distanceText}</div>)}
                    </div>
                    {(routeInfo.start || routeInfo.end) && (
                      <div className="mt-1 text-xs text-gray-600">
                        {routeInfo.start && (<div>From: {routeInfo.start}</div>)}
                        {routeInfo.end && (<div>To: {routeInfo.end}</div>)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-red-600">{routeError}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Section */}
      <div className="card mb-8">
        <form onSubmit={searchPlaces} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search a location (city, area, landmark)"
              className="form-input text-lg"
              disabled={loading}
            />
          </div>
          <div>
            <select
              className="form-select text-base"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              disabled={loading}
            >
              <option value={2000}>2 km</option>
              <option value={5000}>5 km</option>
              <option value={10000}>10 km</option>
              <option value={20000}>20 km</option>
            </select>
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
              <h3 className="card-title">Nearby Places</h3>
              <p className="card-subtitle">
                {searchResults.length > 0
                  ? `${searchResults.length} places within ${(resultsMeta?.radius || radius) / 1000} km of "${searchQuery}"`
                  : 'Search a location to see attractions nearby'}
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
                          openDetailsModal(place.place_id);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <span>Details</span>
                      </button>
                      <a
                        href={`/weather?lat=${encodeURIComponent(place.coordinates?.lat)}&lon=${encodeURIComponent(place.coordinates?.lng)}&label=${encodeURIComponent(place.name || '')}`}
                        className="btn btn-primary btn-sm ml-2"
                        onClick={(e) => e.stopPropagation()}
                        target="_self"
                        rel="noopener noreferrer"
                      >
                        Weather
                      </a>
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

      {/* Details Modal */}
      {detailsModalOpen && (
        <div className="modal-backdrop" onClick={() => setDetailsModalOpen(false)}>
          <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header">
              <strong>{selectedPlace?.name || 'Place Details'}</strong>
              <button className="modal-close" onClick={() => setDetailsModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              {detailsLoading ? (
                <div className="text-center py-6 text-gray-600">Loading details...</div>
              ) : selectedPlace ? (
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
                    </div>
                  )}
                  {selectedPlace.website && (
                    <div>
                      <label className="font-medium text-gray-900">Website</label>
                      <a href={selectedPlace.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 break-all">{selectedPlace.website}</a>
                    </div>
                  )}
                  {selectedPlace.phone && (
                    <div>
                      <label className="font-medium text-gray-900">Phone</label>
                      <p className="text-gray-600">{selectedPlace.phone}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-600">No details available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maps;
