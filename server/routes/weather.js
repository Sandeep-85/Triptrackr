const express = require('express');
const axios = require('axios');
const router = express.Router();

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '53dc5c51948a0d1c9b0275dfa448d361';
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const OPEN_METEO_GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

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
      response = await axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
        params: { q: city, appid: OPENWEATHER_API_KEY, units, lang }
      });
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
        return res.json({
          city: geo.name,
          country: geo.country,
          coordinates: { lat: geo.lat, lon: geo.lon },
          current: cw ? {
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
          } : null,
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
      response = await axios.get(`${OPENWEATHER_BASE_URL}/forecast`, {
        params: { q: city, appid: OPENWEATHER_API_KEY, units, lang }
      });
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
            recommendations: []
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
      
      return {
        ...day,
        summary: {
          avg_temperature: Math.round(avgTemp * 10) / 10,
          avg_humidity: Math.round(avgHumidity),
          max_precipitation_probability: Math.round(maxPrecipProb),
          recommendations
        }
      };
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

module.exports = router;
