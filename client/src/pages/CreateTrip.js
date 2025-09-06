import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Plus, Trash2, MapPin } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const CreateTrip = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    endDate: '',
    destinations: [{ name: '' }],
    budget: { total: 0, currency: 'INR' },
    notes: ''
  });

  // Helper function to format currency display
  const formatCurrency = (amount, currency) => {
    const numericAmount = Number(amount) || 0;
    if (currency === 'INR') {
      return `₹ ${numericAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${currency} ${numericAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'budget.total') {
      setFormData(prev => ({
        ...prev,
        budget: { ...prev.budget, total: value }
      }));
    } else if (name === 'budget.currency') {
      setFormData(prev => ({
        ...prev,
        budget: { ...prev.budget, currency: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDestinationChange = (index, field, value) => {
    const newDestinations = [...formData.destinations];
    newDestinations[index] = { ...newDestinations[index], [field]: value };
    setFormData(prev => ({ ...prev, destinations: newDestinations }));
  };

  const addDestination = () => {
    setFormData(prev => ({
      ...prev,
      destinations: [...prev.destinations, { name: '' }]
    }));
  };

  const removeDestination = (index) => {
    if (formData.destinations.length > 1) {
      const newDestinations = formData.destinations.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, destinations: newDestinations }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Please enter a trip title');
      return;
    }
    
    if (!formData.startDate || !formData.endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    
    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      toast.error('End date must be after start date');
      return;
    }
    
    if (!formData.destinations[0].name.trim()) {
      toast.error('Please enter at least one destination');
      return;
    }

    setLoading(true);
    try {
      // sanitize payload: convert budget.total to number
      const payload = { ...formData };
      if (payload.budget) {
        const totalValue = payload.budget.total;
        const parsedTotal = typeof totalValue === 'string' ? parseFloat(totalValue) : totalValue;
        payload.budget = {
          ...payload.budget,
          total: Number.isFinite(parsedTotal) ? parsedTotal : 0
        };
      }
      // strip nullish coordinates from destinations before sending
      payload.destinations = payload.destinations.map(d => {
        const copy = { ...d };
        if (!copy.coordinates || copy.coordinates.lat == null || copy.coordinates.lng == null) {
          delete copy.coordinates;
        }
        return copy;
      });
      const response = await axios.post('/api/itineraries', payload);
      toast.success('Trip created successfully!');
      const newId = response.data.itinerary.id || response.data.itinerary._id;
      navigate(`/trip/${newId}`);
    } catch (error) {
      console.error('Failed to create trip:', error);
      toast.error('Failed to create trip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-trip">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Create New Trip
        </h1>
        <p className="text-lg text-gray-600">
          Plan your adventure with weather intelligence and AI assistance
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Trip Information */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Trip Details</h3>
              <p className="card-subtitle">Basic information about your trip</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="form-label">Trip Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., European Adventure 2024"
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  name="status"
                  value={formData.status || 'planning'}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>
            </div>
          </div>

          {/* Destinations */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Destinations</h3>
              <p className="card-subtitle">Where will you be traveling?</p>
            </div>
            
            <div className="space-y-4">
              {formData.destinations.map((destination, index) => (
                <div key={index} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="form-label">Destination {index + 1} *</label>
                        <input
                          type="text"
                          value={destination.name}
                          onChange={(e) => handleDestinationChange(index, 'name', e.target.value)}
                          placeholder="e.g., Paris, France"
                          className="form-input"
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Arrival Date</label>
                        <input
                          type="date"
                          value={destination.arrivalDate || ''}
                          onChange={(e) => handleDestinationChange(index, 'arrivalDate', e.target.value)}
                          className="form-input"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="form-group">
                        <label className="form-label">Departure Date</label>
                        <input
                          type="date"
                          value={destination.departureDate || ''}
                          onChange={(e) => handleDestinationChange(index, 'departureDate', e.target.value)}
                          className="form-input"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Accommodation</label>
                        <input
                          type="text"
                          value={destination.accommodation || ''}
                          onChange={(e) => handleDestinationChange(index, 'accommodation', e.target.value)}
                          placeholder="Hotel name or address"
                          className="form-input"
                        />
                      </div>
                    </div>
                  </div>
                  
              {formData.destinations.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDestination(index)}
                  className="btn btn-danger btn-sm mt-2"
                >
                  <Trash2 size={16} />
                </button>
              )}
                </div>
              ))}
              
              <button
                type="button"
                onClick={addDestination}
                className="btn btn-secondary w-full"
              >
                <Plus size={20} />
                <span>Add Another Destination</span>
              </button>
            </div>
          </div>

          {/* Budget */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Budget</h3>
              <p className="card-subtitle">Estimated costs for your trip (INR ₹ is the default currency)</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="form-group">
                    <label className="form-label">Total Budget</label>
                    <input
                      type="number"
                      name="budget.total"
                      value={formData.budget.total}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="form-input"
                    />
                    <div className="text-xs text-gray-500 mt-1">Enter amount in {formData.budget.currency}</div>
                  </div>
              
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select
                  name="budget.currency"
                  value={formData.budget.currency}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="INR">INR (₹) - Indian Rupees</option>
                  <option value="USD">USD ($) - US Dollars</option>
                  <option value="EUR">EUR (€) - Euros</option>
                  <option value="GBP">GBP (£) - British Pounds</option>
                  <option value="JPY">JPY (¥) - Japanese Yen</option>
                  <option value="CAD">CAD (C$) - Canadian Dollars</option>
                  <option value="AUD">AUD (A$) - Australian Dollars</option>
                </select>
              </div>
            </div>
            
            {/* Budget Display */}
            {formData.budget.total > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">Your Budget:</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(formData.budget.total, formData.budget.currency)}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Additional Notes</h3>
              <p className="card-subtitle">Any special requirements or notes</p>
            </div>
            
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Special requirements, preferences, or additional information..."
                className="form-textarea"
                rows="4"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <div className="spinner w-4 h-4"></div>
              ) : (
                <Save size={20} />
              )}
              <span>{loading ? 'Creating...' : 'Create Trip'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTrip;
