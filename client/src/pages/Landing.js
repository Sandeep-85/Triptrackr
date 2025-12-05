import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Cloud, Sparkles, Calendar, Star, Plane } from 'lucide-react';

const Landing = () => {
  const backgroundStyle = {
    minHeight: '100vh',
    position: 'relative',
    color: '#fff',
    background: 'linear-gradient(180deg, #0b2b3b 0%, #0d3a4f 100%)',
    padding: '2rem 1rem'
  };

  const adminStyle = {
    position: 'absolute',
    left: '50%',
    bottom: '28px',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.35)',
    padding: '0.5rem 1rem',
    borderRadius: '999px',
    fontWeight: 600
  };

  const [panel, setPanel] = useState(null);

  const openPanel = (name, e) => { if (e) e.preventDefault(); setPanel(name); };
  const closePanel = () => setPanel(null);

  return (
    <>
      {/* Hero */}
      <section id="home" style={backgroundStyle}>
        <div className="adventure-hero">
          {/* Card */}
          <div className="adventure-card">
            <div className="adventure-topbar">
              <nav className="adventure-nav">
                <a href="#home" onClick={(e)=>e.preventDefault()}>Home</a>
                <a href="#features" onClick={(e)=>openPanel('features', e)}>Features</a>
                <a href="#blog" onClick={(e)=>openPanel('blog', e)}>Blog</a>
                <a href="#story" onClick={(e)=>openPanel('story', e)}>Story</a>
              </nav>
            </div>

            <div className="adventure-media">
              <img src="https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=1600&q=70" alt="Travel planning with map and camera" />
              <div className="adventure-caption">
                <div className="caption-title">ADVENTURE TRIPS</div>
                <div className="caption-sub">WORLDWIDE</div>
              </div>
            </div>

            <div className="adventure-overlay"></div>
            <div className="adventure-stripe"></div>

            <div className="adventure-content center">
              <div className="adventure-title center"><span>Triptrackr</span></div>
              <p className="adventure-sub">Smart trip planning with live weather and maps.<br/>Plan confidently with AI tips and visit notes.</p>
              <Link to="/features" className="adventure-cta">Get Started</Link>
            </div>
          </div>

          {/* Panels */}
          {panel && (
            <div className="modal-backdrop" onClick={closePanel}>
              <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
                <div className="modal-header">
                  <strong>{panel === 'blog' ? 'Blog' : panel === 'features' ? 'Features' : 'Story'}</strong>
                  <button className="modal-close" onClick={closePanel}>×</button>
                </div>
                <div className="modal-body">
                  {panel === 'blog' && (
                    <div>
                      <h4 style={{ marginBottom: '0.5rem' }}>Fresh from the blog</h4>
                      <p className="text-gray-600" style={{ marginBottom: '1rem' }}>
                        New ideas every week—packing, food finds, and smarter routes.
                      </p>
                      <div className="grid" style={{ gap: '0.75rem' }}>
                        <div className="card" style={{ padding: 0 }}>
                          <div className="flex" style={{ gap: '0.75rem' }}>
                            <img src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1000&auto=format&fit=crop" alt="packing list" style={{ width:'120px', height:'90px', objectFit:'cover', borderRadius: '0.5rem' }} />
                            <div className="flex-1">
                              <div className="font-semibold">Carry‑on only: the 12‑item packing list that actually works</div>
                              <div className="text-sm text-gray-600">Skip the baggage queue. Pack once, wear smart, enjoy more.</div>
                              <div className="mt-2 text-xs"><span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded">packing</span> <span className="px-2 py-1 bg-slate-50 text-slate-700 rounded">minimal</span></div>
                            </div>
                          </div>
                        </div>
                        <div className="card" style={{ padding: 0 }}>
                          <div className="flex" style={{ gap: '0.75rem' }}>
                            <img src="https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=1000&auto=format&fit=crop" alt="street food" style={{ width:'120px', height:'90px', objectFit:'cover', borderRadius: '0.5rem' }} />
                            <div className="flex-1">
                              <div className="font-semibold">Eat like a local: street food under $5</div>
                              <div className="text-sm text-gray-600">Signature bites in major cities—and how to find the safe stalls.</div>
                              <div className="mt-2 text-xs"><span className="px-2 py-1 bg-orange-50 text-orange-700 rounded">food</span> <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded">budget</span></div>
                            </div>
                          </div>
                        </div>
                        <div className="card" style={{ padding: 0 }}>
                          <div className="flex" style={{ gap: '0.75rem' }}>
                            <img src="https://images.unsplash.com/photo-1473172707857-f9e276582ab6?q=80&w=1000&auto=format&fit=crop" alt="city loop" style={{ width:'120px', height:'90px', objectFit:'cover', borderRadius: '0.5rem' }} />
                            <div className="flex-1">
                              <div className="font-semibold">Plan a 3‑city loop without backtracking</div>
                              <div className="text-sm text-gray-600">Order your cities, pick the right hub, and save hours on the road.</div>
                              <div className="mt-2 text-xs"><span className="px-2 py-1 bg-teal-50 text-teal-700 rounded">itinerary</span> <span className="px-2 py-1 bg-gray-50 text-gray-700 rounded">maps</span></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <a href="#" onClick={(e)=>e.preventDefault()} className="btn btn-secondary btn-sm">All posts (coming soon)</a>
                      </div>
                    </div>
                  )}
                  {panel === 'features' && (
                    <div>
                      <h4 style={{ marginBottom: '0.5rem' }}>What you get</h4>
                      <ul style={{ paddingLeft: '1rem', lineHeight: 1.8 }}>
                        <li>Weather intelligence with visitability and packing cues</li>
                        <li>Smart maps: directions, nearby essentials, and POIs</li>
                        <li>Restaurants finder with open data fallbacks</li>
                        <li>AI assistant for ideas, alternatives and quick answers</li>
                        <li>Trip planner and day‑wise itinerary notes</li>
                        <li>Budgeting with per‑day breakdown and AI estimates</li>
                        <li>Export and share trip details with friends</li>
                      </ul>
                      <div className="mt-4">
                        <a href="/features" className="btn btn-primary btn-sm" onClick={()=>setPanel(null)}>Explore full features</a>
                      </div>
                    </div>
                  )}
                  {panel === 'story' && (
                    <div>
                      <h4 style={{ marginBottom: '0.5rem' }}>Our story</h4>
                      <blockquote className="card" style={{ marginBottom: '0.75rem' }}>
                        <p className="text-gray-700">“Planning a great trip shouldn’t feel like work. We wanted one calm place where weather, maps and ideas just… click.”</p>
                      </blockquote>
                      <div className="grid" style={{ gap: '0.75rem' }}>
                        <div className="card" style={{ padding: '0.75rem' }}>
                          <div className="font-semibold">Built for momentum ✈️</div>
                          <div className="text-sm text-gray-600">Quick answers, fewer tabs. Make decisions in minutes, not nights.</div>
                        </div>
                        <div className="card" style={{ padding: '0.75rem' }}>
                          <div className="font-semibold">Data when it matters ☀️</div>
                          <div className="text-sm text-gray-600">Visitability, live maps and practical picks—no fluff, just helpful.</div>
                        </div>
                        <div className="card" style={{ padding: '0.75rem' }}>
                          <div className="font-semibold">Travel is for everyone 🌍</div>
                          <div className="text-sm text-gray-600">Thoughtful defaults and budget‑friendly tools to open more doors.</div>
                        </div>
                      </div>
                      <p className="text-gray-600 mt-4">Less guesswork. More adventure. That’s the Triptrackr promise.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={adminStyle}>Admin : Sandeep_Sugur</div>
      </section>
    </>
  );
};

export default Landing;
