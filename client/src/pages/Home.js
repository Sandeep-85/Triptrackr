import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Cloud, MessageCircle, DollarSign, ArrowRight, Globe } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();

  const heroImages = [
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=60',
    'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=60',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=60',
    'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=1200&q=60',
  ];

  const features = [
    {
      title: 'Trip Planner',
      description: 'Create beautiful itineraries in minutes',
      icon: <MapPin className="w-8 h-8 text-blue-600" />,
      action: () => navigate('/create-trip'),
    },
    {
      title: 'Weather Insights',
      description: 'Real-time forecasts for smarter planning',
      icon: <Cloud className="w-8 h-8 text-green-600" />,
      action: () => navigate('/weather'),
    },
    {
      title: 'Maps Explorer',
      description: 'Find routes and nearby attractions',
      icon: <Globe className="w-8 h-8 text-purple-600" />,
      action: () => navigate('/maps'),
    },
    {
      title: 'Budgeting',
      description: 'Plan costs with multi-currency support',
      icon: <DollarSign className="w-8 h-8 text-yellow-600" />,
      action: () => navigate('/budget'),
    },
    {
      title: 'AI Assistant',
      description: 'Ideas, answers, and alternatives instantly',
      icon: <MessageCircle className="w-8 h-8 text-pink-600" />,
      action: () => navigate('/chatbot'),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-purple-50">
      {/* Image collage hero */}
      <section className="home-hero">
        <div className="home-hero-content">
          <h1>Plan trips with style. Travel smarter with Triptrackr.</h1>
          <p>Minimal, beautiful, and powerful tools for itineraries, weather, maps, budgets, and AI.</p>
          <div className="home-hero-actions">
            <button onClick={() => navigate('/create-trip')} className="btn btn-primary">
              Start Planning <ArrowRight className="inline ml-2 w-5 h-5" />
            </button>
            <button onClick={() => navigate('/chatbot')} className="btn btn-secondary">Ask the AI Assistant</button>
          </div>
        </div>
        <div className="home-hero-collage">
          {heroImages.map((src, i) => (
            <img key={i} src={src} alt={`Hero collage ${i+1}`} loading="lazy" />
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, idx) => (
            <button
              key={idx}
              onClick={f.action}
              className="text-left bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {f.icon}
                  <h3 className="text-lg font-semibold text-gray-900">{f.title}</h3>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-gray-600">{f.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Photo strip CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="cta-photo-strip">
          <div className="strip">
            <img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1000&q=60" alt="Mountains" loading="lazy" />
            <img src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1000&q=60" alt="Beach" loading="lazy" />
            <img src="https://images.unsplash.com/photo-1499696010180-025ef6e1a8f9?auto=format&fit=crop&w=1000&q=60" alt="Road trip" loading="lazy" />
            <img src="https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1000&q=60" alt="City" loading="lazy" />
          </div>
          <div className="cta-overlay">
            <h2>Ready for your next adventure?</h2>
            <p>Craft a plan in minutes and adjust with real-time insights.</p>
            <button onClick={() => navigate('/create-trip')} className="btn btn-primary">Plan a Trip Now</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
