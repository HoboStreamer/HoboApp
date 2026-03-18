/**
 * food.hobo.tools — Lightweight frontend server
 * Proxies food API calls to hobo-maps backend (port 3300)
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const cookieParser = require('cookie-parser');

const PORT = parseInt(process.env.PORT) || 3301;
const MAPS_API = process.env.MAPS_API || 'http://127.0.0.1:3300';

const app = express();

app.set('trust proxy', 1);
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'image.tmdb.org', '*.tile.openstreetmap.org', '*.basemaps.cartocdn.com', 'server.arcgisonline.com'],
      connectSrc: ["'self'", 'nominatim.openstreetmap.org', 'https://hobo.tools'],
    },
  },
}));
app.use(rateLimit({ windowMs: 60000, max: 60 }));
app.use(cookieParser());

// Serve hobo-shared client-side libs
const sharedPath = path.resolve(__dirname, '..', '..', 'packages', 'hobo-shared');
app.use('/shared', express.static(sharedPath, {
  setHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=300');
  },
}));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1d' }));

// Proxy food-related API calls to hobo-maps backend
function proxyToMaps(apiPath) {
  return async (req, res) => {
    const qs = new URL(req.url, `http://localhost`).search;
    const url = `${MAPS_API}${apiPath}${qs}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (e) {
      res.status(502).json({ error: 'Backend unavailable' });
    }
  };
}

app.get('/api/food-banks', proxyToMaps('/api/food-banks'));
app.get('/api/stores', proxyToMaps('/api/stores'));
app.get('/api/foods', proxyToMaps('/api/foods'));
app.get('/api/meal-plan', proxyToMaps('/api/meal-plan'));
app.get('/api/geocode', proxyToMaps('/api/geocode'));

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[HoboFood] 🍽️  food.hobo.tools listening on 127.0.0.1:${PORT}`);
});
