const express = require('express');
const axios = require('axios');
const router = express.Router();

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '53dc5c51948a0d1c9b0275dfa448d361';
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const OPEN_METEO_GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

function evaluateVisitability({ temperature, precipitationProbability, windSpeed, description }) {
  // Basic heuristic; can be extended later
  const tempOk = temperature != null && temperature >= 10 && temperature <= 35; // comfortable range
  const rainOk = (precipitationProbability == null) || precipitationProbability <= 60; // low-to-moderate rain chance
  const windOk = (windSpeed == null) || windSpeed <= 12; // ~12 m/s (~27 mph) upper comfort
  const severe = (description || '').toLowerCase().includes('thunder') || (description || '').toLowerCase().includes('storm');

  const isOk = tempOk && rainOk && windOk && !severe;
  const message = isOk
    ? 'Yes, it is okay to visit now.'
    : 'Sorry, it is not the best time to visit now.';
  return { is_ok_to_visit: isOk, note: message };
}

async function geocodeWithOpenMeteo(city) {
  const resp = await axios.get(OPEN_METEO_GEOCODE_URL, {
    params: { name: city, count: 1 }
  });
  const place = Array.isArray(resp.data?.results) ? resp.data.results[0] : null;
  if (!place) return null;
  return { lat: place.latitude, lon: place.longitude, name: place.name, country: place.country_code };
}

// Get current weather for a city
router.get('/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { units = 'metric', lang = 'en' } = req.query;

    if (!OPENWEATHER_API_KEY) {
      return res.status(500).json({ error: 'Weather API key not configured' });
    }

    let response;
    try {
      // Prefer exact-location weather by first resolving coordinates via OpenWeather Geocoding
      let lat = null;
      let lon = null;
      let resolvedName = null;
      let resolvedCountry = null;
      try {
        const geoResp = await axios.get('https://api.openweathermap.org/geo/1.0/direct', {
          params: { q: city, limit: 1, appid: OPENWEATHER_API_KEY }
        });
        if (Array.isArray(geoResp.data) && geoResp.data.length > 0) {
          lat = geoResp.data[0].lat;
          lon = geoResp.data[0].lon;
          resolvedName = geoResp.data[0].name || null;
          resolvedCountry = geoResp.data[0].country || null;
        }
      } catch (_) { /* fall back to city query below */ }

      if (lat != null && lon != null) {
        response = await axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
          params: { lat, lon, appid: OPENWEATHER_API_KEY, units, lang }
        });
        // Attach resolved names if available
        if (resolvedName) {
          response.data.name = resolvedName;
        }
        if (resolvedCountry) {
          response.data.sys = { ...(response.data.sys || {}), country: resolvedCountry };
        }
      } else {
        // Fallback: city-name query (less precise)
        response = await axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
          params: { q: city, appid: OPENWEATHER_API_KEY, units, lang }
        });
      }
    } catch (e) {
      // Fallback to Open-Meteo when OpenWeather key is invalid
      if (e?.response?.status === 401) {
        const geo = await geocodeWithOpenMeteo(city);
        if (!geo) return res.status(400).json({ error: 'City not found' });
        const om = await axios.get(OPEN_METEO_BASE_URL, {
          params: {
            latitude: geo.lat,
            longitude: geo.lon,
            current_weather: true
          }
        });
        const cw = om.data?.current_weather;
        const current = cw ? {
          temperature: cw.temperature,
          feels_like: cw.temperature,
          humidity: null,
          pressure: null,
          description: 'Current conditions',
          icon: null,
          wind_speed: cw.windspeed,
          wind_direction: cw.winddirection,
          visibility: null,
          sunrise: null,
          sunset: null
        } : null;

        const visit = evaluateVisitability({
          temperature: current?.temperature,
          precipitationProbability: null,
          windSpeed: current?.wind_speed,
          description: current?.description
        });

        return res.json({
          city: geo.name,
          country: geo.country,
          coordinates: { lat: geo.lat, lon: geo.lon },
          current,
          visitability: visit,
          timestamp: new Date()
        });
      }
      throw e;
    }

    const weatherData = {
      city: response.data.name,
      country: response.data.sys.country,
      coordinates: {
        lat: response.data.coord.lat,
        lon: response.data.coord.lon
      },
      current: {
        temperature: response.data.main.temp,
        feels_like: response.data.main.feels_like,
        humidity: response.data.main.humidity,
        pressure: response.data.main.pressure,
        description: response.data.weather[0].description,
        icon: response.data.weather[0].icon,
        wind_speed: response.data.wind.speed,
        wind_direction: response.data.wind.deg,
        visibility: response.data.visibility,
        sunrise: new Date(response.data.sys.sunrise * 1000),
        sunset: new Date(response.data.sys.sunset * 1000)
      },
      timestamp: new Date(response.data.dt * 1000)
    };

    // Visitability for current weather
    weatherData.visitability = evaluateVisitability({
      temperature: weatherData.current.temperature,
      precipitationProbability: null,
      windSpeed: weatherData.current.wind_speed,
      description: weatherData.current.description
    });

    res.json(weatherData);
  } catch (error) {
    console.error('Weather API error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'City not found' });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch weather data',
      message: error.response?.data?.message || error.message
    });
  }
});

