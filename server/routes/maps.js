const express = require('express');
const axios = require('axios');
const router = express.Router();

// Keys configured explicitly per capability (env overrides supported)
// Fall back to GOOGLE_MAPS_API_KEY if specific ones are not provided
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const GEOCODE_API_KEY = process.env.GEOCODE_API_KEY || GOOGLE_MAPS_API_KEY || '';
const PLACES_API_KEY = process.env.PLACES_API_KEY || GOOGLE_MAPS_API_KEY || '';
const ROUTING_API_KEY = process.env.ROUTING_API_KEY || GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAPS_BASE_URL = 'https://maps.googleapis.com/maps/api';

// Filter helper: exclude administrative/political and generic place entries (city/state/region)
const isAdministrativeTypes = (types) => {
  if (!Array.isArray(types)) return false;
  const lowered = types.map(t => String(t || '').toLowerCase());
  // Google admin tokens
  const blockedExact = new Set([
    'political',
    'locality',
    'country',
    'sublocality',
    'neighborhood',
    'colloquial_area',
    'route',
    'postal_code',
    'administrative_area_level_1',
    'administrative_area_level_2',
    'administrative_area_level_3',
    'administrative_area_level_4',
    'administrative_area_level_5',
    'sublocality_level_1',
    'sublocality_level_2'
  ]);
  if (lowered.some(t => blockedExact.has(t) || /^administrative_area_level_\d+$/.test(t))) {
    return true;
  }
  // OSM place-class tokens (avoid false positives like place_of_worship)
  const placeTokens = new Set([
    'city','state','region','province','county','district','quarter','town','village','hamlet','suburb',
    'island','archipelago','continent','municipality','borough','state_district'
  ]);
  const hasPlaceClass = lowered.includes('place');
  if (hasPlaceClass && lowered.some(t => placeTokens.has(t))) {
    return true;
  }
  return false;
};

// Lightweight config so the client can conditionally enable features
router.get('/config', (req, res) => {
  res.json({
    // Routing available via Google (when key present) or OSRM fallback (no key)
    routing: true,
    routing_provider: ROUTING_API_KEY ? 'GOOGLE' : 'OSRM',
    places: Boolean(PLACES_API_KEY),
    geocoding: Boolean(GEOCODE_API_KEY)
  });
});

// Geocode address to coordinates
router.get('/geocode/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { language = 'en' } = req.query;

    // Try Google Geocoding first
    if (GEOCODE_API_KEY) {
      try {
        const response = await axios.get(`${GOOGLE_MAPS_BASE_URL}/geocode/json`, {
          params: {
            address: decodeURIComponent(address),
            key: GEOCODE_API_KEY,
            language
          }
        });

        if (response.data.status === 'OK' && response.data.results.length) {
          const result = response.data.results[0];
          const geocodedData = {
            address: result.formatted_address,
            coordinates: {
              lat: result.geometry.location.lat,
              lng: result.geometry.location.lng
            },
            location_type: result.geometry.location_type,
            viewport: result.geometry.viewport,
            bounds: result.geometry.bounds,
            place_id: result.place_id,
            types: result.types,
            components: result.address_components.map(component => ({
              long_name: component.long_name,
              short_name: component.short_name,
              types: component.types
            }))
          };
          return res.json(geocodedData);
        }
      } catch (_) { /* fallthrough to OSM */ }
    }

    // Fallback: OpenStreetMap Nominatim
    try {
      const nominatim = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { format: 'json', q: decodeURIComponent(address), limit: 1 },
        headers: { 'User-Agent': 'Triptrackr/1.0 (contact@example.com)' }
      });
      if (Array.isArray(nominatim.data) && nominatim.data.length > 0) {
        const loc = nominatim.data[0];
        return res.json({
          address: loc.display_name,
          coordinates: { lat: Number(loc.lat), lng: Number(loc.lon) },
          location_type: null,
          viewport: null,
          bounds: null,
          place_id: `osm-${loc.osm_type}-${loc.osm_id}`,
          types: [loc.type, loc.class].filter(Boolean),
          components: []
        });
      }
      return res.status(400).json({ error: 'Unable to geocode address' });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to geocode address', message: e.message });
    }
  } catch (error) {
    console.error('Geocoding API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to geocode address',
      message: error.response?.data?.error_message || error.message
    });
  }
});

