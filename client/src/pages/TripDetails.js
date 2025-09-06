import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit, Trash2, MapPin, Calendar, DollarSign, ArrowLeft, Save, X } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const TripDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Helper function to format currency display
  const formatCurrency = (amount, currency) => {
    const numericAmount = Number(amount) || 0;
    if (currency === 'INR') {
      return `₹ ${numericAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${currency} ${numericAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  useEffect(() => {
    loadItinerary();
  }, [id]);

  const loadItinerary = async () => {
    try {
      const response = await axios.get(`/api/itineraries/${id}`);
      setItinerary(response.data.itinerary);
      setEditForm(response.data.itinerary);
    } catch (error) {
      console.error('Failed to load itinerary:', error);
      toast.error('Failed to load itinerary');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this trip?')) return;

    try {
      await axios.delete(`/api/itineraries/${id}`);
      toast.success('Trip deleted successfully');
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to delete itinerary:', error);
      toast.error('Failed to delete trip');
    }
  };

  const handleEditToggle = () => {
    if (editing) {
      setEditForm(itinerary); // Reset to original values
    }
    setEditing(!editing);
  };

  const handleEditChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleEditSubmit = async () => {
    setSaving(true);
    try {
      // sanitize payload: ensure budget.total is a number
      const payload = { ...editForm };
      if (payload.budget) {
        const totalValue = payload.budget.total;
        const parsedTotal = typeof totalValue === 'string' ? parseFloat(totalValue) : totalValue;
        payload.budget = {
          ...payload.budget,
          total: Number.isFinite(parsedTotal) ? parsedTotal : 0
        };
      }
      const response = await axios.put(`/api/itineraries/${id}`, payload);
      setItinerary(response.data.itinerary);
      setEditing(false);
      toast.success('Trip updated successfully');
    } catch (error) {
      console.error('Failed to update itinerary:', error);
      toast.error('Failed to update trip');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'planning': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <span className="ml-3">Loading trip details...</span>
      </div>
    );
  }

  if (!itinerary) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Trip Not Found</h2>
        <p className="text-gray-600 mb-6">The trip you're looking for doesn't exist.</p>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="trip-details">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="btn btn-secondary"
        >
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {itinerary.title}
          </h1>
          <div className="flex items-center gap-4 text-gray-600">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(itinerary.status)}`}>
              {itinerary.status.charAt(0).toUpperCase() + itinerary.status.slice(1)}
            </span>
            <span>Created {formatDate(itinerary.createdAt)}</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleEditToggle}
            className="btn btn-secondary"
          >
            <Edit size={20} />
            <span>{editing ? 'Cancel' : 'Edit'}</span>
          </button>
          <button
            onClick={handleDelete}
            className="btn btn-danger"
          >
            <Trash2 size={20} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
                     {/* Trip Overview */}
           <div className="card">
             <div className="card-header">
               <h3 className="card-title">Trip Overview</h3>
             </div>
             
             {editing ? (
               <div className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="form-group">
                     <label className="form-label">Trip Title</label>
                     <input
                       type="text"
                       value={editForm.title || ''}
                       onChange={(e) => handleEditChange('title', e.target.value)}
                       className="form-input"
                     />
                   </div>
                   <div className="form-group">
                     <label className="form-label">Status</label>
                     <select
                       value={editForm.status || 'planning'}
                       onChange={(e) => handleEditChange('status', e.target.value)}
                       className="form-select"
                     >
                       <option value="planning">Planning</option>
                       <option value="active">Active</option>
                       <option value="completed">Completed</option>
                       <option value="cancelled">Cancelled</option>
                     </select>
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="form-group">
                     <label className="form-label">Start Date</label>
                     <input
                       type="date"
                       value={editForm.startDate ? new Date(editForm.startDate).toISOString().split('T')[0] : ''}
                       onChange={(e) => handleEditChange('startDate', e.target.value)}
                       className="form-input"
                     />
                   </div>
                   <div className="form-group">
                     <label className="form-label">End Date</label>
                     <input
                       type="date"
                       value={editForm.endDate ? new Date(editForm.endDate).toISOString().split('T')[0] : ''}
                       onChange={(e) => handleEditChange('endDate', e.target.value)}
                       className="form-input"
                     />
                   </div>
                 </div>
                 
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">Budget Total</label>
                      <input
                        type="number"
                        value={
                          editForm.budget?.total === 0 || editForm.budget?.total
                            ? String(editForm.budget.total)
                            : ''
                        }
                        onChange={(e) => handleEditChange('budget', { ...(editForm.budget || {}), total: e.target.value })}
                        className="form-input"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                      />
                      <div className="text-xs text-gray-500 mt-1">Enter amount in {editForm.budget?.currency || 'INR'}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Currency</label>
                      <select
                        value={editForm.budget?.currency || 'INR'}
                        onChange={(e) => handleEditChange('budget', { ...(editForm.budget || {}), currency: e.target.value })}
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
                 
                 <div className="form-group">
                   <label className="form-label">Notes</label>
                   <textarea
                     value={editForm.notes || ''}
                     onChange={(e) => handleEditChange('notes', e.target.value)}
                     className="form-textarea"
                     rows="3"
                   />
                 </div>
                 
                 <div className="flex gap-2 justify-end">
                   <button
                     onClick={handleEditToggle}
                     className="btn btn-secondary"
                     disabled={saving}
                   >
                     <X size={16} />
                     <span>Cancel</span>
                   </button>
                   <button
                     onClick={handleEditSubmit}
                     className="btn btn-primary"
                     disabled={saving}
                   >
                     {saving ? (
                       <div className="spinner w-4 h-4"></div>
                     ) : (
                       <Save size={16} />
                     )}
                     <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                   </button>
                 </div>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="flex items-center gap-3">
                   <Calendar size={20} className="text-blue-600" />
                   <div>
                     <div className="font-medium text-gray-900">Duration</div>
                     <div className="text-gray-600">
                       {formatDate(itinerary.startDate)} - {formatDate(itinerary.endDate)}
                     </div>
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-3">
                   <MapPin size={20} className="text-green-600" />
                   <div>
                     <div className="font-medium text-gray-900">Destinations</div>
                     <div className="text-gray-600">
                       {itinerary.destinations?.length || 0} location{itinerary.destinations?.length !== 1 ? 's' : ''}
                     </div>
                   </div>
                 </div>
                 
                 {itinerary.budget?.total > 0 && (
                   <div className="flex items-center gap-3">
                     <DollarSign size={20} className="text-yellow-600" />
                     <div>
                       <div className="font-medium text-gray-900">Budget</div>
                                               <div className="text-gray-600">
                          {formatCurrency(itinerary.budget.total, itinerary.budget.currency)}
                        </div>
                     </div>
                   </div>
                 )}
               </div>
             )}
           </div>

          {/* Destinations */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Destinations</h3>
            </div>
            
            <div className="space-y-4">
              {itinerary.destinations?.map((destination, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-lg font-semibold text-gray-900">
                      {index + 1}. {destination.name}
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    {destination.arrivalDate && (
                      <div>
                        <span className="font-medium">Arrival:</span> {formatDate(destination.arrivalDate)}
                      </div>
                    )}
                    {destination.departureDate && (
                      <div>
                        <span className="font-medium">Departure:</span> {formatDate(destination.departureDate)}
                      </div>
                    )}
                    {destination.accommodation && (
                      <div className="md:col-span-2">
                        <span className="font-medium">Accommodation:</span> {destination.accommodation}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {itinerary.notes && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Notes</h3>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{itinerary.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Quick Actions</h3>
            </div>
            
            <div className="space-y-3">
              <button className="btn btn-primary w-full">
                <MapPin size={20} />
                <span>View on Map</span>
              </button>
              
              <button className="btn btn-secondary w-full">
                <Calendar size={20} />
                <span>Add to Calendar</span>
              </button>
              
              <button className="btn btn-success w-full">
                <DollarSign size={20} />
                <span>Track Expenses</span>
              </button>
            </div>
          </div>

          {/* Weather Check */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Weather Check</h3>
            </div>
            
            <div className="space-y-3">
              {itinerary.destinations?.map((destination, index) => (
                <button
                  key={index}
                  onClick={() => navigate(`/weather?city=${encodeURIComponent(destination.name)}`)}
                  className="w-full text-left p-3 text-sm text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="font-medium">{destination.name}</div>
                  <div className="text-xs text-gray-500">Check weather forecast</div>
                </button>
              ))}
            </div>
          </div>

          {/* AI Assistant */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">AI Travel Assistant</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Get personalized recommendations for your trip to {itinerary.destinations?.[0]?.name || 'your destination'}.
            </p>
            
            <button
              onClick={() => navigate('/chatbot')}
              className="btn btn-primary w-full"
            >
              <span>Ask AI Assistant</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripDetails;
