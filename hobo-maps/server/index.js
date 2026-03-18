'use strict';

// ═══════════════════════════════════════════════════════════════
// maps.hobo.tools — Survival Map for North America
// Express server that proxies 18+ data sources for camping,
// resources, shelter, and survival information.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const NodeCache = require('node-cache');

const config = require('./config');

const app = express();
const cache = new NodeCache({ stdTTL: config.cache.search, checkperiod: 60 });

// ── Middleware ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "static.cloudflareinsights.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "*.tile.openstreetmap.org", "*.basemaps.cartocdn.com", "server.arcgisonline.com", "image.tmdb.org", "*.wp.com"],
      connectSrc: ["'self'", "nominatim.openstreetmap.org", "api.weather.gov", "api.open-meteo.com", "*.tile.openstreetmap.org", "*.basemaps.cartocdn.com", "server.arcgisonline.com"],
      fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors({ origin: ['https://maps.hobo.tools', 'https://food.hobo.tools', 'https://hobo.tools', 'http://localhost:3300', 'http://localhost:3301'] }));
app.use(express.json());

// Rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests — slow down, hobo.' },
});
app.use('/api/', apiLimiter);

// ── Static files ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1h',
  extensions: ['html'],
}));

// ── Source modules ─────────────────────────────────────────
const utils = require('./sources/utils');
const ridb = require('./sources/ridb');
const overpass = require('./sources/overpass');
const freecampsites = require('./sources/freecampsites');
const ioverlander = require('./sources/ioverlander');
const staticData = require('./sources/static-data');
const bridges = require('./sources/bridges');
const bathrooms = require('./sources/bathrooms');
const resources = require('./sources/resources');
const usfs = require('./sources/usfs');
const woods = require('./sources/woods');
const waterways = require('./sources/waterways');
const nps = require('./sources/nps');
const openchargemap = require('./sources/openchargemap');
const scraper = require('./sources/scraper');
const cover = require('./sources/cover');
const crimedata = require('./sources/crimedata');
const harmreduction = require('./sources/harmreduction');
const weather = require('./sources/weather');
const terrain = require('./sources/terrain');
const grocery = require('./sources/grocery');