// Search for places of interest
router.get('/places/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { 
      location, 
      radius = 5000, 
      type = 'establishment',
      language = 'en',
      minprice = 0,
      maxprice = 4,
      opennow = false,
      source = '' // when 'osm', skip Google and use OSM directly
    } = req.query;

    // Helper mapper for Google Places -> our schema
    const mapGooglePlaces = (results) => results.map(place => ({
      place_id: place.place_id,
      name: place.name,
      address: place.formatted_address,
      coordinates: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      },
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      types: place.types,
      price_level: place.price_level,
      opening_hours: place.opening_hours ? {
        open_now: place.opening_hours.open_now,
        periods: place.opening_hours.periods,
        weekday_text: place.opening_hours.weekday_text
      } : null,
      photos: place.photos ? place.photos.map(photo => ({
        photo_reference: photo.photo_reference,
        height: photo.height,
        width: photo.width,
        html_attributions: photo.html_attributions
      })) : [],
      icon: place.icon,
      icon_background_color: place.icon_background_color,
      icon_mask_base_uri: place.icon_mask_base_uri
    }));

    // Try Google Places if key is available and source is not forced to OSM
    if (PLACES_API_KEY && String(source).toLowerCase() !== 'osm') {
      try {
        const params = {
          query: decodeURIComponent(query),
          key: PLACES_API_KEY,
          language,
          type,
          minprice,
          maxprice,
          opennow: opennow === 'true'
        };
        if (location) {
          params.location = location;
          params.radius = radius;
        }

        const response = await axios.get(`${GOOGLE_MAPS_BASE_URL}/place/textsearch/json`, { params });

        if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
          const raw = mapGooglePlaces(response.data.results || []);
          const places = raw.filter(p => !isAdministrativeTypes(p.types));
          return res.json({
            query: decodeURIComponent(query),
            results: places,
            total_results: places.length,
            status: response.data.status,
            next_page_token: response.data.next_page_token
          });
        }
        // If Google returns an error (e.g., REQUEST_DENIED), fall through to OSM
      } catch (_) { /* Fall back to OSM */ }
    }

    // Fallback: OpenStreetMap Nominatim text search
    try {
      const nominatim = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { format: 'jsonv2', q: decodeURIComponent(query), addressdetails: 1, limit: 15 },
        headers: { 'User-Agent': 'Triptrackr/1.0 (contact@example.com)' }
      });
      const results = Array.isArray(nominatim.data) ? nominatim.data : [];
      const unfiltered = results.map(item => ({
        place_id: `osm-${item.osm_type}-${item.osm_id}`,
        name: item.display_name?.split(',')[0] || item.name || 'Place',
        address: item.display_name,
        coordinates: { lat: Number(item.lat), lng: Number(item.lon) },
        rating: null,
        user_ratings_total: null,
        types: [item.type, item.class].filter(Boolean),
        price_level: null,
        opening_hours: null,
        photos: [],
        icon: null,
        icon_background_color: null,
        icon_mask_base_uri: null
      }));
      const places = unfiltered.filter(p => !isAdministrativeTypes(p.types));

      return res.json({
        query: decodeURIComponent(query),
        results: places,
        total_results: places.length,
        status: 'OSM',
        next_page_token: null
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Failed to search places',
        message: error.response?.data?.error || error.message
      });
    }

  } catch (error) {
    console.error('Places search API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to search places',
      message: error.response?.data?.error_message || error.message
    });
  }
});