// Get current weather by coordinates for higher accuracy (preferred with places)
router.get('/by-coords/current', async (req, res) => {
  try {
    const { lat, lon, units = 'metric', lang = 'en' } = req.query;
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      return res.status(400).json({ error: 'Valid lat and lon are required' });
    }

    // Use OpenWeather if API key is available
    if (OPENWEATHER_API_KEY) {
      const ow = await axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
        params: { lat: latNum, lon: lonNum, appid: OPENWEATHER_API_KEY, units, lang }
      });
      const data = ow.data;
      return res.json({
        city: data.name,
        country: data.sys?.country,
        coordinates: { lat: data.coord?.lat, lon: data.coord?.lon },
        current: {
          temperature: data.main?.temp,
          feels_like: data.main?.feels_like,
          humidity: data.main?.humidity,
          pressure: data.main?.pressure,
          description: data.weather?.[0]?.description,
          icon: data.weather?.[0]?.icon,
          wind_speed: data.wind?.speed,
          wind_direction: data.wind?.deg,
          visibility: data.visibility,
          sunrise: data.sys?.sunrise ? new Date(data.sys.sunrise * 1000) : null,
          sunset: data.sys?.sunset ? new Date(data.sys.sunset * 1000) : null
        },
        timestamp: new Date(data.dt * 1000),
        visitability: evaluateVisitability({
          temperature: data.main?.temp,
          precipitationProbability: null,
          windSpeed: data.wind?.speed,
          description: data.weather?.[0]?.description
        })
      });
    }

    // Fallback: Open-Meteo if no OpenWeather key
    const om = await axios.get(OPEN_METEO_BASE_URL, {
      params: { latitude: latNum, longitude: lonNum, current_weather: true }
    });
    const cw = om.data?.current_weather;
    const current = cw ? {
      temperature: cw.temperature,
      feels_like: cw.temperature,
      humidity: null,
      pressure: null,
      description: 'Current conditions',
      icon: null,
      wind_speed: cw.windspeed,
      wind_direction: cw.winddirection,
      visibility: null,
      sunrise: null,
      sunset: null
    } : null;

    return res.json({
      city: null,
      country: null,
      coordinates: { lat: latNum, lon: lonNum },
      current,
      visitability: evaluateVisitability({
        temperature: current?.temperature,
        precipitationProbability: null,
        windSpeed: current?.wind_speed,
        description: current?.description
      }),
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Weather by-coords current API error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch weather by coordinates', message: error.response?.data?.message || error.message });
  }
});

