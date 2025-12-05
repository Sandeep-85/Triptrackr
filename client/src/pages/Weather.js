import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Cloud, Sun, CloudRain, CloudSnow, Wind, Thermometer, Droplets, Eye } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const Weather = () => {
  const [city, setCity] = useState('');
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState('metric');
  const audioUrlRef = useRef(null);

  const getWeatherIcon = (iconCode, description) => {
    const iconMap = {
      '01d': Sun,
      '01n': Sun,
      '02d': Cloud,
      '02n': Cloud,
      '03d': Cloud,
      '03n': Cloud,
      '04d': Cloud,
      '04n': Cloud,
      '09d': CloudRain,
      '09n': CloudRain,
      '10d': CloudRain,
      '10n': CloudRain,
      '11d': CloudRain,
      '11n': CloudRain,
      '13d': CloudSnow,
      '13n': CloudSnow,
      '50d': Cloud,
      '50n': Cloud,
    };
    
    return iconMap[iconCode] || Cloud;
  };

  const getWeatherData = useCallback(async () => {
    const latNum = (lat === null || lat === undefined || lat === '') ? null : Number(lat);
    const lonNum = (lon === null || lon === undefined || lon === '') ? null : Number(lon);
    const hasCoords = latNum !== null && lonNum !== null && Number.isFinite(latNum) && Number.isFinite(lonNum);
    if (!hasCoords && !city.trim()) {
      toast.error('Please enter a city name');
      return;
    }

    setLoading(true);
    try {
      if (hasCoords) {
        const params = new URLSearchParams({ lat: String(latNum), lon: String(lonNum), units });
        const currentResp = await axios.get(`/api/weather/by-coords/current?${params.toString()}`);
        setWeather(currentResp.data);
        const forecastResp = await axios.get(`/api/weather/by-coords/forecast?${params.toString()}`);
        setForecast(forecastResp.data);
        const label = new URLSearchParams(window.location.search).get('label');
        if (label) {
          // prefer user-provided label for display if present
          setCity(label);
        } else if (currentResp.data?.city) {
          setCity(currentResp.data.city);
        }
        toast.success('Weather data loaded for selected location');
      } else {
        // City-based fallback
        const weatherResponse = await axios.get(`/api/weather/${encodeURIComponent(city)}?units=${units}`);
        setWeather(weatherResponse.data);
        const forecastResponse = await axios.get(`/api/weather/forecast/${encodeURIComponent(city)}?units=${units}`);
        setForecast(forecastResponse.data);
        toast.success(`Weather data loaded for ${city}`);
      }
    } catch (error) {
      console.error('Weather API error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to fetch weather data';
      toast.error(errorMessage);
      setWeather(null);
      setForecast(null);
    } finally {
      setLoading(false);
    }
  }, [city, lat, lon, units]);

  // Auto-run when URL has ?city= and optional units
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const cityParam = params.get('city');
      const unitsParam = params.get('units');
      const latParam = params.get('lat');
      const lonParam = params.get('lon');
      if (cityParam) {
        setCity(cityParam);
        if (unitsParam === 'metric' || unitsParam === 'imperial') {
          setUnits(unitsParam);
        }
        // Trigger fetch after state updates flush
        setTimeout(() => {
          getWeatherData();
        }, 0);
      } else if (latParam && lonParam) {
        setLat(Number(latParam));
        setLon(Number(lonParam));
        if (unitsParam === 'metric' || unitsParam === 'imperial') {
          setUnits(unitsParam);
        }
        // trigger fetch for coords
        setTimeout(() => {
          getWeatherData();
        }, 0);
      }
    } catch (e) {
      // noop
    }
  }, [getWeatherData]);

  // Cleanup any created object URLs on unmount
  useEffect(() => {
    return () => {
      try {
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
      } catch (_) {}
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    getWeatherData();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTemperatureUnit = () => units === 'metric' ? '°C' : '°F';
  const getSpeedUnit = () => units === 'metric' ? 'm/s' : 'mph';

  const speakText = async (text) => {
    if (!text) return;
    try {
      const resp = await axios.post(
        '/api/weather/tts',
        { text, voice: 'alloy', format: 'mp3' },
        { responseType: 'blob' }
      );
      const blob = new Blob([resp.data], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      await audio.play();
    } catch (e) {
      // Backend TTS failed – try browser TTS as a fallback
      try {
        if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          window.speechSynthesis.speak(utterance);
          toast('Using browser speech as fallback');
          return;
        }
      } catch (_) {
        // ignore fallback errors
      }
      let serverMsg = 'Failed to play voice note';
      try {
        if (e?.response?.data) {
          const errText = await e.response.data.text?.();
          if (errText) serverMsg = errText;
        }
      } catch (_) {}
      toast.error(serverMsg);
      console.error('TTS error:', e);
    }
  };

  return (
    <div className="weather-page">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Weather Intelligence
        </h1>
        <p className="text-lg text-gray-600">
          Get real-time weather forecasts and plan your activities accordingly
        </p>
      </div>

      {/* Search Form */}
      <div className="card mb-8">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Enter city name..."
              className="form-input text-lg"
              disabled={loading}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className="form-select"
              disabled={loading}
            >
              <option value="metric">Metric (°C, m/s)</option>
              <option value="imperial">Imperial (°F, mph)</option>
            </select>
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
          </div>
        </form>
      </div>

      {/* Current Weather */}
      {weather && (
        <div className="card weather-card mb-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">{weather.city}, {weather.country}</h2>
            <p className="text-lg opacity-90 mb-6">
              {new Date(weather.timestamp).toLocaleString()}
            </p>
            {weather.visitability && (
              <div className={`mb-4 text-sm font-medium ${weather.visitability.is_ok_to_visit ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'} inline-block px-3 py-2 rounded`}>
                {weather.visitability.note}
              </div>
            )}
            {weather.visitability && (
              <div className="mb-4">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => speakText(weather.visitability.note)}
                >
                  Play Note
                </button>
              </div>
            )}
            
            <div className="weather-icon mb-4">
              {(() => {
                const Icon = getWeatherIcon(weather.current.icon, weather.current.description);
                return <Icon size={64} />;
              })()}
            </div>
            
            <div className="weather-temp">
              {Number(weather.current.temperature).toFixed(1)}{getTemperatureUnit()}
            </div>
            
            <div className="weather-desc mb-6">
              {weather.current.description.charAt(0).toUpperCase() + weather.current.description.slice(1)}
            </div>
            
            <div className="weather-details">
              <div className="weather-detail">
                <Thermometer size={20} className="mx-auto mb-1" />
                <div className="weather-detail-label">Feels Like</div>
                <div className="weather-detail-value">
                  {Number(weather.current.feels_like).toFixed(1)}{getTemperatureUnit()}
                </div>
              </div>
              
              <div className="weather-detail">
                <Droplets size={20} className="mx-auto mb-1" />
                <div className="weather-detail-label">Humidity</div>
                <div className="weather-detail-value">{weather.current.humidity}%</div>
              </div>
              
              <div className="weather-detail">
                <Wind size={20} className="mx-auto mb-1" />
                <div className="weather-detail-label">Wind</div>
                <div className="weather-detail-value">
                  {weather.current.wind_speed} {getSpeedUnit()}
                </div>
              </div>
              
              <div className="weather-detail">
                <Eye size={20} className="mx-auto mb-1" />
                <div className="weather-detail-label">Visibility</div>
                <div className="weather-detail-value">
                  {(weather.current.visibility / 1000).toFixed(1)} km
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5-Day Forecast */}
      {forecast && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">5-Day Forecast</h3>
            <p className="card-subtitle">Weather predictions for {forecast.city.name}</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {forecast.forecast.map((day, index) => (
              <div key={index} className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="font-semibold text-gray-900 mb-2">
                  {day.day_name}
                </div>
                <div className="text-sm text-gray-600 mb-3">
                  {formatDate(day.date)}
                </div>
                
                <div className="mb-3">
                  {(() => {
                    const Icon = getWeatherIcon(day.forecasts[0]?.icon || '01d');
                    return <Icon size={32} className="mx-auto text-blue-600" />;
                  })()}
                </div>
                
                <div className="text-lg font-bold text-gray-900 mb-1">
                  {Math.round(day.summary.avg_temperature)}{getTemperatureUnit()}
                </div>
                
                <div className="text-sm text-gray-600 mb-2">
                  {day.forecasts[0]?.description || 'Clear'}
                </div>
                
                <div className="text-xs text-gray-500">
                  Rain: {Math.round(day.summary.max_precipitation_probability)}%
                </div>
                {day.summary.visitability && (
                  <div className={`mt-3 p-2 rounded text-xs ${day.summary.visitability.is_ok_to_visit ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {day.summary.visitability.note}
                  </div>
                )}
                {day.summary.visitability && (
                  <button
                    type="button"
                    className="btn btn-secondary mt-2 w-full"
                    onClick={() => speakText(day.summary.visitability.note)}
                  >
                    Play Note
                  </button>
                )}
                
                {day.summary.recommendations.length > 0 && (
                  <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-800">
                    <div className="font-semibold mb-1">Tips:</div>
                    <ul className="text-left space-y-1">
                      {day.summary.recommendations.slice(0, 2).map((rec, recIndex) => (
                        <li key={recIndex} className="flex items-start gap-1">
                          <span className="text-blue-600">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Data State */}
      {!weather && !loading && (
        <div className="card text-center py-12">
          <Cloud size={64} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            Search for a city to see weather information
          </h3>
          <p className="text-gray-500">
            Enter a city name above to get current weather and 5-day forecast
          </p>
        </div>
      )}
    </div>
  );
};

export default Weather;
