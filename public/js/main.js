document.body.classList.add('loading');
const preloader = document.getElementById('preloader');
const loadingBarFill = document.getElementById('loadingBarFill');
let progress = 0;
const loadingInterval = setInterval(() => {
  progress += Math.random() * 18;
  if (progress >= 90) progress = 90;
  loadingBarFill.style.width = progress + '%';
}, 120);

window.addEventListener('load', () => {
  clearInterval(loadingInterval);
  loadingBarFill.style.width = '100%';
  setTimeout(() => {
    preloader.classList.add('hidden');
    document.body.classList.remove('loading');
  }, 350);
});

const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', () => navLinks.classList.remove('open'))
);

const properties = [
  { id: 1, type: 'house', tag: 'For Sale', title: '5 Marla Modern House', location: 'DHA Phase 6, Lahore', price: '1.85 Crore', beds: 4, baths: 4, area: '5 Marla', img: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1974&auto=format&fit=crop' },
  { id: 2, type: 'apartment', tag: 'For Rent', title: 'Luxury 2-Bed Apartment', location: 'Clifton, Karachi', price: '95,000 / mo', beds: 2, baths: 2, area: '1,200 sqft', img: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=2070&auto=format&fit=crop' },
  { id: 3, type: 'plot', tag: 'For Sale', title: '10 Marla Residential Plot', location: 'Bahria Town, Islamabad', price: '95 Lac', beds: null, baths: null, area: '10 Marla', img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2070&auto=format&fit=crop' },
  { id: 4, type: 'house', tag: 'For Sale', title: '1 Kanal Executive Villa', location: 'DHA Phase 8, Lahore', price: '4.5 Crore', beds: 6, baths: 6, area: '1 Kanal', img: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?q=80&w=1974&auto=format&fit=crop' },
  { id: 5, type: 'commercial', tag: 'For Sale', title: 'Corner Commercial Plaza', location: 'Blue Area, Islamabad', price: '3.2 Crore', beds: null, baths: null, area: '2,400 sqft', img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2070&auto=format&fit=crop' },
  { id: 6, type: 'apartment', tag: 'For Sale', title: 'Sea View 3-Bed Apartment', location: 'Bahria Town, Karachi', price: '2.1 Crore', beds: 3, baths: 3, area: '1,850 sqft', img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2070&auto=format&fit=crop' }
];

const grid = document.getElementById('propertyGrid');

function renderProperties(filter = 'all') {
  const list = filter === 'all' ? properties : properties.filter(p => p.type === filter);
  grid.innerHTML = list.map(p => `
    <div class="property-card" data-type="${p.type}">
      <div class="card-img">
        <img src="${p.img}" alt="${p.title}" loading="lazy">
        <span class="card-tag">${p.tag}</span>
      </div>
      <div class="card-body">
        <div class="card-price">PKR ${p.price} ${p.type !== 'plot' ? '<span>/ negotiable</span>' : ''}</div>
        <div class="card-title">${p.title}</div>
        <div class="card-loc">📍 ${p.location}</div>
        <div class="card-meta">
          ${p.beds ? `<span><strong>${p.beds}</strong> Beds</span>` : ''}
          ${p.baths ? `<span><strong>${p.baths}</strong> Baths</span>` : ''}
          <span><strong>${p.area}</strong></span>
        </div>
      </div>
    </div>
  `).join('');
}
renderProperties();

document.getElementById('filterTabs').addEventListener('click', (e) => {
  if (!e.target.classList.contains('tab')) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  renderProperties(e.target.dataset.filter);
});

document.getElementById('heroSearch').addEventListener('submit', (e) => {
  e.preventDefault();
  const type = document.getElementById('type').value;
  document.getElementById('properties').scrollIntoView({ behavior: 'smooth' });
  if (type) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.filter === type));
    renderProperties(type);
  }
});

const testimonials = [
  { name: 'Ahmed Raza', role: 'Bought a house in DHA Lahore', quote: 'Al-Manzil made the entire process transparent. Every document was verified before we paid a single rupee.' },
  { name: 'Sana Malik', role: 'Rented apartment in Karachi', quote: 'Quick response, honest advice, and no hidden charges. Highly recommend to anyone searching in Karachi.' },
  { name: 'Bilal Hussain', role: 'Sold plot in Islamabad', quote: 'They found a genuine buyer within two weeks and handled all the transfer paperwork themselves.' }
];
document.getElementById('testiTrack').innerHTML = testimonials.map(t => `
  <div class="testi-card">
    <p class="testi-quote">"${t.quote}"</p>
    <p class="testi-name">${t.name}</p>
    <p class="testi-role">${t.role}</p>
  </div>
`).join('');

const API_BASE = 'http://localhost:3000';

const contactForm = document.getElementById('contactForm');
const submitBtn = document.getElementById('submitBtn');
const formStatus = document.getElementById('formStatus');

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    name: document.getElementById('name').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    interest: document.getElementById('interest').value,
    message: document.getElementById('message').value.trim()
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  formStatus.textContent = '';
  formStatus.className = 'form-status';

  try {
    const res = await fetch(`${API_BASE}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (res.ok && result.success) {
      formStatus.textContent = 'Thank you! We will contact you within 24 hours.';
      formStatus.className = 'form-status success';
      contactForm.reset();
    } else {
      throw new Error(result.message || 'Something went wrong');
    }
  } catch (err) {
    console.error('Contact form error:', err);
    formStatus.textContent = `Failed: ${err.message || 'Server unreachable. Make sure server is running (npm start).'}`;
    formStatus.className = 'form-status error';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Message';
  }
});
