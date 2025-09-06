import React from 'react';

const About = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">About TripTrackr</h1>
        <p className="text-gray-600">Your AI-powered travel planning companion</p>
      </div>

      <div className="card space-y-4">
        <p className="text-gray-700">
          TripTrackr helps travelers plan smarter using real-time weather, interactive maps, budgeting tools, and an AI assistant.
        </p>
        <p className="text-gray-700">
          This project acknowledges guidance and support from our mentors and references, and is built as a practical demonstration of an intelligent travel planning system.
        </p>
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Technologies & APIs</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>Google Maps API</li>
            <li>OpenWeatherMap API</li>
            <li>Node.js, Express, React</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default About;