// Get place details
router.get('/place/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;
    const { language = 'en', fields = 'name,formatted_address,geometry,rating,user_ratings_total,types,price_level,opening_hours,photos,website,formatted_phone_number,reviews' } = req.query;

    // Prefer Google details when available
    if (PLACES_API_KEY) {
      try {
        const response = await axios.get(`${GOOGLE_MAPS_BASE_URL}/place/details/json`, {
          params: {
            place_id: placeId,
            key: PLACES_API_KEY,
            language,
            fields
          }
        });

        if (response.data.status === 'OK') {
          const place = response.data.result;
          const placeDetails = {
            place_id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            coordinates: {
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng
            },
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            types: place.types,
            price_level: place.price_level,
            website: place.website,
            phone: place.formatted_phone_number,
            opening_hours: place.opening_hours ? {
              open_now: place.opening_hours.open_now,
              periods: place.opening_hours.periods,
              weekday_text: place.opening_hours.weekday_text
            } : null,
            photos: place.photos ? place.photos.map(photo => ({
              photo_reference: photo.photo_reference,
              height: photo.height,
              width: photo.width,
              html_attributions: photo.html_attributions
            })) : [],
            reviews: place.reviews ? place.reviews.map(review => ({
              author_name: review.author_name,
              rating: review.rating,
              text: review.text,
              time: new Date(review.time * 1000),
              profile_photo_url: review.profile_photo_url
            })) : []
          };
          return res.json(placeDetails);
        }
      } catch (_) { /* Fall back below */ }
    }

    // Fallback: minimal details from OSM Nominatim lookup
    try {
      // Accept multiple ID formats from our different sources:
      // - "osm-node-123", "osm-way-456", "osm-relation-789"
      // - "restaurant-node-123" (from accommodations endpoint)
      // - "osm-node-12345" where node+id may be bundled as "node-12345" or already "node-12345"
      // We extract the first occurrence of (node|way|relation)-<id>
      let type, id;
      if (placeId.startsWith('osm-')) {
        [, type, id] = placeId.split('-');
      } else {
        const match = placeId.match(/(?:^|[-_])(node|way|relation)-(\d+)/i);
        if (match) {
          type = match[1];
          id = match[2];
        }
      }
      if (!type || !id) {
        return res.status(400).json({ error: 'Place details unavailable without Google key' });
      }
      const lookup = await axios.get('https://nominatim.openstreetmap.org/lookup', {
        params: { format: 'jsonv2', osm_ids: `${type[0].toUpperCase()}${id}`, addressdetails: 1 },
        headers: { 'User-Agent': 'Triptrackr/1.0 (contact@example.com)' }
      });
      const item = Array.isArray(lookup.data) ? lookup.data[0] : null;
      if (!item) return res.status(404).json({ error: 'Place not found' });
      return res.json({
        place_id: placeId,
        name: item.display_name?.split(',')[0] || 'Place',
        address: item.display_name,
        coordinates: { lat: Number(item.lat), lng: Number(item.lon) },
        rating: null,
        user_ratings_total: null,
        types: [item.type, item.class].filter(Boolean),
        price_level: null,
        website: null,
        phone: null,
        opening_hours: null,
        photos: [],
        reviews: []
      });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to get place details', message: error.message });
    }
  } catch (error) {
    console.error('Place details API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to get place details',
      message: error.response?.data?.error_message || error.message
    });
  }
});