// ── Geocode endpoint ───────────────────────────────────────
app.get('/api/geocode', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const cacheKey = `geo:${q.toLowerCase().trim()}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const axios = require('axios');
    const resp = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q, format: 'json', limit: 5, countrycodes: 'us,ca,mx' },
      headers: { 'User-Agent': 'HoboMaps/1.0 (maps.hobo.tools)' },
      timeout: 8000,
    });
    const results = (resp.data || []).map(r => ({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      name: r.display_name,
      type: r.type,
    }));
    cache.set(cacheKey, results, config.cache.geocode);
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'Geocode failed' });
  }
});

// ── Master search endpoint ─────────────────────────────────
app.get('/api/search', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const radius = Math.min(parseFloat(req.query.radius) || 15, 50);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'Invalid lat/lon' });
  }

  const cacheKey = `search:${lat.toFixed(3)}:${lon.toFixed(3)}:${radius}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  // Run all sources in parallel with individual timeouts
  const sources = [
    { name: 'RIDB', fn: () => ridb.search(lat, lon, radius, config.ridbApiKey) },
    { name: 'OpenStreetMap', fn: () => overpass.search(lat, lon, radius) },
    { name: 'FreeCampsites', fn: () => freecampsites.search(lat, lon, radius) },
    { name: 'iOverlander', fn: () => ioverlander.search(lat, lon, radius) },
    { name: 'Built-in DB', fn: () => Promise.resolve(staticData.search(lat, lon, radius)) },
    { name: 'Bridges', fn: () => bridges.findBridges(lat, lon, radius) },
    { name: 'Bathrooms', fn: () => bathrooms.findAllBathrooms(lat, lon, radius * 1609.34) },
    { name: 'Resources', fn: () => resources.findResources(lat, lon, radius) },
    { name: 'USFS', fn: () => usfs.search(lat, lon, radius) },
    { name: 'Woods', fn: () => woods.findWoods(lat, lon, radius) },
    { name: 'Waterways', fn: () => waterways.findWaterways(lat, lon, radius) },
    { name: 'NPS', fn: () => nps.search(lat, lon, radius, config.npsApiKey) },
    { name: 'OpenChargeMap', fn: () => openchargemap.search(lat, lon, radius, config.openChargeMapKey) },
    { name: 'WebScraper', fn: () => scraper.search(lat, lon, radius) },
    { name: 'Rain Cover', fn: () => cover.findCover(lat, lon, radius) },
    { name: 'Crime Intel', fn: () => crimedata.findSketchAreas(lat, lon, radius) },
    { name: 'Harm Reduction', fn: () => harmreduction.findHarmReduction(lat, lon, radius) },
  ];

  const TIMEOUT = 30000;
  const results = { locations: [], bridges: [], crimeHeatmap: [], sourceMeta: {} };

  const settled = await Promise.allSettled(
    sources.map(s =>
      Promise.race([
        s.fn().then(data => ({ name: s.name, data })),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT)),
      ])
    )
  );

  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    const { name, data } = result.value;
    try {
      if (name === 'Bridges' && data?.bridges) {
        results.bridges = data.bridges.map(b => ({
          ...b, source: 'Bridges', sourceIcon: 'fa-bridge',
          type: `Bridge (${b.serviceUnder || 'Unknown'})`,
        }));
        results.sourceMeta.Bridges = { count: data.bridges.length };
      } else if (name === 'Crime Intel' && data) {
        results.crimeHeatmap = data.heatmapPoints || [];
        if (data.locations) results.locations.push(...data.locations);
        results.sourceMeta['Crime Intel'] = { count: data.totalIndicators || 0 };
      } else if (name === 'Resources' && data?.resources) {
        results.locations.push(...data.resources.map(r => ({
          ...r, source: 'Resources', sourceIcon: r.icon || 'fa-hand-holding-heart',
          type: r.typeLabel || r.resourceType || 'Resource',
        })));
        results.sourceMeta.Resources = { count: data.total || 0 };
      } else if (name === 'Woods' && data?.woods) {
        results.locations.push(...data.woods.map(w => ({
          ...w, source: 'Woods', sourceIcon: w.icon || 'fa-tree',
        })));
        results.sourceMeta.Woods = { count: data.total || 0 };
      } else if (name === 'Waterways' && data?.waterways) {
        results.locations.push(...data.waterways.map(w => ({
          ...w, source: 'Waterways', sourceIcon: w.icon || 'fa-water',
        })));
        results.sourceMeta.Waterways = { count: data.summary?.total || 0 };
      } else if (name === 'Rain Cover' && data?.cover) {
        results.locations.push(...data.cover.map(c => ({
          ...c, source: 'Rain Cover', sourceIcon: c.coverIcon || 'fa-umbrella',
          type: c.coverLabel || 'Covered Structure',
        })));
        results.sourceMeta['Rain Cover'] = { count: data.total || 0 };
      } else if (name === 'Harm Reduction' && data?.services) {
        results.locations.push(...data.services.map(hr => ({
          ...hr, source: 'Harm Reduction', sourceIcon: hr.icon || 'fa-hand-holding-heart',
          type: hr.typeLabel || 'Harm Reduction',
        })));
        results.sourceMeta['Harm Reduction'] = { count: data.services.length };
      } else if (name === 'Bathrooms' && data?.bathrooms) {
        results.locations.push(...data.bathrooms.map(b => ({
          ...b, source: 'Bathrooms', sourceIcon: 'fa-restroom',
          type: b.type || 'Bathroom',
        })));
        results.sourceMeta.Bathrooms = { count: data.bathrooms.length };
      } else if (Array.isArray(data)) {
        results.locations.push(...data);
        results.sourceMeta[name] = { count: data.length };
      }
    } catch (e) {
      console.warn(`[Search] Error processing ${name}:`, e.message);
    }
  }

  // Deduplicate by spatial proximity
  results.locations = utils.dedup(results.locations);
  results.totalSources = sources.length;
  results.totalLocations = results.locations.length;

  cache.set(cacheKey, results);
  res.json(results);
});

// ── Individual source endpoints ────────────────────────────
app.get('/api/weather', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: 'Invalid coords' });

  const ck = `wx:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const cached = cache.get(ck);
  if (cached) return res.json(cached);

  try {
    const data = await weather.getWeather(lat, lon);
    cache.set(ck, data, config.cache.weather);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/terrain', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: 'Invalid coords' });
  try {
    const data = await terrain.getTerrainInfo(lat, lon);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/food-banks', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const radius = Math.min(parseFloat(req.query.radius) || 10, 25) * 1609.34;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: 'Invalid coords' });
  try {
    const data = await grocery.findFoodBanks(lat, lon, radius);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/stores', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: 'Invalid coords' });
  try {
    const data = await grocery.findNearbyStores(lat, lon);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/foods', (req, res) => {
  const filters = {
    group: req.query.group || null,
    campFriendly: req.query.campFriendly === 'true',
    shelfStable: req.query.shelfStable === 'true',
    search: req.query.search || null,
  };
  res.json(grocery.getAllFoods(filters));
});

app.get('/api/meal-plan', (req, res) => {
  const budget = parseFloat(req.query.budget) || 20;
  const days = parseInt(req.query.days) || 3;
  const prefs = {
    campFriendlyOnly: req.query.campFriendly === 'true',
    shelfStableOnly: req.query.shelfStable === 'true',
    randomize: req.query.randomize === 'true',
  };
  res.json(grocery.optimizeMealPlan(budget, days, prefs));
});

// ── SPA fallback ───────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Start ──────────────────────────────────────────────────
app.listen(config.port, config.host, () => {
  console.log(`[HoboMaps] 🗺️  maps.hobo.tools listening on ${config.host}:${config.port}`);
});
