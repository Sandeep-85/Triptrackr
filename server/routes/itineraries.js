const express = require('express');
const router = express.Router();
const Itinerary = require('../models/Itinerary');

// Fallback in-memory storage if database is not available
const itineraries = new Map();
let nextId = 1;

// Create new itinerary
router.post('/', async (req, res) => {
  try {
    const { title, startDate, endDate, destinations, budget, notes } = req.body;

    if (!title || !startDate || !endDate || !destinations) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Sanitize destinations and budget to avoid schema cast errors
    const normalizedDestinations = Array.isArray(destinations)
      ? destinations
          .filter(d => d && typeof d === 'object')
          .map(d => ({
            name: (d.name || '').toString().trim(),
            // Only include coordinates if both numbers are provided
            ...(d.coordinates && typeof d.coordinates === 'object' &&
              Number.isFinite(d.coordinates.lat) && Number.isFinite(d.coordinates.lng)
              ? { coordinates: { lat: Number(d.coordinates.lat), lng: Number(d.coordinates.lng) } }
              : {}),
            ...(d.arrivalDate ? { arrivalDate: new Date(d.arrivalDate) } : {}),
            ...(d.departureDate ? { departureDate: new Date(d.departureDate) } : {}),
            ...(d.accommodation ? { accommodation: d.accommodation } : {}),
            ...(d.activities ? { activities: d.activities } : {}),
            ...(d.notes ? { notes: d.notes } : {})
          }))
          .filter(d => d.name.length > 0)
      : [];

    if (normalizedDestinations.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one destination with a name' });
    }

    const normalizedBudget = budget && typeof budget === 'object'
      ? {
          currency: budget.currency || 'INR',
          total: Number.isFinite(Number(budget.total)) ? Number(budget.total) : 0,
          ...(budget.breakdown ? { breakdown: budget.breakdown } : {}),
          ...(budget.expenses ? { expenses: budget.expenses } : {})
        }
      : { total: 0, currency: 'INR' };

    // Try to use database first
    if (Itinerary.db && Itinerary.db.readyState === 1) {
      const itinerary = new Itinerary({
        title: title.toString().trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        destinations: normalizedDestinations,
        budget: normalizedBudget,
        notes: notes || '',
        status: 'planning'
      });

      const savedItinerary = await itinerary.save();
      res.status(201).json({ message: 'Itinerary created', itinerary: savedItinerary });
    } else {
      // Fallback to in-memory storage
      const itinerary = {
        id: nextId++,
        title: title.toString().trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        destinations: normalizedDestinations,
        budget: normalizedBudget,
        notes: notes || '',
        createdAt: new Date(),
        status: 'planning'
      };

      itineraries.set(itinerary.id, itinerary);
      res.status(201).json({ message: 'Itinerary created', itinerary });
    }
  } catch (error) {
    console.error('Create itinerary error:', error);
    res.status(500).json({ error: 'Failed to create itinerary', message: error.message });
  }
});

// Get all itineraries
router.get('/', async (req, res) => {
  try {
    // Try to use database first
    if (Itinerary.db && Itinerary.db.readyState === 1) {
      const allItineraries = await Itinerary.find().sort({ createdAt: -1 });
      res.json({ itineraries: allItineraries, total: allItineraries.length });
    } else {
      // Fallback to in-memory storage
      const allItineraries = Array.from(itineraries.values());
      res.json({ itineraries: allItineraries, total: allItineraries.length });
    }
  } catch (error) {
    console.error('Get itineraries error:', error);
    res.status(500).json({ error: 'Failed to retrieve itineraries', message: error.message });
  }
});

// Get specific itinerary
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to use database first
    if (Itinerary.db && Itinerary.db.readyState === 1) {
      const itinerary = await Itinerary.findById(id);
      if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
      res.json({ itinerary });
    } else {
      // Fallback to in-memory storage
      const itinerary = itineraries.get(parseInt(id));
      if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
      res.json({ itinerary });
    }
  } catch (error) {
    console.error('Get itinerary error:', error);
    res.status(500).json({ error: 'Failed to retrieve itinerary', message: error.message });
  }
});

// Update itinerary
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to use database first
    if (Itinerary.db && Itinerary.db.readyState === 1) {
      const itinerary = await Itinerary.findByIdAndUpdate(
        id, 
        { ...req.body, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
      if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
      res.json({ message: 'Itinerary updated', itinerary });
    } else {
      // Fallback to in-memory storage
      const itinerary = itineraries.get(parseInt(id));
      if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

      Object.assign(itinerary, req.body, { updatedAt: new Date() });
      itineraries.set(parseInt(id), itinerary);
      res.json({ message: 'Itinerary updated', itinerary });
    }
  } catch (error) {
    console.error('Update itinerary error:', error);
    res.status(500).json({ error: 'Failed to update itinerary', message: error.message });
  }
});

// Delete itinerary
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to use database first
    if (Itinerary.db && Itinerary.db.readyState === 1) {
      const itinerary = await Itinerary.findByIdAndDelete(id);
      if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
      res.json({ message: 'Itinerary deleted', deletedId: id });
    } else {
      // Fallback to in-memory storage
      const itinerary = itineraries.get(parseInt(id));
      if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

      itineraries.delete(parseInt(id));
      res.json({ message: 'Itinerary deleted', deletedId: parseInt(id) });
    }
  } catch (error) {
    console.error('Delete itinerary error:', error);
    res.status(500).json({ error: 'Failed to delete itinerary', message: error.message });
  }
});

module.exports = router;