// Get 5-day forecast by coordinates
router.get('/by-coords/forecast', async (req, res) => {
  try {
    const { lat, lon, units = 'metric', lang = 'en' } = req.query;
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      return res.status(400).json({ error: 'Valid lat and lon are required' });
    }

    if (OPENWEATHER_API_KEY) {
      const ow = await axios.get(`${OPENWEATHER_BASE_URL}/forecast`, {
        params: { lat: latNum, lon: lonNum, appid: OPENWEATHER_API_KEY, units, lang }
      });

      const dailyForecasts = {};
      const cityInfo = {
        name: ow.data.city?.name,
        country: ow.data.city?.country,
        coordinates: { lat: ow.data.city?.coord?.lat, lon: ow.data.city?.coord?.lon }
      };

      (ow.data.list || []).forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayKey = date.toISOString().split('T')[0];
        if (!dailyForecasts[dayKey]) {
          dailyForecasts[dayKey] = {
            date: dayKey,
            day_name: date.toLocaleDateString('en-US', { weekday: 'long' }),
            forecasts: []
          };
        }
        dailyForecasts[dayKey].forecasts.push({
          time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          temperature: item.main?.temp,
          feels_like: item.main?.feels_like,
          humidity: item.main?.humidity,
          description: item.weather?.[0]?.description,
          icon: item.weather?.[0]?.icon,
          wind_speed: item.wind?.speed,
          precipitation_probability: (item.pop || 0) * 100
        });
      });

      const processed = Object.values(dailyForecasts).map(day => {
        const temps = day.forecasts.map(f => f.temperature).filter(v => typeof v === 'number');
        const humidities = day.forecasts.map(f => f.humidity).filter(v => typeof v === 'number');
        const precipProbs = day.forecasts.map(f => f.precipitation_probability).filter(v => typeof v === 'number');
        const avgTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
        const avgHumidity = humidities.length ? humidities.reduce((a, b) => a + b, 0) / humidities.length : null;
        const maxPrecip = precipProbs.length ? Math.max(...precipProbs) : 0;
        const summary = {
          avg_temperature: avgTemp != null ? Math.round(avgTemp * 10) / 10 : null,
          avg_humidity: avgHumidity != null ? Math.round(avgHumidity) : null,
          max_precipitation_probability: Math.round(maxPrecip),
          recommendations: []
        };
        if (avgTemp != null) {
          if (avgTemp < 10) summary.recommendations.push('Pack warm clothing');
          if (avgTemp > 25) summary.recommendations.push('Pack light clothing and sunscreen');
        }
        if (maxPrecip > 70) summary.recommendations.push('High chance of rain - pack umbrella/raincoat');
        summary.visitability = evaluateVisitability({
          temperature: summary.avg_temperature,
          precipitationProbability: summary.max_precipitation_probability,
          windSpeed: null,
          description: day.forecasts.find(f => f.description)?.description || ''
        });
        return { ...day, summary };
      });

      return res.json({ city: cityInfo, forecast: processed, generated_at: new Date().toISOString() });
    }

    // Fallback: Open-Meteo
    const om = await axios.get(OPEN_METEO_BASE_URL, {
      params: {
        latitude: latNum,
        longitude: lonNum,
        timezone: 'auto',
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,windspeed_10m_max'
      }
    });
    const days = (om.data?.daily?.time || []).slice(0, 5).map((date, idx) => ({
      date,
      day_name: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
      forecasts: [],
      summary: {
        avg_temperature: (Number(om.data.daily.temperature_2m_max[idx]) + Number(om.data.daily.temperature_2m_min[idx])) / 2,
        avg_humidity: null,
        max_precipitation_probability: Number(om.data.daily.precipitation_probability_max?.[idx] ?? 0),
        recommendations: []
      }
    }));
    days.forEach(d => {
      const rec = [];
      if (d.summary.avg_temperature < 10) rec.push('Pack warm clothing');
      if (d.summary.avg_temperature > 25) rec.push('Pack light clothing and sunscreen');
      if ((d.summary.max_precipitation_probability || 0) > 70) rec.push('High chance of rain - pack umbrella/raincoat');
      d.summary.recommendations = rec;
      d.summary.visitability = evaluateVisitability({
        temperature: d.summary.avg_temperature,
        precipitationProbability: d.summary.max_precipitation_probability,
        windSpeed: null,
        description: ''
      });
    });
    return res.json({ city: { name: null, country: null, coordinates: { lat: latNum, lon: lonNum } }, forecast: days, generated_at: new Date().toISOString() });
  } catch (error) {
    console.error('Weather by-coords forecast API error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch forecast by coordinates', message: error.response?.data?.message || error.message });
  }
});

