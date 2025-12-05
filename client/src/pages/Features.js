import React from 'react';
import { Link } from 'react-router-dom';
import { Cloud, MapPin, Home, MessageCircle, Wallet, Calendar, Plane } from 'lucide-react';

const features = [
  {
    title: 'Weather Intelligence',
    description: 'Live weather, visitability advice, and trip timing insights.',
    icon: <Cloud size={28} />,
    to: '/weather',
    className: 'weather-icon',
  },
  {
    title: 'Interactive Maps',
    description: 'Routes, nearby essentials, and smart navigation for your trip.',
    icon: <MapPin size={28} />,
    to: '/maps',
    className: 'maps-icon',
  },
  {
    title: 'Accommodation',
    description: 'Find and organize stays along your itinerary seamlessly.',
    icon: <Home size={28} />,
    to: '/accommodation',
    className: 'itinerary-icon',
  },
  {
    title: 'Trip Planner',
    description: 'Create, edit and manage your itineraries in minutes.',
    icon: <Calendar size={28} />,
    to: '/create-trip',
    className: 'ai-icon',
  },
  {
    title: 'AI Assistant',
    description: 'Chat for ideas, packing lists, and quick travel tips.',
    icon: <MessageCircle size={28} />,
    to: '/chatbot',
    className: 'weather-icon',
  },
  {
    title: 'Budgeting',
    description: 'Track costs, split expenses and keep your trip on budget.',
    icon: <Wallet size={28} />,
    to: '/budget',
    className: 'maps-icon',
  },
];

const Features = () => {
  return (
    <section className="features-preview">
      <div className="container">
        <div className="section-title">
          <Plane className="title-icon" size={36} />
          <span>Explore Features</span>
        </div>

        <div className="features-grid">
          {features.map((f) => (
            <Link
              key={f.title}
              to={f.to}
              className="feature-card"
              style={{ textDecoration: 'none' }}
            >
              <div className={`feature-icon ${f.className}`}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
              <div className="feature-cta">Open →</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