// Get directions between two points
router.get('/directions', async (req, res) => {
  try {
    const { 
      origin, 
      destination, 
      mode = 'driving',
      language = 'en',
      units = 'metric',
      avoid = '',
      traffic_model = 'best_guess',
      departure_time = 'now'
    } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }

    // 1) Try Google Directions if key is configured
    if (ROUTING_API_KEY) {
      try {
        const params = {
          origin: decodeURIComponent(origin),
          destination: decodeURIComponent(destination),
          key: ROUTING_API_KEY,
          mode,
          language,
          units,
          traffic_model,
          departure_time
        };
  
        if (avoid) params.avoid = avoid;
  
        const response = await axios.get(`${GOOGLE_MAPS_BASE_URL}/directions/json`, { params });
  
        if (response.data.status === 'OK') {
          const route = response.data.routes[0];
          const directions = {
            summary: route.summary,
            distance: route.legs[0].distance,
            duration: route.legs[0].duration,
            duration_in_traffic: route.legs[0].duration_in_traffic,
            start_address: route.legs[0].start_address,
            end_address: route.legs[0].end_address,
            steps: route.legs[0].steps.map(step => ({
              instruction: step.html_instructions,
              distance: step.distance,
              duration: step.duration,
              travel_mode: step.travel_mode,
              polyline: step.polyline.points
            })),
            polyline: route.overview_polyline.points,
            bounds: route.bounds,
            fare: route.fare,
            warnings: route.warnings
          };
          return res.json(directions);
        }
        // If Google response is not OK, fall through to OSRM
      } catch (_) { /* fall back to OSRM below */ }
    }

    // 2) Fallback: OSRM public routing (no key required)
    try {
      const [oLat, oLng] = String(origin).split(',').map(Number);
      const [dLat, dLng] = String(destination).split(',').map(Number);
      if (![oLat, oLng, dLat, dLng].every(v => Number.isFinite(v))) {
        return res.status(400).json({ error: 'Invalid coordinates for routing' });
      }
      const osrmUrl = `https://router.project-osrm.org/route/v1/${mode}/` +
        `${oLng},${oLat};${dLng},${dLat}?overview=false&alternatives=false&annotations=duration,distance`;
      const osrm = await axios.get(osrmUrl);
      if (osrm?.data?.code !== 'Ok' || !osrm?.data?.routes?.length) {
        return res.status(400).json({ error: 'OSRM routing failed', message: osrm?.data?.message || 'No route' });
      }
      const r = osrm.data.routes[0];
      const meters = r.distance || 0;
      const seconds = r.duration || 0;
      const km = meters / 1000;
      const mins = Math.round(seconds / 60);
      return res.json({
        summary: 'OSRM route',
        distance: { text: `${km.toFixed(1)} km`, value: meters },
        duration: { text: `${mins} mins`, value: seconds },
        duration_in_traffic: null,
        start_address: origin,
        end_address: destination,
        steps: [],
        polyline: null,
        bounds: null,
        warnings: []
      });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to get directions', message: e.message });
    }
  } catch (error) {
    console.error('Directions API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to get directions',
      message: error.response?.data?.error_message || error.message
    });
  }
});

