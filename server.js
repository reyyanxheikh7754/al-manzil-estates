require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const Contact = require('./models/Contact');

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const requestLog = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 20;
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return res.status(429).json({ success: false, message: 'Too many requests. Please try again in a minute.' });
  }
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  next();
}

function validateContactData({ name, phone, email, message }) {
  const errors = [];
  if (!name || name.trim().length < 2) errors.push('Valid name is required.');
  if (!phone || phone.trim().length < 7) errors.push('Valid phone number is required.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email is required.');
  if (!message || message.trim().length < 5) errors.push('Message is too short.');
  return errors;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.post('/api/contact', rateLimit, async (req, res) => {
  console.log('--- New contact form submission ---');
  try {
    const { name, phone, email, interest, message } = req.body;
    console.log('Received:', { name, phone, email, interest, message: message?.substring(0, 50) });
    const errors = validateContactData({ name, phone, email, message });
    if (errors.length > 0) {
      console.log('Validation errors:', errors);
      return res.status(400).json({ success: false, message: errors.join(' ') });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const RECEIVER_EMAIL = process.env.RECEIVER_EMAIL;
    const SENDER_EMAIL = process.env.SENDER_EMAIL;
    console.log('Env check:', { hasKey: !!BREVO_API_KEY, receiver: RECEIVER_EMAIL, sender: SENDER_EMAIL });

    if (!BREVO_API_KEY || !RECEIVER_EMAIL || !SENDER_EMAIL) {
      console.error('Missing Brevo env variables.');
      return res.status(500).json({ success: false, message: 'Server email configuration error.' });
    }

    const contact = await Contact.create({ name, phone, email, interest, message });

    const emailPayload = {
      sender: { name: 'Al-Manzil Estates Website', email: SENDER_EMAIL },
      to: [{ email: RECEIVER_EMAIL, name: 'Al-Manzil Estates Team' }],
      replyTo: { email, name },
      subject: `New Property Inquiry from ${name} (${interest || 'General'})`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
          <div style="background: #0f1720; padding: 20px 24px;">
            <h2 style="color: #d9ad6f; margin: 0; font-weight: 500;">New Website Inquiry</h2>
          </div>
          <div style="padding: 24px; color: #22201c;">
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Interested In:</strong> ${escapeHtml(interest || 'Not specified')}</p>
            <p><strong>Message:</strong></p>
            <p style="background:#f7f4ee; padding:14px; border-radius:4px;">${escapeHtml(message)}</p>
          </div>
          <div style="background:#efe9dd; padding:14px 24px; font-size:12px; color:#5c574c;">
            Sent automatically from almanzilestates.pk contact form.
          </div>
        </div>
      `
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify(emailPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Brevo API error:', response.status, errText);
      await Contact.findOneAndUpdate({ email, createdAt: { $gte: new Date(Date.now() - 5000) } }, { emailSent: false });
      return res.status(502).json({ success: false, message: 'Failed to send email. Please try again later.' });
    }

    await Contact.findOneAndUpdate({ email, createdAt: { $gte: new Date(Date.now() - 5000) } }, { emailSent: true });

    return res.status(200).json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    console.error('Contact route error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json({ success: true, count: contacts.length, data: contacts });
  } catch (err) {
    console.error('Fetch contacts error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch contacts.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
