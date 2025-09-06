const express = require('express');
const axios = require('axios');
const router = express.Router();

// Keys configured explicitly per capability (env overrides supported)
const GEOCODE_API_KEY = process.env.GEOCODE_API_KEY || '4e49cdce023949f08e555125a6051ec0';
const PLACES_API_KEY = process.env.PLACES_API_KEY || 'bc9631046a1749ed8e76ac537e7c0d1f';
const ROUTING_API_KEY = process.env.ROUTING_API_KEY || 'f054da866cac404d8fe0ffacfc63da1a';
const GOOGLE_MAPS_BASE_URL = 'https://maps.googleapis.com/maps/api';

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
      opennow = false
    } = req.query;

    if (!PLACES_API_KEY) {
      return res.status(500).json({ error: 'Places API key not configured' });
    }

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

    const response = await axios.get(`${GOOGLE_MAPS_BASE_URL}/place/textsearch/json`, {
      params
    });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      return res.status(400).json({ 
        error: 'Places search failed', 
        status: response.data.status,
        message: response.data.error_message || 'Unable to search places'
      });
    }

    const places = response.data.results.map(place => ({
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

    res.json({
      query: decodeURIComponent(query),
      results: places,
      total_results: places.length,
      status: response.data.status,
      next_page_token: response.data.next_page_token
    });

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

    if (!PLACES_API_KEY) {
      return res.status(500).json({ error: 'Places API key not configured' });
    }

    const response = await axios.get(`${GOOGLE_MAPS_BASE_URL}/place/details/json`, {
      params: {
        place_id: placeId,
        key: PLACES_API_KEY,
        language,
        fields
      }
    });

    if (response.data.status !== 'OK') {
      return res.status(400).json({ 
        error: 'Place details failed', 
        status: response.data.status,
        message: response.data.error_message || 'Unable to get place details'
      });
    }

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

    res.json(placeDetails);
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

    if (!ROUTING_API_KEY) {
      return res.status(500).json({ error: 'Routing API key not configured' });
    }

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }

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

    if (avoid) {
      params.avoid = avoid;
    }

    const response = await axios.get(`${GOOGLE_MAPS_BASE_URL}/directions/json`, {
      params
    });

    if (response.data.status !== 'OK') {
      return res.status(400).json({ 
        error: 'Directions failed', 
        status: response.data.status,
        message: response.data.error_message || 'Unable to get directions'
      });
    }

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

    res.json(directions);
  } catch (error) {
    console.error('Directions API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to get directions',
      message: error.response?.data?.error_message || error.message
    });
  }
});

// Restaurants-only accommodations endpoint
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

    let restaurants = [];

    // 1) Google Nearby Search with progressive radius (up to 25km) if we have a center
    if (center && PLACES_API_KEY) {
      const base = Number(radius) || 3000;
      const steps = [base, base * 2, base * 4, 25000];
      for (const r of steps) {
        try {
          const resp = await axios.get(`${GOOGLE_MAPS_BASE_URL}/place/nearbysearch/json`, {
            params: { key: PLACES_API_KEY, location: center, radius: Math.min(r, 25000), type: 'restaurant', language }
          });
          if (resp?.data?.status === 'OK' && Array.isArray(resp.data.results) && resp.data.results.length) {
            restaurants = (resp.data.results || []).map(place => ({
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
    if (!restaurants.length && PLACES_API_KEY) {
      try {
        const resp = await axios.get(`${GOOGLE_MAPS_BASE_URL}/place/textsearch/json`, {
          params: center
            ? { key: PLACES_API_KEY, query: 'restaurants', location: center, radius, language }
            : { key: PLACES_API_KEY, query: `restaurants in ${decodeURIComponent(query || '')}`, language }
        });
        if (resp?.data?.status === 'OK') {
          restaurants = (resp.data.results || []).map(place => ({
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
    if (!restaurants.length && center) {
      try {
        const [latStr, lngStr] = center.split(',');
        const overpassAmenity = '(restaurant|cafe|fast_food)';
        const q = `
          [out:json][timeout:25];
          (
            node["amenity"~"${overpassAmenity}"](around:${Number(radius)},${latStr},${lngStr});
            way["amenity"~"${overpassAmenity}"](around:${Number(radius)},${latStr},${lngStr});
            relation["amenity"~"${overpassAmenity}"](around:${Number(radius)},${latStr},${lngStr});
          );
          out center 40;
        `;
        const overpassResp = await axios.post(
          'https://overpass-api.de/api/interpreter',
          `data=${encodeURIComponent(q)}`,
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        const elements = overpassResp.data?.elements || [];
        restaurants = elements.map(el => ({
          place_id: `restaurant-${el.type}-${el.id}`,
          name: el.tags?.name || 'Restaurant',
          address: [el.tags?.addr_housenumber, el.tags?.addr_street, el.tags?.addr_city]
            .filter(Boolean)
            .join(' ') || el.tags?.addr_full || 'Address not available',
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

    res.json({
      center: center || null,
      radius: Number(radius),
      results: restaurants,
      total_results: restaurants.length
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
