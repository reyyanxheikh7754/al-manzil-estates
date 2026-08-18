require('dotenv').config();
const mongoose = require('mongoose');

let dbConnected = false;
let Contact = null;

const MONGODB_URI = process.env.MONGODB_URI;

async function connectDB() {
  if (dbConnected) return;
  if (!MONGODB_URI) return;
  try {
    await mongoose.connect(MONGODB_URI);
    dbConnected = true;
    const contactSchema = new mongoose.Schema({
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      interest: { type: String, default: 'Buying' },
      message: { type: String, required: true, trim: true },
      emailSent: { type: Boolean, default: false }
    }, { timestamps: true });
    Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);
  } catch (err) {
    console.error('MongoDB error:', err.message);
  }
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
  }

  try {
    await connectDB();

    const data = JSON.parse(event.body || '{}');
    const { name, phone, email, interest, message } = data;

    const errors = [];
    if (!name || name.trim().length < 2) errors.push('Valid name is required.');
    if (!phone || phone.trim().length < 7) errors.push('Valid phone number is required.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email is required.');
    if (!message || message.trim().length < 5) errors.push('Message is too short.');
    if (errors.length > 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: errors.join(' ') }) };
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const RECEIVER_EMAIL = process.env.RECEIVER_EMAIL;
    const SENDER_EMAIL = process.env.SENDER_EMAIL;

    if (!BREVO_API_KEY || !RECEIVER_EMAIL || !SENDER_EMAIL) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: 'Server email config error.' }) };
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
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          <div style="background:#0f1720;padding:20px 24px;">
            <h2 style="color:#d9ad6f;margin:0;font-weight:500;">New Website Inquiry</h2>
          </div>
          <div style="padding:24px;color:#22201c;">
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Interested In:</strong> ${escapeHtml(interest || 'Not specified')}</p>
            <p><strong>Message:</strong></p>
            <p style="background:#f7f4ee;padding:14px;border-radius:4px;">${escapeHtml(message)}</p>
          </div>
          <div style="background:#efe9dd;padding:14px 24px;font-size:12px;color:#5c574c;">
            Sent automatically from almanzilestates.pk contact form.
          </div>
        </div>`
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
      if (contact) { contact.emailSent = false; await contact.save().catch(() => {}); }
      return { statusCode: 502, headers, body: JSON.stringify({ success: false, message: 'Failed to send email.' }) };
    }

    if (contact) { contact.emailSent = true; await contact.save().catch(() => {}); }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Message sent successfully.' }) };
  } catch (err) {
    console.error('Contact function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: 'Internal server error.' }) };
  }
};
