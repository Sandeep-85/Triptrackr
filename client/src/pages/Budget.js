import React, { useState } from 'react';

const Budget = () => {
  const [currency, setCurrency] = useState('INR');
  const [breakdown, setBreakdown] = useState({
    transport: '',
    hotel: '',
    food: '',
    activities: '',
    other: ''
  });

  const total = ['transport','hotel','food','activities','other']
    .map(k => Number(breakdown[k]) || 0)
    .reduce((a,b) => a + b, 0);

  const handleChange = (key, value) => {
    setBreakdown(prev => ({ ...prev, [key]: value }));
  };

  const formatCurrency = (amount) => {
    const n = Number(amount) || 0;
    if (currency === 'INR') return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Cost Management</h1>
        <p className="text-gray-600">Budget calculator with multi-currency support</p>
      </div>

      <div className="card">
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