// Accommodations endpoint (Hotels/Lodging)
// Accepts either `location=lat,lng` or `query=free text`. Radius in meters.
router.get('/accommodations', async (req, res) => {
  try {
    const { location, query, radius = 3000, language = 'en' } = req.query;

    let center = location || null;

    // Resolve center from free-text using Google Geocoding, fallback to OSM Nominatim
    if (!center) {
      if (!query) return res.status(400).json({ error: 'Provide either location or query' });
      // Try multiple candidates for better geocoding (handles small towns and spelling variants)
      const original = decodeURIComponent(query || '');
      const variant = original.replace(/th/gi, 't'); // ananthapur -> anantapur
      const candidates = Array.from(new Set([
        original,
        `${original}, India`,
        variant,
        `${variant}, India`,
        /ananthapur/i.test(original) ? 'Anantapur, Andhra Pradesh, India' : null
      ].filter(Boolean)));

      // Google Geocoding first
      for (const addr of candidates) {
        try {
          const geocodeResp = await axios.get(`${GOOGLE_MAPS_BASE_URL}/geocode/json`, {
            params: { address: addr, key: GEOCODE_API_KEY, language }
          });
          if (geocodeResp.data.status === 'OK' && geocodeResp.data.results.length) {
            const loc = geocodeResp.data.results[0].geometry.location;
            center = `${loc.lat},${loc.lng}`;
            break;
          }
        } catch (_) { /* try next */ }
      }

      // OSM fallback if Google failed
      if (!center) {
        for (const addr of candidates) {
          try {
            const nominatim = await axios.get('https://nominatim.openstreetmap.org/search', {
              params: { format: 'jsonv2', q: addr, limit: 5 },
              headers: { 'User-Agent': 'Triptrackr/1.0 (contact@example.com)' }
            });
            if (Array.isArray(nominatim.data) && nominatim.data.length > 0) {
              const best = [...nominatim.data].sort((a, b) => (b.importance || 0) - (a.importance || 0))[0];
              center = `${best.lat},${best.lon}`;
              break;
            }
          } catch (_) { /* try next */ }
        }
      }
    }

    let hotels = [];

    // 1) Google Nearby Search with progressive radius (up to 25km) if we have a center
    if (center && PLACES_API_KEY) {
      const base = Number(radius) || 3000;
      const steps = [base, base * 2, base * 4, 25000];
      for (const r of steps) {
        try {
          const resp = await axios.get(`${GOOGLE_MAPS_BASE_URL}/place/nearbysearch/json`, {
            params: { key: PLACES_API_KEY, location: center, radius: Math.min(r, 25000), type: 'lodging', language }
          });
          if (resp?.data?.status === 'OK' && Array.isArray(resp.data.results) && resp.data.results.length) {
            hotels = (resp.data.results || []).map(place => ({
              place_id: place.place_id,
              name: place.name,
              address: place.vicinity || place.formatted_address,
              coordinates: {
                lat: place.geometry?.location?.lat,
                lng: place.geometry?.location?.lng
              },
              rating: place.rating,
              user_ratings_total: place.user_ratings_total,
              price_level: place.price_level,
              open_now: place.opening_hours?.open_now ?? null,
              photos: (place.photos || []).map(p => ({
                photo_reference: p.photo_reference,
                height: p.height,
                width: p.width
              }))
            }));
            break;
          }
        } catch (_) { /* next radius */ }
      }
    }

    // 2) Google Text Search (biased to center when available)
    if (!hotels.length && PLACES_API_KEY) {
      try {
        const resp = await axios.get(`${GOOGLE_MAPS_BASE_URL}/place/textsearch/json`, {
          params: center
            ? { key: PLACES_API_KEY, query: 'hotels', location: center, radius, language }
            : { key: PLACES_API_KEY, query: `hotels in ${decodeURIComponent(query || '')}`, language }
        });
        if (resp?.data?.status === 'OK') {
          hotels = (resp.data.results || []).map(place => ({
            place_id: place.place_id,
            name: place.name,
            address: place.vicinity || place.formatted_address,
            coordinates: {
              lat: place.geometry?.location?.lat,
              lng: place.geometry?.location?.lng
            },
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            price_level: place.price_level,
            open_now: place.opening_hours?.open_now ?? null,
            photos: (place.photos || []).map(p => ({
              photo_reference: p.photo_reference,
              height: p.height,
              width: p.width
            }))
          }));
        }
      } catch (_) {}
    }

    // 3) OSM Overpass fallback (requires center)
    if (!hotels.length && center) {
      try {
        const [latStr, lngStr] = center.split(',');
        // OSM conventions: accommodations are tagged under tourism
        const overpassTourism = '(hotel|guest_house|motel|hostel|apartment|chalet|resort|alpine_hut|camp_site|caravan_site)';
        const q = `
          [out:json][timeout:25];
          (
            node["tourism"~"${overpassTourism}"](around:${Number(radius)},${latStr},${lngStr});
            way["tourism"~"${overpassTourism}"](around:${Number(radius)},${latStr},${lngStr});
            relation["tourism"~"${overpassTourism}"](around:${Number(radius)},${latStr},${lngStr});
          );
          out center 40;
        `;
        const overpassResp = await axios.post(
          'https://overpass-api.de/api/interpreter',
          `data=${encodeURIComponent(q)}`,
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        const elements = overpassResp.data?.elements || [];
        hotels = elements.map(el => ({
          place_id: `lodging-${el.type}-${el.id}`,
          name: el.tags?.name || 'Hotel',
          address: [el.tags?.addr_housenumber, el.tags?.addr_street, el.tags?.addr_city, el.tags?.addr_postcode, el.tags?.addr_state]
            .filter(Boolean)
            .join(' ') || el.tags?.addr_full || el.tags?.['addr:full'] || 'Address not available',
          coordinates: {
            lat: el.lat || el.center?.lat,
            lng: el.lon || el.center?.lon
          },
          rating: null,
          user_ratings_total: null,
          price_level: null,
          open_now: null,
          photos: []
        }));
      } catch (_) {}
    }

    // 4) Nominatim bounded text search fallback (broad but resilient)
    if (!hotels.length && center) {
      try {
        const [lat, lng] = center.split(',').map(Number);
        const rKm = (Number(radius) || 5000) / 1000;
        const deltaLat = rKm / 111; // ~111km per degree latitude
        const deltaLng = rKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
        const viewbox = [
          (lng - deltaLng).toFixed(6), // left
          (lat + deltaLat).toFixed(6), // top
          (lng + deltaLng).toFixed(6), // right
          (lat - deltaLat).toFixed(6)  // bottom
        ].join(',');

        const queries = ['hotel', 'guest house', 'resort', 'hostel', 'lodging', 'motel', 'homestay'];
        const seen = new Set();
        let items = [];
        for (const q of queries) {
          const n = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { format: 'jsonv2', q, viewbox, bounded: 1, limit: 25 },
            headers: { 'User-Agent': 'Triptrackr/1.0 (contact@example.com)' }
          });
          for (const it of n.data || []) {
            const id = `${it.osm_type}-${it.osm_id}`;
            if (seen.has(id)) continue;
            seen.add(id);
            items.push({
              place_id: `osm-${id}`,
              name: it.display_name?.split(',')[0] || it.name || 'Hotel',
              address: it.display_name,
              coordinates: { lat: Number(it.lat), lng: Number(it.lon) },
              rating: null,
              user_ratings_total: null,
              price_level: null,
              open_now: null,
              photos: []
            });
          }
          if (items.length >= 25) break;
        }
        hotels = items;
      } catch (_) { /* still return possibly empty */ }
    }

    res.json({
      center: center || null,
      radius: Number(radius),
      results: hotels,
      total_results: hotels.length
    });
  } catch (error) {
    console.error('Accommodations API error:', error.response?.data || error.message);
    res.json({
      center: null,
      radius: Number(req.query?.radius || 3000),
      results: [],
      total_results: 0,
      note: 'Fallback empty response due to error',
      error: error.response?.data || error.message
    });
  }
});

