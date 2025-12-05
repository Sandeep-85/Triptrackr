import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const Budget = () => {
  const [currency, setCurrency] = useState('INR');
  const [breakdown, setBreakdown] = useState({
    transport: '',
    hotel: '',
    food: '',
    activities: '',
    other: ''
  });
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ destination: '', days: 3, travelers: 2, style: 'mid-range', season: '' });
  const [serverTotal, setServerTotal] = useState(null);

  const total = ['transport','hotel','food','activities','other']
    .map(k => Number(breakdown[k]) || 0)
    .reduce((a,b) => a + b, 0);

  const handleChange = (key, value) => {
    setBreakdown(prev => ({ ...prev, [key]: value }));
  };

  const fetchEstimate = async () => {
    if (!meta.destination.trim()) {
      toast.error('Enter a destination');
      return;
    }
    setLoading(true);
    try {
      const key = (typeof localStorage !== 'undefined' && localStorage.getItem('triptrackr_gemini_key')) || process.env.REACT_APP_GEMINI_KEY || '';
      const { data } = await axios.post(
        '/api/chat/budget-estimate',
        {
          destination: meta.destination,
          days: Number(meta.days) || 3,
          travelers: Number(meta.travelers) || 2,
          style: meta.style,
          season: meta.season || undefined,
          currency
        },
        { headers: key ? { 'x-gemini-key': key } : {} }
      );
      const pd = data.per_day || {};
      setBreakdown({
        transport: String(pd.transport ?? ''),
        hotel: String(pd.hotel ?? ''),
        food: String(pd.food ?? ''),
        activities: String(pd.activities ?? ''),
        other: String(pd.other ?? '')
      });
      if (data?.total_trip?.total != null) setServerTotal(Number(data.total_trip.total));
      else setServerTotal(null);
      if (Array.isArray(data?.assumptions)) {
        const msg = data.assumptions.find(s => /heuristic|fallback/i.test(String(s)));
        if (msg) toast(msg);
      }
      toast.success('Estimated budget loaded');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to get estimate');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const n = Number(amount) || 0;
    if (currency === 'INR') return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Trip Budget Planner</h1>
        <p className="text-gray-600">Plan smarter with per‑day costs, AI estimates, and your preferred currency.</p>
      </div>

      {/* Visual intro */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <img
            src="https://images.unsplash.com/photo-1521540216272-a50305cd4421?q=80&w=1200&auto=format&fit=crop"
            alt="Travel budgeting"
            style={{ width: '140px', height: '100px', objectFit: 'cover', borderRadius: '0.5rem' }}
          />
          <div>
            <div className="text-lg font-semibold text-gray-900">See the whole trip at a glance</div>
            <div className="text-gray-600 text-sm">
              Enter rough numbers or tap “Estimate with AI”. Adjust anything and watch the total update instantly.
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="form-group">
            <label className="form-label">Destination</label>
            <input className="form-input" value={meta.destination} onChange={(e)=>setMeta(v=>({...v,destination:e.target.value}))} placeholder="e.g., Goa" />
          </div>
          <div className="form-group">
            <label className="form-label">Travel Style</label>
            <select className="form-select" value={meta.style} onChange={(e)=>setMeta(v=>({...v,style:e.target.value}))}>
              <option value="budget">Budget</option>
              <option value="mid-range">Mid-range</option>
              <option value="luxury">Luxury</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Days</label>
            <input className="form-input" type="number" min="1" value={meta.days} onChange={(e)=>setMeta(v=>({...v,days:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Travelers</label>
            <input className="form-input" type="number" min="1" value={meta.travelers} onChange={(e)=>setMeta(v=>({...v,travelers:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Season (optional)</label>
            <input className="form-input" value={meta.season} onChange={(e)=>setMeta(v=>({...v,season:e.target.value}))} placeholder="e.g., monsoon" />
          </div>
          <div className="form-group">
            <label className="form-label">Currency</label>
            <select className="form-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <button className="btn btn-primary" onClick={fetchEstimate} disabled={loading}>
            {loading ? 'Estimating…' : 'Estimate'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Transport</label>
            <input className="form-input" type="number" value={breakdown.transport}
              onChange={(e) => handleChange('transport', e.target.value)} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label className="form-label">Hotel</label>
            <input className="form-input" type="number" value={breakdown.hotel}
              onChange={(e) => handleChange('hotel', e.target.value)} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label className="form-label">Food</label>
            <input className="form-input" type="number" value={breakdown.food}
              onChange={(e) => handleChange('food', e.target.value)} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label className="form-label">Activities</label>
            <input className="form-input" type="number" value={breakdown.activities}
              onChange={(e) => handleChange('activities', e.target.value)} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label className="form-label">Other</label>
            <input className="form-input" type="number" value={breakdown.other}
              onChange={(e) => handleChange('other', e.target.value)} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label className="form-label">Currency</label>
            <select className="form-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
            </select>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-right">
          <div className="text-sm text-gray-600">Estimated Total</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</div>
        </div>
      </div>
    </div>
  );
};

export default Budget;