// Get 5-day weather forecast for a city
router.get('/forecast/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { units = 'metric', lang = 'en' } = req.query;

    if (!OPENWEATHER_API_KEY) {
      return res.status(500).json({ error: 'Weather API key not configured' });
    }

    let response;
    try {
      // Prefer coordinates for forecast as well to align with current weather location
      let lat = null;
      let lon = null;
      let resolvedName = null;
      let resolvedCountry = null;
      try {
        const geoResp = await axios.get('https://api.openweathermap.org/geo/1.0/direct', {
          params: { q: city, limit: 1, appid: OPENWEATHER_API_KEY }
        });
        if (Array.isArray(geoResp.data) && geoResp.data.length > 0) {
          lat = geoResp.data[0].lat;
          lon = geoResp.data[0].lon;
          resolvedName = geoResp.data[0].name || null;
          resolvedCountry = geoResp.data[0].country || null;
        }
      } catch (_) { /* fall back to city query below */ }

      if (lat != null && lon != null) {
        response = await axios.get(`${OPENWEATHER_BASE_URL}/forecast`, {
          params: { lat, lon, appid: OPENWEATHER_API_KEY, units, lang }
        });
        if (!response.data.city) response.data.city = {};
        if (resolvedName) response.data.city.name = resolvedName;
        if (resolvedCountry) response.data.city.country = resolvedCountry;
        if (!response.data.city.coord && lat != null && lon != null) {
          response.data.city.coord = { lat, lon };
        }
      } else {
        response = await axios.get(`${OPENWEATHER_BASE_URL}/forecast`, {
          params: { q: city, appid: OPENWEATHER_API_KEY, units, lang }
        });
      }
    } catch (e) {
      if (e?.response?.status === 401) {
        // Open-Meteo 5-day (7-day) daily forecast fallback
        const geo = await geocodeWithOpenMeteo(city);
        if (!geo) return res.status(400).json({ error: 'City not found' });
        const om = await axios.get(OPEN_METEO_BASE_URL, {
          params: {
            latitude: geo.lat,
            longitude: geo.lon,
            timezone: 'auto',
            daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,windspeed_10m_max'
          }
        });
        const days = (om.data?.daily?.time || []).slice(0, 5).map((date, idx) => ({
          date,
          day_name: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
          forecasts: [],
          summary: {
            avg_temperature: (Number(om.data.daily.temperature_2m_max[idx]) + Number(om.data.daily.temperature_2m_min[idx])) / 2,
            avg_humidity: null,
            max_precipitation_probability: Number(om.data.daily.precipitation_probability_max?.[idx] ?? 0),
            recommendations: [],
            visitability: evaluateVisitability({
              temperature: (Number(om.data.daily.temperature_2m_max[idx]) + Number(om.data.daily.temperature_2m_min[idx])) / 2,
              precipitationProbability: Number(om.data.daily.precipitation_probability_max?.[idx] ?? 0),
              windSpeed: Number(om.data.daily.windspeed_10m_max?.[idx] ?? null),
              description: ''
            })
          }
        }));
        // Notes
        days.forEach(d => {
          const rec = [];
          if (d.summary.avg_temperature < 10) rec.push('Pack warm clothing');
          if (d.summary.avg_temperature > 25) rec.push('Pack light clothing and sunscreen');
          if ((d.summary.max_precipitation_probability || 0) > 70) rec.push('High chance of rain - pack umbrella/raincoat');
          d.summary.recommendations = rec;
        });
        return res.json({ city: { name: geo.name, country: geo.country, coordinates: { lat: geo.lat, lon: geo.lon } }, forecast: days, generated_at: new Date().toISOString() });
      }
      throw e;
    }

    // Group forecast data by day
    const dailyForecasts = {};
    const cityInfo = {
      name: response.data.city.name,
      country: response.data.city.country,
      coordinates: {
        lat: response.data.city.coord.lat,
        lon: response.data.city.coord.lon
      }
    };

    response.data.list.forEach(item => {
      const date = new Date(item.dt * 1000);
      const dayKey = date.toISOString().split('T')[0];
      
      if (!dailyForecasts[dayKey]) {
        dailyForecasts[dayKey] = {
          date: dayKey,
          day_name: date.toLocaleDateString('en-US', { weekday: 'long' }),
          forecasts: []
        };
      }

      dailyForecasts[dayKey].forecasts.push({
        time: date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        temperature: item.main.temp,
        feels_like: item.main.feels_like,
        humidity: item.main.humidity,
        description: item.weather[0].description,
        icon: item.weather[0].icon,
        wind_speed: item.wind.speed,
        precipitation_probability: item.pop * 100
      });
    });

    // Calculate daily averages and recommendations
    const processedForecasts = Object.values(dailyForecasts).map(day => {
      const temps = day.forecasts.map(f => f.temperature);
      const humidities = day.forecasts.map(f => f.humidity);
      const precipProbs = day.forecasts.map(f => f.precipitation_probability);
      
      const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
      const avgHumidity = humidities.reduce((a, b) => a + b, 0) / humidities.length;
      const maxPrecipProb = Math.max(...precipProbs);
      
      // Weather-based recommendations
      let recommendations = [];
      if (avgTemp < 10) recommendations.push('Pack warm clothing');
      if (avgTemp > 25) recommendations.push('Pack light clothing and sunscreen');
      if (maxPrecipProb > 70) recommendations.push('High chance of rain - pack umbrella/raincoat');
      if (avgHumidity > 80) recommendations.push('High humidity - stay hydrated');
      
      const daySummary = {
        ...day,
        summary: {
          avg_temperature: Math.round(avgTemp * 10) / 10,
          avg_humidity: Math.round(avgHumidity),
          max_precipitation_probability: Math.round(maxPrecipProb),
          recommendations
        }
      };

      daySummary.summary.visitability = evaluateVisitability({
        temperature: daySummary.summary.avg_temperature,
        precipitationProbability: daySummary.summary.max_precipitation_probability,
        windSpeed: null,
        description: day.forecasts.find(f => f.description)?.description || ''
      });

      return daySummary;
    });

    res.json({
      city: cityInfo,
      forecast: processedForecasts,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Weather forecast API error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'City not found' });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch weather forecast',
      message: error.response?.data?.message || error.message
    });
  }
});

