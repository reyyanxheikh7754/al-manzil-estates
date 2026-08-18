const mongoose = require('mongoose');

let dbConnected = false;
let Contact = null;

async function connectDB() {
  if (dbConnected) return;
  const MONGODB_URI = process.env.MONGODB_URI;
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

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    await connectDB();
    if (!Contact || !dbConnected) {
      return { statusCode: 503, headers, body: JSON.stringify({ success: false, message: 'Database not connected.' }) };
    }
    const contacts = await Contact.find().sort({ createdAt: -1 });
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, count: contacts.length, data: contacts }) };
  } catch (err) {
    console.error('Fetch contacts error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: 'Failed to fetch contacts.' }) };
  }
};
