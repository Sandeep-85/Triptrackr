import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Plane, Map, Calendar } from 'lucide-react';

const Landing = () => {
  return (
    <div className="travel-world-landing">
      {/* Hero Section with Mockup Image */}
      <section className="hero-section">
        <div className="hero-container">
          {/* Left Side - Mockup Image */}
          <div className="mockup-side">
            <div className="mockup-image-container">
              <img 
                src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=60" 
                alt="Travel The World Campaign Phone Mockup" 
                className="mockup-image"
              />
              {/* Overlay elements to recreate the mockup */}
              <div className="mockup-overlay">
                {/* Suitcase */}
                <div className="overlay-suitcase">
                  <div className="suitcase-body"></div>
                  <div className="suitcase-handle"></div>
                  <div className="sun-hat"></div>
                </div>
                
                {/* Phone mockup */}
                <div className="overlay-phone">
                  <div className="phone-screen">
                    <div className="phone-header">
                      <div className="phone-icon">Ps</div>
                    </div>
                    <div className="phone-content">
                      <div className="location-pin">📍</div>
                      <div className="phone-text">Best Quality MOCKUP YOUR DESIGN HERE</div>
                    </div>
                  </div>
                </div>
                
                {/* Map */}
                <div className="overlay-map">
                  <div className="map-section map-blue"></div>
                  <div className="map-section map-green"></div>
                  <div className="map-section map-yellow"></div>
                  <div className="map-section map-red"></div>
                </div>
                
                {/* Floating bubbles */}
                <div className="overlay-bubble bubble-1"></div>
                <div className="overlay-bubble bubble-2"></div>
                <div className="overlay-bubble bubble-3"></div>
              </div>
            </div>
          </div>
          
          {/* Right Side - Content */}
          <div className="content-side">
            <div className="content-wrapper">
              <h1 className="main-title">TRAVEL THE WORLD</h1>
              <Link to="/create-trip" className="book-now-btn">
                BOOK NOW
              </Link>
              <p className="description">
                Experience the future of travel planning with weather intelligence, 
                interactive maps, and AI assistance. Plan smarter, travel better.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Why Choose TripTrackr?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <MapPin size={32} />
              </div>
              <h3>Smart Maps</h3>
              <p>Interactive routes and attractions</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <Plane size={32} />
              </div>
              <h3>Weather Intelligence</h3>
              <p>Real-time forecasts for better planning</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <Map size={32} />
              </div>
              <h3>AI Assistant</h3>
              <p>Smart recommendations and alternatives</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <Calendar size={32} />
              </div>
              <h3>Budget Management</h3>
              <p>Multi-currency cost tracking</p>
            </div>
          </div>
        </div>
      </section>

      {/* Author Credit */}
      <footer className="author-footer">
        <div className="container">
          <p>Designed by <span className="author-name">Sandeep Sugur</span></p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
