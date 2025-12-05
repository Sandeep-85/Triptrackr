import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import CreateTrip from './pages/CreateTrip';
import TripDetails from './pages/TripDetails';
import Weather from './pages/Weather';
import Maps from './pages/Maps';
import Chatbot from './pages/Chatbot';
import Budget from './pages/Budget';
import Export from './pages/Export';
import About from './pages/About';
import Contact from './pages/Contact';
import Accommodation from './pages/Accommodation';
import Features from './pages/Features';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/create-trip" element={<CreateTrip />} />
            <Route path="/trip/:id" element={<TripDetails />} />
            <Route path="/weather" element={<Weather />} />
            <Route path="/maps" element={<Maps />} />
            <Route path="/chatbot" element={<Chatbot />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/export" element={<Export />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/accommodation" element={<Accommodation />} />
            <Route path="/features" element={<Features />} />
          </Routes>
        </main>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#4ade80',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
