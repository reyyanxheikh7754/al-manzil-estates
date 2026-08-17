require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI;
let dbConnected = false;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      dbConnected = true;
      console.log('MongoDB connected');
    })
    .catch(err => {
      console.error('MongoDB error:', err.message);
    });
} else {
  console.log('No MONGODB_URI set - running without database');
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const Contact = MONGODB_URI
  ? require('./models/Contact')
  : null;

const requestLog = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 20;
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return res.status(429).json({ success: false, message: 'Too many requests. Try again later.' });
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

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
  const today = new Date().toISOString().split('T')[0];
  res.set('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
});

app.post('/api/contact', rateLimit, async (req, res) => {
  console.log('--- Contact form submission ---');
  try {
    const { name, phone, email, interest, message } = req.body;
    const errors = validateContactData({ name, phone, email, message });
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join(' ') });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const RECEIVER_EMAIL = process.env.RECEIVER_EMAIL;
    const SENDER_EMAIL = process.env.SENDER_EMAIL;

    if (!BREVO_API_KEY || !RECEIVER_EMAIL || !SENDER_EMAIL) {
      console.error('Missing Brevo env variables');
      return res.status(500).json({ success: false, message: 'Server email config error.' });
    }

    let contact = null;
    if (Contact && dbConnected) {
      try {
        contact = await Contact.create({ name, phone, email, interest, message });
      } catch (dbErr) {
        console.error('DB save failed:', dbErr.message);
      }
    }

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
      console.error('Brevo error:', response.status, errText);
      if (contact) contact.emailSent = false, await contact.save().catch(() => {});
      return res.status(502).json({ success: false, message: 'Failed to send email.' });
    }

    if (contact) contact.emailSent = true, await contact.save().catch(() => {});

    return res.status(200).json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    console.error('Contact route error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: dbConnected, timestamp: new Date().toISOString() });
});

app.get('/api/contacts', async (req, res) => {
  if (!Contact || !dbConnected) {
    return res.status(503).json({ success: false, message: 'Database not connected.' });
  }
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