module.exports = router;
 
// Nearby attractions around a location (query or lat,lng)
router.get('/nearby', async (req, res) => {
  try {
    const { query, location, radius = 5000, language = 'en', types, source } = req.query;

    // 1) Determine center point
    let center = location || null; // format: "lat,lng"

    if (!center) {
      const q = decodeURIComponent(query || '');
      if (!q) return res.status(400).json({ error: 'Provide either location or query' });

      // If query looks like coordinates "lat,lng", accept directly
      const coordMatch = /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(q);
      if (coordMatch) {
        center = q.replace(/\s+/g, '');
      } else {
        // Build candidates to improve small-town resolution, especially in India
        const variant = q.replace(/th/gi, 't');
        const candidates = Array.from(new Set([
          q,
          `${q}, India`,
          variant,
          `${variant}, India`,
          /ananthapur/i.test(q) ? 'Anantapur, Andhra Pradesh, India' : null
        ].filter(Boolean)));

        // Prefer Google Geocoding unless source forces OSM
        if (GEOCODE_API_KEY && String(source).toLowerCase() !== 'osm') {
          for (const addr of candidates) {
            try {
              const g = await axios.get(`${GOOGLE_MAPS_BASE_URL}/geocode/json`, {
                params: { address: addr, key: GEOCODE_API_KEY, language },
                timeout: 7000
              });
              if (g.data.status === 'OK' && g.data.results?.length) {
                const loc = g.data.results[0].geometry.location;
                center = `${loc.lat},${loc.lng}`;
                break;
              }
            } catch (_) { /* try next */ }
          }
        }

        // Fallback: OSM Nominatim over candidates
        if (!center) {
          for (const addr of candidates) {
            try {
              const n = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: { format: 'jsonv2', q: addr, limit: 3 },
                headers: { 'User-Agent': 'Triptrackr/1.0 (contact@example.com)' },
                timeout: 10000
              });
              if (Array.isArray(n.data) && n.data.length) {
                const best = [...n.data].sort((a, b) => (b.importance || 0) - (a.importance || 0))[0];
                center = `${best.lat},${best.lon}`;
                break;
              }
            } catch (_) { /* try next */ }
          }
        }
      }
    }

    if (!center) return res.status(400).json({ error: 'Unable to resolve location' });

    const desiredTypes = (types ? String(types) : 'tourist_attraction,park,museum,art_gallery,amusement_park,zoo,aquarium,point_of_interest,shopping_mall,church,hindu_temple,mosque,viewpoint,restaurant,cafe,fast_food,bar,night_club,hotel,lodging,food,food_court').split(',').map(t => t.trim()).filter(Boolean);
    let results = [];

    // 2) Try Google Places nearby searches when allowed
    if (PLACES_API_KEY && String(source).toLowerCase() !== 'osm') {
      const [lat, lng] = center.split(',');
      // Nearby search per type with de-duplication; run requests in parallel for speed
      const seen = new Set();
      const limitedTypes = desiredTypes.slice(0, 12); // cap to avoid overloading the API
      try {
        const requests = limitedTypes.map(t =>
          axios.get(`${GOOGLE_MAPS_BASE_URL}/place/nearbysearch/json`, {
            params: {
              key: PLACES_API_KEY,
              location: `${lat},${lng}`,
              radius: Math.min(Number(radius) || 5000, 25000),
              type: t,
              language
            },
            timeout: 7000
          }).then(resp => ({ t, resp })).catch(() => ({ t, resp: null }))
        );
        const responses = await Promise.all(requests);
        for (const { resp } of responses) {
          if (resp?.data?.results?.length) {
            for (const place of resp.data.results) {
              if (seen.has(place.place_id)) continue;
              seen.add(place.place_id);
              const mapped = {
                place_id: place.place_id,
                name: place.name,
                address: place.vicinity || place.formatted_address,
                coordinates: { lat: place.geometry?.location?.lat, lng: place.geometry?.location?.lng },
                rating: place.rating,
                user_ratings_total: place.user_ratings_total,
                types: place.types,
                price_level: place.price_level,
                opening_hours: place.opening_hours ? { open_now: place.opening_hours.open_now } : null,
                photos: (place.photos || []).map(p => ({ photo_reference: p.photo_reference, height: p.height, width: p.width })),
                icon: place.icon,
                icon_background_color: place.icon_background_color,
                icon_mask_base_uri: place.icon_mask_base_uri
              };
              if (!isAdministrativeTypes(mapped.types)) results.push(mapped);
            }
          }
        }
      } catch (_) { /* ignore – fall through to OSM */ }

      // If we found anything via Google, return quickly
      if (results.length) {
        return res.json({ center, radius: Number(radius), results, total_results: results.length, source: 'GOOGLE' });
      }
    }

    // 3) Fallback: OSM Overpass for attractions-style features
    try {
      const [latStr, lngStr] = center.split(',');
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["tourism"~"attraction|museum|gallery|viewpoint"](around:${Number(radius)},${latStr},${lngStr});
          way["tourism"~"attraction|museum|gallery|viewpoint"](around:${Number(radius)},${latStr},${lngStr});
          node["leisure"~"park|garden"](around:${Number(radius)},${latStr},${lngStr});
          way["leisure"~"park|garden"](around:${Number(radius)},${latStr},${lngStr});
          node["historic"](around:${Number(radius)},${latStr},${lngStr});
          way["historic"](around:${Number(radius)},${latStr},${lngStr});
          node["natural"~"peak|volcano|waterfall"](around:${Number(radius)},${latStr},${lngStr});
          node["amenity"~"restaurant|cafe|fast_food|bar|pub|food_court"](around:${Number(radius)},${latStr},${lngStr});
          way["amenity"~"restaurant|cafe|fast_food|bar|pub|food_court"](around:${Number(radius)},${latStr},${lngStr});
          node["tourism"~"hotel|guest_house|motel"](around:${Number(radius)},${latStr},${lngStr});
          way["tourism"~"hotel|guest_house|motel"](around:${Number(radius)},${latStr},${lngStr});
          node["amenity"="place_of_worship"](around:${Number(radius)},${latStr},${lngStr});
        );
        out center 60;
      `;
      const overpassResp = await axios.post(
        'https://overpass-api.de/api/interpreter',
        `data=${encodeURIComponent(overpassQuery)}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const elements = overpassResp.data?.elements || [];
      const mappedRaw = elements.map(el => ({
        place_id: `osm-${el.type}-${el.id}`,
        name: el.tags?.name || el.tags?.['name:en'] || 'Attraction',
        address: [el.tags?.addr_housenumber, el.tags?.addr_street, el.tags?.addr_city].filter(Boolean).join(' ') || el.tags?.addr_full || '',
        coordinates: { lat: el.lat || el.center?.lat, lng: el.lon || el.center?.lon },
        rating: null,
        user_ratings_total: null,
        types: [el.tags?.tourism, el.tags?.historic, el.tags?.natural, el.tags?.leisure, el.tags?.amenity].filter(Boolean),
        price_level: null,
        opening_hours: null,
        photos: []
      }));
      const mapped = mappedRaw.filter(p => !isAdministrativeTypes(p.types));
      if (mapped.length) {
        return res.json({ center, radius: Number(radius), results: mapped, total_results: mapped.length, source: 'OSM' });
      }
    } catch (error) {
      // continue to Nominatim bbox fallback
    }

    // 4) Nominatim bounded search fallback (less detailed but resilient)
    try {
      const [lat, lng] = center.split(',').map(Number);
      const rKm = (Number(radius) || 5000) / 1000;
      const deltaLat = rKm / 111; // ~111km per degree latitude
      const deltaLng = rKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
      const viewbox = [
        (lng - deltaLng).toFixed(6), // left
        (lat + deltaLat).toFixed(6), // top
        (lng + deltaLng).toFixed(6), // right
        (lat - deltaLat).toFixed(6)  // bottom
      ].join(',');

      const queries = ['tourist attraction', 'park', 'museum', 'zoo', 'aquarium', 'viewpoint', 'garden', 'historic', 'restaurant', 'hotel'];
      const seen = new Set();
      let items = [];
      for (const q of queries) {
        const n = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: { format: 'jsonv2', q, viewbox, bounded: 1, limit: 20 },
          headers: { 'User-Agent': 'Triptrackr/1.0 (contact@example.com)' }
        });
        for (const it of n.data || []) {
          const id = `${it.osm_type}-${it.osm_id}`;
          if (seen.has(id)) continue;
          seen.add(id);
          const item = {
            place_id: `osm-${id}`,
            name: it.display_name?.split(',')[0] || it.name || 'Attraction',
            address: it.display_name,
            coordinates: { lat: Number(it.lat), lng: Number(it.lon) },
            rating: null,
            user_ratings_total: null,
            types: [it.type, it.class].filter(Boolean),
            price_level: null,
            opening_hours: null,
            photos: []
          };
          if (!isAdministrativeTypes(item.types)) items.push(item);
        }
        if (items.length >= 25) break;
      }
      return res.json({ center, radius: Number(radius), results: items, total_results: items.length, source: 'OSM-NOMINATIM' });
    } catch (_) {
      // Final safety: return empty but 200 to avoid breaking client
      return res.json({ center, radius: Number(radius), results: [], total_results: 0, source: 'NONE' });
    }
  } catch (error) {
    console.error('Nearby API error:', error.response?.data || error.message);
    res.json({ center: null, radius: Number(req.query?.radius || 5000), results: [], total_results: 0, source: 'ERROR', error: error.message });
  }
});