// Get weather alerts for a city (if available)
router.get('/alerts/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { units = 'metric', lang = 'en' } = req.query;

    if (!OPENWEATHER_API_KEY) {
      return res.status(500).json({ error: 'Weather API key not configured' });
    }

    // Step 1: Resolve city to coordinates using current weather endpoint
    const currentWeather = await axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
      params: {
        q: city,
        appid: OPENWEATHER_API_KEY,
        units,
        lang
      }
    });

    const { lat, lon } = {
      lat: currentWeather.data.coord.lat,
      lon: currentWeather.data.coord.lon
    };

    // Step 2: Fetch alerts using One Call API with coordinates
    const oneCallResponse = await axios.get(`${OPENWEATHER_BASE_URL}/onecall`, {
      params: {
        lat,
        lon,
        appid: OPENWEATHER_API_KEY,
        units,
        lang,
        exclude: 'current,minutely,hourly,daily'
      }
    });

    const alerts = oneCallResponse.data.alerts || [];

    res.json({
      city: currentWeather.data.name,
      coordinates: { lat, lon },
      alerts: alerts.map(alert => ({
        event: alert.event,
        description: alert.description,
        start: alert.start ? new Date(alert.start * 1000) : null,
        end: alert.end ? new Date(alert.end * 1000) : null,
        severity: Array.isArray(alert.tags) && alert.tags.length > 0 ? alert.tags[0] : 'Unknown',
        sender: alert.sender_name || undefined
      })),
      has_alerts: alerts.length > 0
    });

  } catch (error) {
    console.error('Weather alerts API error:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'City not found' });
    }
    res.status(500).json({ 
      error: 'Failed to fetch weather alerts',
      message: error.response?.data?.message || error.message
    });
  }
});

// Text-to-Speech for weather visitability note
router.post('/tts', async (req, res) => {
  try {
    const { text, voice = 'alloy', format = 'mp3', model = 'gpt-4o-mini-tts' } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const ttsResponse = await axios.post(
      OPENAI_TTS_URL,
      {
        model,
        input: text,
        voice,
        format
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    const contentType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'no-store');
    res.send(Buffer.from(ttsResponse.data));
  } catch (error) {
    console.error('TTS API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to synthesize speech',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

module.exports = router;
