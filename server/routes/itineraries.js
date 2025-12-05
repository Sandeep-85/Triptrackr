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

// Lightweight export endpoints (work with DB or in-memory)
router.get('/:id/export/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const getItin = async () => {
      if (Itinerary.db && Itinerary.db.readyState === 1) {
        return await Itinerary.findById(id);
      }
      return itineraries.get(parseInt(id));
    };
    const itin = await getItin();
    if (!itin) return res.status(404).json({ error: 'Itinerary not found' });

    const title = `Triptrackr Itinerary - ${itin.title || 'Trip'}`;
    const content = `Itinerary: ${itin.title || ''}\nStart: ${new Date(itin.startDate).toDateString()}\nEnd: ${new Date(itin.endDate).toDateString()}\nDestinations: ${(itin.destinations||[]).map(d=>d.name).join(', ')}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><pre>${content}</pre><p style="margin-top:24px;color:#555">Simple export preview. Integrate a real PDF generator later.</p></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    res.status(500).json({ error: 'Failed to export PDF', message: e.message });
  }
});

router.get('/:id/export/ical', async (req, res) => {
  try {
    const { id } = req.params;
    const getItin = async () => {
      if (Itinerary.db && Itinerary.db.readyState === 1) {
        return await Itinerary.findById(id);
      }
      return itineraries.get(parseInt(id));
    };
    const itin = await getItin();
    if (!itin) return res.status(404).json({ error: 'Itinerary not found' });

    const dt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Triptrackr//Itinerary//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:triptrackr-${id}@local`,
      `DTSTAMP:${dt(Date.now())}`,
      `DTSTART:${dt(itin.startDate)}`,
      `DTEND:${dt(itin.endDate)}`,
      `SUMMARY:${(itin.title||'Trip').replace(/[,\n]/g,' ')}`,
      `DESCRIPTION:${(itin.destinations||[]).map(d=>d.name).join(' -> ').replace(/[,\n]/g,' ')}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ];
    const ics = lines.join('\r\n');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="itinerary-${id}.ics"`);
    res.send(ics);
  } catch (e) {
    res.status(500).json({ error: 'Failed to export iCal', message: e.message });
  }
});