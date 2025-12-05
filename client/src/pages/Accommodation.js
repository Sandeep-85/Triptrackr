import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapPin, BedDouble, Search, UtensilsCrossed } from 'lucide-react';

const Accommodation = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [radius, setRadius] = useState(3000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [foodResults, setFoodResults] = useState([]);
  const [center, setCenter] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);
    setFoodResults([]);
    try {
      const isCoords = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(query.trim());
      let data;
      if (isCoords) {
        // Fetch hotels and restaurants in parallel when coordinates provided
        const hotelParams = new URLSearchParams();
        hotelParams.set('radius', String(radius));
        hotelParams.set('types', 'hotel,guest_house,hostel,resort,lodging,motel,apartment');
        hotelParams.set('location', query.trim());

        const foodParams = new URLSearchParams();
        foodParams.set('radius', String(radius));
        foodParams.set('types', 'restaurant,cafe,fast_food,bar,food,food_court');
        foodParams.set('location', query.trim());

        const [hotelResp, foodResp] = await Promise.all([
          axios.get(`/api/maps/nearby?${hotelParams.toString()}`),
          axios.get(`/api/maps/nearby?${foodParams.toString()}`)
        ]);
        data = hotelResp.data;
        setFoodResults((foodResp.data?.results || []).map(r => ({
          ...r,
          open_now: r.open_now ?? r.opening_hours?.open_now ?? null
        })));
      } else {
        // 1) Try accommodations endpoint (multi-source, tuned for lodging)
        const accParams = new URLSearchParams();
        accParams.set('radius', String(radius));
        accParams.set('query', query.trim());
        try {
          const acc = await axios.get(`/api/maps/accommodations?${accParams.toString()}`);
          data = acc.data || { results: [] };
          if (!Array.isArray(data.results) || data.results.length === 0) throw new Error('empty');
        } catch (_) {
          // 2) Prefer nearby (does geocoding with multiple fallbacks)
          const hotelParams = new URLSearchParams();
          hotelParams.set('radius', String(radius));
          hotelParams.set('types', 'hotel,guest_house,hostel,resort,lodging,motel,apartment');
          hotelParams.set('query', query.trim());
          try {
            const [hotelResp, foodResp] = await Promise.all([
              axios.get(`/api/maps/nearby?${hotelParams.toString()}`),
              axios.get(`/api/maps/nearby?query=${encodeURIComponent(query.trim())}&radius=${encodeURIComponent(String(radius))}&types=restaurant,cafe,fast_food,bar,food,food_court`)
            ]);
            data = hotelResp.data;
            setFoodResults((foodResp.data?.results || []).map(r => ({
              ...r,
              open_now: r.open_now ?? r.opening_hours?.open_now ?? null
            })));
          } catch (_) {
            // 3) Fallback: text search “hotels in <place>”
            const q = `hotels in ${query.trim()}`;
            const resp2 = await axios.get(`/api/maps/places/${encodeURIComponent(q)}?source=osm`);
            data = { results: resp2.data?.results || [], center: null };
          }
        }
      }
      // If proxy/server was restarting (ECONNRESET) or temporary 5xx, retry once quickly
      if (!data || (Array.isArray(data.results) && data.results.length === 0 && !data.center)) {
        try {
          await new Promise(r => setTimeout(r, 400));
          if (isCoords) {
            const params = new URLSearchParams();
            params.set('radius', String(radius));
            params.set('types', 'hotel,guest_house,hostel,resort,lodging,motel,apartment');
            params.set('location', query.trim());
            const retry = await axios.get(`/api/maps/nearby?${params.toString()}`);
            data = retry.data || data;
          } else {
            const q = `hotels in ${query.trim()}`;
            const retry = await axios.get(`/api/maps/places/${encodeURIComponent(q)}?source=osm`);
            data = { results: retry.data?.results || [], center: null };
          }
        } catch (_) { /* noop */ }
      }
      // Normalize open_now across sources
      const normalized = Array.isArray(data.results) ? data.results.map(r => ({
        ...r,
        open_now: r.open_now ?? r.opening_hours?.open_now ?? null
      })) : [];
      setResults(normalized);
      setCenter(data.center || '');
    } catch (err) {
      // Final client-side fallback: direct Nominatim query (no server needed)
      try {
        const q = `hotel ${query.trim()}`;
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=20`;
        const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
        const raw = await resp.json();
        const mapped = Array.isArray(raw) ? raw.map(item => ({
          place_id: `osm-${item.osm_type}-${item.osm_id}`,
          name: item.display_name?.split(',')[0] || item.name || 'Hotel',
          address: item.display_name,
          coordinates: { lat: Number(item.lat), lng: Number(item.lon) },
          rating: null,
          user_ratings_total: null,
          open_now: null,
          price_level: null,
          photos: []
        })) : [];
        setResults(mapped);
        setCenter('');
        if (!mapped.length) {
          setError(err?.message || 'No hotels found');
        } else {
          setError('');
        }
      } catch (_) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to fetch accommodations';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const ResultCard = ({ item }) => (
    <div
      className="card"
      onClick={() => {
        if (item?.coordinates?.lat && item?.coordinates?.lng) {
          const params = new URLSearchParams();
          params.set('destination', `${item.coordinates.lat},${item.coordinates.lng}`);
          if (center) params.set('origin', center);
          params.set('name', item.name || 'Destination');
          navigate(`/maps?${params.toString()}`);
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <div className="card-header">
        <div className="flex items-center gap-4">
          <BedDouble size={20} />
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

  const FoodCard = ({ item }) => (
    <div
      className="card"
      onClick={() => {
        if (item?.coordinates?.lat && item?.coordinates?.lng) {
          const params = new URLSearchParams();
          params.set('destination', `${item.coordinates.lat},${item.coordinates.lng}`);
          if (center) params.set('origin', center);
          params.set('name', item.name || 'Destination');
          navigate(`/maps?${params.toString()}`);
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <div className="card-header">
        <div className="flex items-center gap-4">
          <UtensilsCrossed size={20} />
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
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Accommodation</div>
          <div className="card-subtitle">Search hotels and restaurants by place name or coordinates (lat,lng)</div>
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
            <div className="card-title">Nearest Hotels</div>
            <div className="card-subtitle">{results.length} results</div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {results.map(r => (
              <ResultCard key={r.place_id} item={r} />
            ))}
            {(!loading && results.length === 0) && <div className="text-gray-600">No hotels found.</div>}
          </div>
        </div>
        <div className="card mt-6">
          <div className="card-header">
            <div className="card-title">Nearby Restaurants</div>
            <div className="card-subtitle">{foodResults.length} results</div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {foodResults.map(r => (
              <FoodCard key={r.place_id} item={r} />
            ))}
            {(!loading && foodResults.length === 0) && <div className="text-gray-600">No restaurants found.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Accommodation;


