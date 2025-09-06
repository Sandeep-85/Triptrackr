const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  coordinates: {
    lat: Number,
    lng: Number
  },
  arrivalDate: Date,
  departureDate: Date,
  accommodation: String,
  activities: [String],
  notes: String
});

const budgetSchema = new mongoose.Schema({
  total: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    enum: ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
    default: 'INR'
  },
  breakdown: {
    accommodation: { type: Number, default: 0 },
    transportation: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
    activities: { type: Number, default: 0 },
    shopping: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  expenses: [{
    category: {
      type: String,
      enum: ['accommodation', 'transportation', 'food', 'activities', 'shopping', 'other']
    },
    amount: Number,
    description: String,
    date: { type: Date, default: Date.now },
    location: String
  }]
});

const itinerarySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  destinations: [destinationSchema],
  budget: budgetSchema,
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['planning', 'active', 'completed', 'cancelled'],
    default: 'planning'
  },
  weather: {
    lastChecked: Date,
    forecasts: [{
      destination: String,
      date: Date,
      temperature: Number,
      description: String,
      icon: String,
      recommendations: [String]
    }]
  },
  aiRecommendations: [{
    type: String,
    content: String,
    generatedAt: { type: Date, default: Date.now }
  }],
  tags: [String],
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
itinerarySchema.index({ title: 'text', 'destinations.name': 'text' });
itinerarySchema.index({ startDate: 1, endDate: 1 });
itinerarySchema.index({ status: 1 });
itinerarySchema.index({ createdAt: -1 });

// Virtual for trip duration
itinerarySchema.virtual('duration').get(function() {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return 0;
});

// Virtual for budget status
itinerarySchema.virtual('budgetStatus').get(function() {
  if (!this.budget || !this.budget.total) return 'no-budget';
  
  const totalExpenses = this.budget.expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const remaining = this.budget.total - totalExpenses;
  
  if (remaining < 0) return 'over-budget';
  if (remaining < this.budget.total * 0.1) return 'low-budget';
  return 'on-track';
});

// Method to add expense
itinerarySchema.methods.addExpense = function(category, amount, description, location) {
  if (!this.budget.expenses) {
    this.budget.expenses = [];
  }
  
  this.budget.expenses.push({
    category,
    amount,
    description,
    location,
    date: new Date()
  });
  
  return this.save();
};

// Method to get budget summary
itinerarySchema.methods.getBudgetSummary = function() {
  if (!this.budget || !this.budget.total) {
    return { total: 0, spent: 0, remaining: 0, percentage: 0 };
  }
  
  const totalExpenses = this.budget.expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const remaining = this.budget.total - totalExpenses;
  const percentage = (totalExpenses / this.budget.total) * 100;
  
  return {
    total: this.budget.total,
    spent: totalExpenses,
    remaining: remaining,
    percentage: Math.round(percentage * 100) / 100
  };
};

// Ensure virtuals are serialized
itinerarySchema.set('toJSON', { virtuals: true });
itinerarySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Itinerary', itinerarySchema);
