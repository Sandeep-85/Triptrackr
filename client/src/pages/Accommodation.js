import React, { useState } from 'react';
import axios from 'axios';
import { MapPin, Utensils, Search } from 'lucide-react';

const Accommodation = () => {
  const [query, setQuery] = useState('');
  const [radius, setRadius] = useState(3000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [center, setCenter] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const isCoords = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(query.trim());
      const params = new URLSearchParams();
      params.set('radius', String(radius));
      if (isCoords) {
        params.set('location', query.trim());
      } else {
        params.set('query', query.trim());
      }
      const { data } = await axios.get(`/api/maps/accommodations?${params.toString()}`);
      setResults(Array.isArray(data.results) ? data.results : []);
      setCenter(data.center || '');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch accommodations');
    } finally {
      setLoading(false);
    }
  };

  const ResultCard = ({ item }) => (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-4">
          <Utensils size={20} />
          <div>
            <div className="card-title">{item.name}</div>
            <div className="card-subtitle">{item.address || 'Address not available'}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2">
        <div>
          <div className="text-sm text-gray-600">Rating</div>
          <div className="text-lg font-semibold">{item.rating ?? 'N/A'} ({item.user_ratings_total ?? 0})</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Open Now</div>
          <div className="text-lg font-semibold">{item.open_now === null ? 'Unknown' : item.open_now ? 'Yes' : 'No'}</div>
        </div>
      </div>
      {item.coordinates?.lat && item.coordinates?.lng && (
        <div className="mt-4 text-sm text-gray-600 flex items-center gap-2">
          <MapPin size={16} /> {item.coordinates.lat}, {item.coordinates.lng}
        </div>
      )}
    </div>
  );

  return (
    <div className="home-page">
      <div className="card">
        <div className="card-header">
          <div className="card-title">Accommodation</div>
          <div className="card-subtitle">Search restaurants by place name or coordinates (lat,lng)</div>
        </div>
        <form onSubmit={handleSearch} className="grid grid-cols-3 gap-4">
          <input
            className="form-input"
            placeholder="Enter a place (e.g., Anantapur) or coordinates (lat,lng)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
          />
          <select className="form-select" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
            <option value={1000}>1 km</option>
            <option value={2000}>2 km</option>
            <option value={3000}>3 km</option>
            <option value={5000}>5 km</option>
            <option value={10000}>10 km</option>
            <option value={15000}>15 km</option>
            <option value={25000}>25 km</option>
          </select>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            <Search size={16} /> {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
        {error && <div className="mt-4 form-error">{error}</div>}
        {center && (
          <div className="mt-4 text-sm text-gray-600">Center: {center} • Radius: {radius}m</div>
        )}
      </div>

      <div className="grid grid-cols-1 mt-6">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Nearest Restaurants</div>
            <div className="card-subtitle">{results.length} results</div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {results.map(r => (
              <ResultCard key={r.place_id} item={r} />
            ))}
            {(!loading && results.length === 0) && <div className="text-gray-600">No restaurants found.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Accommodation;


