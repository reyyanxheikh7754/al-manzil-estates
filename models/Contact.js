const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  interest: {
    type: String,
    enum: ['Buying', 'Selling', 'Renting', 'Investment Advice'],
    default: 'Buying'
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  emailSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Contact', contactSchema);
