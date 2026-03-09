/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║                     H O B O C A M P   v2.0                    ║
 * ║         Washington State Stealth Camp & Shelter Locator          ║
 * ║              "Ride the rails. Leave no trace."                   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Electron Main Process
 *
 * Data Sources (20 integrated):
 *   1. RIDB / Recreation.gov API
 *   2. OpenStreetMap Overpass API
 *   3. FreeCampsites.net
 *   4. iOverlander
 *   5. FHWA NBI Bridges + OSM bridge queries (expanded: covered, trestle, viaduct, boardwalk, etc.)
 *   6. Refuge Restrooms + OSM bathroom queries
 *   7. Survival Resources (OSM: water, showers, libraries, laundry, food banks, WiFi)
 *   8. USFS Recreation Opportunities (National Forest campgrounds, trailheads)
 *   9. Reddit (r/StealthCamping, r/WashingtonHiking, etc.)
 *  10. NWS Weather API + Open-Meteo
 *  11. Terrain / Elevation analysis
 *  12. Built-in curated database (167+ WA locations)
 *  13. Waterways (rivers, streams, lakes, springs, fords, fishing spots, boat launches)
 *  14. National Park Service API (campgrounds, visitor centers, parking lots)
 *  15. OpenChargeMap (EV charging stations for van/vehicle dwellers)
 *  16. Web Scrapers (Campendium, USGS GNIS, overnight parking via OSM)
 *  17. Rain Cover (awnings, arcades, canopies, carports, porches, covered walkways + 45 curated WA spots)
 *  18. Crime Intel
 *  19. Free WiFi (dedicated OSM WiFi hotspot finder)
 *  20. Harm Reduction (needle exchanges, condoms, naloxone, community health) (sketch area heatmap via OSM grit indicators + 22 curated WA danger/content zones)
 */

const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const NodeCache = require('node-cache');

app.commandLine.appendSwitch('no-sandbox');

// ─── Search Cache (5-min TTL, auto-purge every 60s) ────────────────
const searchCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

function cacheKey(prefix, lat, lon, radius) {
  return `${prefix}-${lat.toFixed(3)}-${lon.toFixed(3)}-${radius}`;
}

async function cachedCall(key, fn) {
  const hit = searchCache.get(key);
  if (hit) { console.log(`[Cache HIT] ${key}`); return hit; }
  const result = await fn();
  searchCache.set(key, result);
  console.log(`[Cache SET] ${key}`);
  return result;
}

// ─── Data Modules ───────────────────────────────────────────────────
const ridb = require('./modules/ridb');
const overpass = require('./modules/overpass');
const freecampsites = require('./modules/freecampsites');
const staticData = require('./modules/static-data');
const geocoder = require('./modules/geocoder');
const weather = require('./modules/weather');
const reddit = require('./modules/reddit');
const ioverlander = require('./modules/ioverlander');
const terrain = require('./modules/terrain');
const transit = require('./modules/transit');
const grocery = require('./modules/grocery');
const bathrooms = require('./modules/bathrooms');
const bridges = require('./modules/bridges');
const resources = require('./modules/resources');
const usfs = require('./modules/usfs');
const woods = require('./modules/woods');
const waterways = require('./modules/waterways');
const nps = require('./modules/nps');
const openchargemap = require('./modules/openchargemap');
const scraper = require('./modules/scraper');
const cover = require('./modules/cover');
const crimedata = require('./modules/crimedata');
const wifi = require('./modules/wifi');
const harmreduction = require('./modules/harmreduction');
const { dedup } = require('./modules/utils');

// ─── User Data Persistence ─────────────────────────────────────────
const userDataPath = path.join(app.getPath('userData'), 'hoboapp-data.json');
const windowStatePath = path.join(app.getPath('userData'), 'hoboapp-window.json');

function loadUserData() {
  try {
    if (fs.existsSync(userDataPath)) {
      return JSON.parse(fs.readFileSync(userDataPath, 'utf8'));
    }
  } catch (e) { console.warn('User data load error:', e.message); }
  return { favorites: [], notes: {}, recentSearches: [], settings: { theme: 'dark', radius: 25, mapStyle: 'dark' }, customLocations: [], apiKeys: {} };
}

function saveUserData(data) {
  try {
    fs.writeFileSync(userDataPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { console.warn('User data save error:', e.message); }
}

// ─── Window State Persistence ───────────────────────────────────────
function loadWindowState() {
  try {
    if (fs.existsSync(windowStatePath)) {
      const state = JSON.parse(fs.readFileSync(windowStatePath, 'utf8'));
      // Validate that the saved bounds are on a visible screen
      const { screen } = require('electron');
      const displays = screen.getAllDisplays();
      const onScreen = displays.some(d => {
        const b = d.bounds;
        return state.x >= b.x - 50 && state.y >= b.y - 50 &&
               state.x < b.x + b.width && state.y < b.y + b.height;
      });
      if (onScreen && state.width > 100 && state.height > 100) return state;
    }
  } catch (e) { /* ignore corrupt file */ }
  return null;
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const isMax = mainWindow.isMaximized();
    const bounds = isMax ? (mainWindow._lastNormalBounds || mainWindow.getBounds()) : mainWindow.getBounds();
    fs.writeFileSync(windowStatePath, JSON.stringify({
      x: bounds.x, y: bounds.y,
      width: bounds.width, height: bounds.height,
      isMaximized: isMax,
    }), 'utf8');
  } catch (e) { /* ignore write errors */ }
}

let mainWindow;
let userData = {};

function createWindow() {
  const saved = loadWindowState();

  mainWindow = new BrowserWindow({
    x: saved?.x,
    y: saved?.y,
    width: saved?.width || 1500,
    height: saved?.height || 950,
    minWidth: 900,
    minHeight: 600,
    title: 'HoboApp',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#05060f',
    show: false,
  });

  if (saved?.isMaximized) mainWindow.maximize();

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Save window state on every move/resize (crash-safe)
  let saveTimer;
  const debouncedSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveWindowState, 500);
  };

  mainWindow.on('move', () => {
    if (!mainWindow.isMaximized()) mainWindow._lastNormalBounds = mainWindow.getBounds();
    debouncedSave();
  });
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) mainWindow._lastNormalBounds = mainWindow.getBounds();
    debouncedSave();
  });
  mainWindow.on('maximize', debouncedSave);
  mainWindow.on('unmaximize', debouncedSave);
}

app.whenReady().then(() => {
  // Remove default menu bar (File, Edit, View, Help, etc.)
  Menu.setApplicationMenu(null);
  userData = loadUserData();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ═══════════════════════════════════════════════════════════════════
// IPC HANDLERS
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('geocode-address', async (_e, address) => {
  try { return await geocoder.geocode(address); }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('search-locations', async (_e, { lat, lon, radiusMiles = 25, query = '' }) => {
  const results = [];
  const errors = [];
  const sourceTimings = {};
  const BATHROOM_TYPES = bathrooms.BATHROOM_TYPES;
  const apiKeys = userData.apiKeys || {};
  const disabledSources = userData.settings?.disabledSources || [];

  const sources = [
    { name: 'RIDB', fn: () => ridb.search(lat, lon, radiusMiles) },
    { name: 'OpenStreetMap', fn: () => overpass.search(lat, lon, radiusMiles) },
    { name: 'FreeCampsites', fn: () => freecampsites.search(lat, lon, radiusMiles) },
    { name: 'iOverlander', fn: () => ioverlander.search(lat, lon, radiusMiles) },
    { name: 'Built-in DB', fn: () => staticData.search(lat, lon, radiusMiles) },
    {
      name: 'Bridges',
      fn: async () => {
        const { bridges: bridgeList } = await bridges.findBridges(lat, lon, Math.min(radiusMiles, 10));
        // Convert bridge objects to standard location format
        return bridgeList.map(b => ({
          id: b.id,
          name: b.name || 'Unnamed Bridge',
          description: [
            b.underDescription || '',
            b.material ? `Material: ${b.material}` : '',
            b.structureType && b.structureType !== 'Unknown' ? `Structure: ${b.structureType}` : '',
            b.clearanceFeet ? `Clearance: ${b.clearanceFeet} ft` : '',
            b.lengthFeet && b.lengthFeet !== '0' ? `Length: ${b.lengthFeet} ft` : '',
            b.widthFeet && b.widthFeet !== '0' ? `Width: ${b.widthFeet} ft` : '',
            b.featureCrossed ? `Crosses: ${b.featureCrossed}` : '',
            b.facilityCarried ? `Carries: ${b.facilityCarried}` : '',
            b.yearBuilt ? `Built: ${b.yearBuilt}` : '',
            b.shelterScore != null ? `Shelter Score: ${b.shelterScore}/100` : '',
          ].filter(Boolean).join(' | ') || 'Bridge location — potential rain shelter underneath.',
          lat: b.lat,
          lon: b.lon,
          distanceMiles: Math.round(b.distanceMiles * 10) / 10,
          type: b.underCategory === 'water' ? 'Bridge (River/Creek)' :
                b.underCategory === 'road' ? 'Bridge (Overpass)' :
                b.underCategory === 'railroad' ? 'Bridge (Railroad)' :
                b.underCategory === 'path' ? 'Bridge (Pedestrian)' :
                'Bridge',
          source: 'Bridges',
          sourceIcon: 'fa-bridge',
          reservable: false,
          url: b.id.startsWith('osm-') ? `https://www.openstreetmap.org/way/${b.id.replace('osm-bridge-', '')}` : null,
          fee: 'Free',
          stealthRating: Math.round(b.shelterScore / 20) || 3,
          tags: [
            'bridge', 'rain-cover', 'free',
            b.underCategory ? `under-${b.underCategory}` : '',
            b.material ? b.material.toLowerCase() : '',
          ].filter(Boolean),
          amenities: [],
          shelterScore: b.shelterScore,
          bridgeData: {
            underCategory: b.underCategory,
            clearanceFeet: b.clearanceFeet,
            lengthFeet: b.lengthFeet,
            widthFeet: b.widthFeet,
            material: b.material,
            owner: b.owner,
          },
        }));
      },
    },
    {
      name: 'Bathrooms',
      fn: async () => {
        const radiusMeters = Math.min(radiusMiles, 15) * 1609.344;
        const { bathrooms: bathroomList } = await bathrooms.findAllBathrooms(lat, lon, radiusMeters);
        return bathroomList.map(b => {
          const bType = BATHROOM_TYPES[b.type] || BATHROOM_TYPES.unknown;
          const descParts = [
            b.hours ? `Hours: ${b.hours}` : '',
            b.fee === true ? 'Fee required' : b.fee === false ? 'Free' : '',
            b.accessible ? 'Wheelchair accessible' : '',
            b.hasShower ? '🚿 Has shower' : '',
            b.hotWater === 'yes' ? '♨️ Hot water' : b.hotWater === 'no' ? '❄️ Cold only' : '',
            b.hasDrinkingWater ? 'Has drinking water' : '',
            b.access === 'customers' ? '🔑 Membership/day pass required' : '',
            b.operator ? `Operator: ${b.operator}` : '',
            b.comment || '',
          ].filter(Boolean);
          return {
            id: b.id,
            name: b.name || 'Public Restroom',
            description: descParts.join(' | ') || 'Public restroom location.',
            lat: b.lat,
            lon: b.lon,
            distanceMiles: Math.round(b.distanceMiles * 10) / 10,
            type: b.type === 'gym_shower' ? 'Gym Shower' :
                  b.type === 'pool_shower' ? 'Pool/Sports Shower' :
                  b.type === 'hot_spring' ? 'Hot Spring' :
                  b.hasShower ? 'Shower Facility' :
                  b.hasDrinkingWater && b.type === 'water' ? 'Water Source' :
                  `Restroom (${bType.label})`,
            source: 'Bathrooms',
            sourceIcon: b.type === 'gym_shower' ? 'fa-dumbbell' :
                        b.type === 'pool_shower' ? 'fa-person-swimming' :
                        b.type === 'hot_spring' ? 'fa-hot-tub-person' :
                        b.hasShower ? 'fa-shower' : 'fa-restroom',
            reservable: false,
            url: b.id.startsWith('osm-') ? `https://www.openstreetmap.org/node/${b.id.replace('osm-', '')}` : null,
            fee: b.fee === true ? 'Fee required' : b.fee === false ? 'Free' : 'Unknown',
            stealthRating: Math.round((b.utilityScore || 50) / 20) || 2,
            tags: [
              'restroom',
              b.accessible ? 'accessible' : '',
              b.hasShower ? 'shower' : '',
              b.hasDrinkingWater ? 'water' : '',
              b.hours === '24/7' ? '24-7' : '',
              b.fee === false ? 'free' : '',
              b.type === 'gym_shower' ? 'gym' : '',
              b.type === 'pool_shower' ? 'pool' : '',
              b.type === 'hot_spring' ? 'hot-spring' : '',
              b.hotWater === 'yes' ? 'hot-water' : '',
            ].filter(Boolean),
            amenities: [
              b.hasShower ? 'Shower' : '',
              b.hotWater === 'yes' ? 'Hot Water' : '',
              b.hasDrinkingWater ? 'Drinking Water' : '',
              b.accessible ? 'Wheelchair Accessible' : '',
              b.changingTable ? 'Changing Table' : '',
            ].filter(Boolean),
          };
        });
      },
    },
    {
      name: 'Resources',
      fn: async () => {
        const { resources: resList } = await resources.findResources(lat, lon, Math.min(radiusMiles, 15));
        return resList.map(r => ({
          id: r.id,
          name: r.name,
          description: [
            r.description || '',
            r.hours ? `Hours: ${r.hours}` : '',
            r.phone ? `Phone: ${r.phone}` : '',
            r.wheelchair ? 'Wheelchair accessible' : '',
          ].filter(Boolean).join(' | '),
          lat: r.lat,
          lon: r.lon,
          distanceMiles: r.distanceMiles,
          type: r.typeLabel,
          source: 'Resources',
          sourceIcon: r.icon,
          reservable: false,
          url: r.website || r.osmUrl,
          fee: r.fee === true ? 'Fee required' : r.fee === false ? 'Free' : 'Unknown',
          stealthRating: 1,
          tags: [r.resourceType, ...(r.amenities || []).map(a => a.toLowerCase())],
          amenities: r.amenities || [],
          resourceType: r.resourceType,
          resourceColor: r.color,
        }));
      },
    },
    {
      name: 'USFS',
      fn: () => usfs.search(lat, lon, radiusMiles),
    },
    {
      name: 'Woods',
      fn: async () => {
        const { woods: woodsList } = await woods.findWoods(lat, lon, Math.min(radiusMiles, 15));
        return woodsList.map(w => ({
          id: w.id,
          name: w.name,
          description: w.description,
          lat: w.lat,
          lon: w.lon,
          distanceMiles: w.distanceMiles,
          type: w.type,
          source: 'Woods',
          sourceIcon: w.icon || 'fa-tree',
          reservable: false,
          url: w.url,
          fee: w.fee,
          stealthRating: w.stealthRating,
          tags: w.tags || [],
          amenities: w.amenities || [],
          woodsType: w.woodsType,
          color: w.color,
        }));
      },
    },
    {
      name: 'Waterways',
      fn: async () => {
        const { waterways: waterwayList } = await waterways.findWaterways(lat, lon, Math.min(radiusMiles, 15));
        return waterwayList.map(w => ({
          id: w.id,
          name: w.name,
          description: w.description,
          lat: w.lat,
          lon: w.lon,
          distanceMiles: w.distanceMiles,
          type: w.type,
          source: 'Waterways',
          sourceIcon: w.icon || 'fa-water',
          reservable: false,
          url: w.url,
          fee: w.fee,
          stealthRating: w.stealthRating,
          tags: w.tags || [],
          amenities: w.amenities || [],
          waterwayType: w.waterwayType,
          color: w.color,
        }));
      },
    },
    {
      name: 'NPS',
      fn: () => nps.search(lat, lon, radiusMiles, apiKeys.nps),
    },
    {
      name: 'OpenChargeMap',
      fn: () => openchargemap.search(lat, lon, radiusMiles, apiKeys.openchargemap),
    },
    {
      name: 'WebScraper',
      fn: () => scraper.search(lat, lon, radiusMiles),
    },
    {
      name: 'Rain Cover',
      fn: async () => {
        const { cover: coverList } = await cover.findCover(lat, lon, Math.min(radiusMiles, 15));
        return coverList.map(c => ({
          id: `cover-${c.lat.toFixed(5)}-${c.lon.toFixed(5)}`,
          name: c.name,
          description: c.description,
          lat: c.lat,
          lon: c.lon,
          distanceMiles: c.distanceMiles,
          type: c.coverLabel || 'Covered Structure',
          source: 'Rain Cover',
          sourceIcon: 'fa-umbrella',
          reservable: false,
          url: null,
          fee: 'Free',
          stealthRating: c.stealthRating || 2,
          tags: ['rain-cover', 'shelter', c.subType || 'cover', ...(c.tags || [])],
          amenities: c.lit ? ['Lit at night'] : [],
          coverType: c.subType,
          coverColor: c.coverColor,
          curated: c.curated || false,
        }));
      },
    },
    {
      name: 'Crime Intel',
      fn: async () => {
        const result = await crimedata.findSketchAreas(lat, lon, Math.min(radiusMiles, 12));
        // Send heatmap data to renderer via separate IPC event
        try {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('crime-heatmap-data', {
              heatmapPoints: result.heatmapPoints,
              indicators: result.totalIndicators,
              zones: result.totalZones,
              counts: result.counts,
            });
          }
        } catch (_) {}
        return result.locations;
      },
    },
    {
      name: 'Free WiFi',
      fn: async () => {
        const { wifi: wifiSpots } = await wifi.findWifi(lat, lon, Math.min(radiusMiles, 15));
        return wifiSpots.map(w => ({
          id: w.id,
          name: w.name,
          description: w.description,
          lat: w.lat,
          lon: w.lon,
          distanceMiles: w.distanceMiles,
          type: w.typeLabel,
          source: 'Free WiFi',
          sourceIcon: w.icon || 'fa-wifi',
          reservable: false,
          url: w.website || null,
          fee: w.fee === 'no' ? 'Free' : w.fee === 'customers' ? 'Free for customers' : 'Unknown',
          stealthRating: 1,
          tags: ['wifi', 'free', w.wifiType],
          amenities: w.amenities || [],
          wifiType: w.wifiType,
          wifiColor: w.color,
        }));
      },
    },
    {
      name: 'Harm Reduction',
      fn: async () => {
        const { services } = await harmreduction.findHarmReduction(lat, lon, Math.min(radiusMiles, 20));
        return services.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          lat: s.lat,
          lon: s.lon,
          distanceMiles: s.distanceMiles,
          type: s.typeLabel,
          source: 'Harm Reduction',
          sourceIcon: s.icon || 'fa-syringe',
          reservable: false,
          url: s.website || null,
          fee: s.fee === false ? 'Free' : s.fee === true ? 'Fee required' : 'Varies',
          stealthRating: 1,
          tags: ['harm-reduction', s.hrType],
          amenities: s.amenities || [],
          hrType: s.hrType,
          hrColor: s.color,
        }));
      },
    },
  ].filter(s => !disabledSources.includes(s.name));

  // Send progress events as each source starts and completes
  const sendProgress = (name, status, count, elapsed) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('search-progress', { name, status, count, elapsed });
      }
    } catch (_) {}
  };

  // Send partial results as each source completes (progressive loading)
  const sendPartialResults = (sourceName, locations) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed() && Array.isArray(locations) && locations.length > 0) {
        mainWindow.webContents.send('search-partial-results', { source: sourceName, locations });
      }
    } catch (_) {}
  };

  // Notify renderer of all sources about to start
  for (const s of sources) sendProgress(s.name, 'pending', 0, 0);

  const settled = await Promise.allSettled(sources.map(async (s) => {
    sendProgress(s.name, 'loading', 0, 0);
    const t0 = Date.now();
    try {
      const r = await s.fn();
      const elapsed = Date.now() - t0;
      sourceTimings[s.name] = elapsed;
      const count = Array.isArray(r) ? r.length : 0;
      sendProgress(s.name, 'done', count, elapsed);
      // Emit partial results immediately so map updates as each source finishes
      sendPartialResults(s.name, r);
      return r;
    } catch (err) {
      const elapsed = Date.now() - t0;
      sourceTimings[s.name] = elapsed;
      sendProgress(s.name, 'error', 0, elapsed);
      throw err;
    }
  }));

  settled.forEach((r, i) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) results.push(...r.value);
    else errors.push({ source: sources[i].name, error: r.status === 'rejected' ? r.reason?.message : 'No results' });
  });

  const unique = dedup(results);
  unique.sort((a, b) => a.distanceMiles - b.distanceMiles);

  userData.recentSearches = [
    { query, lat, lon, radiusMiles, count: unique.length, date: new Date().toISOString() },
    ...(userData.recentSearches || []).filter(s => s.query !== query).slice(0, 19),
  ];
  saveUserData(userData);

  return { locations: unique, errors, totalRaw: results.length, sourceTimings };
});

ipcMain.handle('get-weather', async (_e, { lat, lon }) => {
  try { return await weather.getWeather(lat, lon); }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('get-recent-searches', async () => {
  return (userData.recentSearches || []).slice(0, 10);
});

ipcMain.handle('analyze-terrain', async (_e, { lat, lon }) => {
  try {
    const [elevation, landUse] = await Promise.all([
      terrain.getElevation(lat, lon),
      terrain.analyzeLandUse(lat, lon, 500),
    ]);
    return { elevation, elevClass: terrain.classifyElevation(elevation), landUse };
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle('search-reddit', async (_e, { query }) => {
  try { return await reddit.searchReddit(query || 'stealth camping washington'); }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('get-location-detail', async (_e, location) => {
  try {
    if (location.source === 'RIDB' && location.facilityId) return await ridb.getDetail(location.facilityId);
    return location;
  } catch (err) { return { ...location, detailError: err.message }; }
});

ipcMain.handle('get-user-data', async () => userData);

ipcMain.handle('save-user-data', async (_e, data) => {
  userData = { ...userData, ...data };
  saveUserData(userData);
  return { success: true };
});

ipcMain.handle('toggle-favorite', async (_e, locationId, locationData) => {
  if (!userData.favorites) userData.favorites = [];
  if (!userData.favoriteLocations) userData.favoriteLocations = {};
  const idx = userData.favorites.indexOf(locationId);
  if (idx >= 0) {
    userData.favorites.splice(idx, 1);
    delete userData.favoriteLocations[locationId];
  } else {
    userData.favorites.push(locationId);
    if (locationData) userData.favoriteLocations[locationId] = locationData;
  }
  saveUserData(userData);
  return { favorites: userData.favorites };
});

ipcMain.handle('get-favorite-locations', async () => {
  return userData.favoriteLocations || {};
});

ipcMain.handle('save-note', async (_e, { locationId, note }) => {
  if (!userData.notes) userData.notes = {};
  userData.notes[locationId] = { text: note, updated: new Date().toISOString() };
  saveUserData(userData);
  return { success: true };
});

ipcMain.handle('add-custom-location', async (_e, location) => {
  if (!userData.customLocations) userData.customLocations = [];
  location.id = `custom-${Date.now()}`;
  location.source = 'Custom';
  location.sourceIcon = 'fa-user-pen';
  userData.customLocations.push(location);
  saveUserData(userData);
  return { success: true, location };
});

ipcMain.handle('get-custom-locations', async () => {
  return userData.customLocations || [];
});

ipcMain.handle('delete-custom-location', async (_e, locationId) => {
  if (!userData.customLocations) return { success: false };
  // Also clean up photos for this location
  const loc = userData.customLocations.find(l => l.id === locationId);
  if (loc?.photos?.length) {
    for (const photoFile of loc.photos) {
      try { fs.unlinkSync(photoFile); } catch (e) {}
    }
  }
  userData.customLocations = userData.customLocations.filter(l => l.id !== locationId);
  saveUserData(userData);
  return { success: true };
});

// ─── Photo Storage for Custom Locations ─────────────────────────────
const photosDir = path.join(app.getPath('userData'), 'hoboapp-photos');
if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

ipcMain.handle('save-spot-photos', async (_e, { filePaths }) => {
  try {
    const saved = [];
    for (const src of filePaths) {
      const ext = path.extname(src) || '.jpg';
      const destName = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const dest = path.join(photosDir, destName);
      fs.copyFileSync(src, dest);
      saved.push(dest);
    }
    return { success: true, photos: saved };
  } catch (e) {
    console.error('Save photos error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-spot-photo-buffer', async (_e, { buffer, ext }) => {
  try {
    const destName = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext || '.jpg'}`;
    const dest = path.join(photosDir, destName);
    fs.writeFileSync(dest, Buffer.from(buffer));
    return { success: true, photo: dest };
  } catch (e) {
    console.error('Save photo buffer error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('read-spot-photo', async (_e, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return { error: 'File not found' };
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return { success: true, dataUrl: `data:${mime};base64,${data.toString('base64')}` };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('delete-spot-photos', async (_e, filePaths) => {
  for (const fp of filePaths) {
    try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (e) {}
  }
  return { success: true };
});

ipcMain.handle('pick-photos-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Photos',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }],
  });
  if (result.canceled) return { canceled: true, filePaths: [] };
  return { canceled: false, filePaths: result.filePaths };
});

ipcMain.handle('get-elevation', async (_e, { lat, lon }) => {
  try { return await terrain.getElevation(lat, lon); }
  catch (e) { return null; }
});

ipcMain.handle('get-transit-directions', async (_e, { fromLat, fromLon, toLat, toLon }) => {
  try { return await transit.getTransitDirections(fromLat, fromLon, toLat, toLon); }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('get-transit-agencies', async (_e, { lat, lon }) => {
  try {
    return {
      agencies: transit.getTransitAgencies(lat, lon),
      zipZones: transit.getZipZones(lat, lon),
      nearLightRail: transit.isNearLightRail(lat, lon),
    };
  } catch (err) { return { error: err.message }; }
});

// ─── Grocery & Nutrition ──────────────────────────────────────────
ipcMain.handle('grocery-find-stores', async (_e, { lat, lon, radiusMeters }) => {
  try { return await grocery.findNearbyStores(lat, lon, radiusMeters || 8000); }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('grocery-get-foods', async (_e, filters) => {
  try { return grocery.getAllFoods(filters || {}); }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('grocery-optimize', async (_e, { budget, days, preferences }) => {
  try { return grocery.optimizeMealPlan(budget || 20, days || 3, preferences || {}); }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('grocery-quick-plan', async (_e, { lat, lon }) => {
  try {
    // Find nearby stores + food banks, then generate randomized distance-aware plan
    const [nearbyStores, foodBanks] = await Promise.all([
      grocery.findNearbyStores(lat, lon, 8000),
      grocery.findFoodBanks(lat, lon, 16000),
    ]);
    const storesArray = Array.isArray(nearbyStores) ? nearbyStores : [];
    const plan = grocery.optimizeMealPlan(20, 3, {
      randomize: true,
      nearbyStores: storesArray,
      campFriendlyOnly: false,
      shelfStableOnly: false,
    });
    // Attach food bank info
    plan.nearbyFoodBanks = foodBanks?.results?.slice(0, 5) || [];
    return plan;
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle('grocery-nutrition', async (_e, { foodName }) => {
  try { return await grocery.getNutritionData(foodName); }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('grocery-scrape-walmart', async (_e, { term }) => {
  try { return await grocery.scrapeWalmartPrices(term); }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('grocery-find-food-banks', async (_e, { lat, lon, radiusMeters }) => {
  try { return await grocery.findFoodBanks(lat, lon, radiusMeters || 16000); }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('grocery-get-store-info', async () => {
  return { stores: grocery.STORES, foodGroups: grocery.FOOD_GROUPS };
});

// ─── Bathrooms & Restrooms ─────────────────────────────────────────
ipcMain.handle('find-bathrooms', async (_e, { lat, lon, radiusMeters, filters }) => {
  try {
    const r = radiusMeters || 8000;
    const key = cacheKey('bath', lat, lon, r);
    return await cachedCall(key, () => bathrooms.findAllBathrooms(lat, lon, r, filters || {}));
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle('get-bathroom-types', async () => {
  return bathrooms.BATHROOM_TYPES;
});

// ─── Bridges & Shelter ─────────────────────────────────────────────
ipcMain.handle('find-bridges', async (_e, { lat, lon, radiusMiles, filters }) => {
  try {
    const r = radiusMiles || 5;
    const key = cacheKey('bridge', lat, lon, r);
    return await cachedCall(key, () => bridges.findBridges(lat, lon, r, filters || {}));
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle('get-bridge-types', async () => {
  return bridges.SERVICE_UNDER;
});

// ─── Survival Resources ────────────────────────────────────────────
ipcMain.handle('find-resources', async (_e, { lat, lon, radiusMiles }) => {
  try {
    const r = radiusMiles || 10;
    const key = cacheKey('res', lat, lon, r);
    return await cachedCall(key, () => resources.findResources(lat, lon, r));
  } catch (err) { return { error: err.message, resources: [], categorized: {}, counts: {}, total: 0 }; }
});

ipcMain.handle('get-resource-types', async () => {
  return resources.RESOURCE_TYPES;
});

// ─── Settings & API Keys ───────────────────────────────────────────
ipcMain.handle('get-settings', async () => {
  return {
    apiKeys: userData.apiKeys || {},
    settings: userData.settings || {},
  };
});

ipcMain.handle('save-settings', async (_e, { apiKeys, settings }) => {
  if (apiKeys) userData.apiKeys = { ...userData.apiKeys, ...apiKeys };
  if (settings) userData.settings = { ...userData.settings, ...settings };
  saveUserData(userData);
  return { success: true };
});

// ─── Window Controls (custom title bar) ────────────────────────────
ipcMain.handle('window-minimize', () => { mainWindow?.minimize(); });
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window-close', () => { mainWindow?.close(); });
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() || false);

// ─── Window Zoom ────────────────────────────────────────────────────
ipcMain.handle('zoom-in', async () => {
  const wc = mainWindow?.webContents;
  if (wc) { wc.setZoomLevel(Math.min(wc.getZoomLevel() + 0.5, 5)); return wc.getZoomLevel(); }
});
ipcMain.handle('zoom-out', async () => {
  const wc = mainWindow?.webContents;
  if (wc) { wc.setZoomLevel(Math.max(wc.getZoomLevel() - 0.5, -3)); return wc.getZoomLevel(); }
});
ipcMain.handle('zoom-reset', async () => {
  const wc = mainWindow?.webContents;
  if (wc) { wc.setZoomLevel(0); return 0; }
});
ipcMain.handle('get-zoom-level', async () => {
  return mainWindow?.webContents?.getZoomLevel() || 0;
});

// ─── Trip Planner ──────────────────────────────────────────────────
ipcMain.handle('get-trip-data', async () => {
  return userData.tripPlan || { nights: [] };
});

ipcMain.handle('save-trip-data', async (_e, tripData) => {
  userData.tripPlan = tripData;
  saveUserData(userData);
  return { success: true };
});

ipcMain.handle('get-multi-day-weather', async (_e, { locations }) => {
  try {
    // locations = [{ lat, lon, date }] — get weather for each location/date
    const results = [];
    for (const loc of locations) {
      try {
        const w = await weather.getWeather(loc.lat, loc.lon);
        results.push({ ...loc, weather: w });
      } catch (e) {
        results.push({ ...loc, weather: { error: e.message } });
      }
    }
    return results;
  } catch (err) { return { error: err.message }; }
});

// dedup() imported from ./modules/utils (O(n) spatial hash grid)

// ═══════════════════════════════════════════════════════════════════
// GPX / KML EXPORT
// ═══════════════════════════════════════════════════════════════════
ipcMain.handle('export-gpx', async (_e, { locations, filename }) => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export as GPX',
      defaultPath: filename || 'hoboapp-export.gpx',
      filters: [{ name: 'GPX Files', extensions: ['gpx'] }],
    });
    if (!filePath) return { cancelled: true };

    const escXml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const now = new Date().toISOString();
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="HoboApp v2.0" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata>\n    <name>HoboApp Export</name>\n    <time>${now}</time>\n  </metadata>\n`;

    for (const loc of locations) {
      if (!loc.lat || !loc.lon) continue;
      gpx += `  <wpt lat="${loc.lat}" lon="${loc.lon}">\n`;
      gpx += `    <name>${escXml(loc.name)}</name>\n`;
      if (loc.type) gpx += `    <type>${escXml(loc.type)}</type>\n`;
      if (loc.description) gpx += `    <desc>${escXml(loc.description)}</desc>\n`;
      if (loc.source) gpx += `    <src>${escXml(loc.source)}</src>\n`;
      gpx += `  </wpt>\n`;
    }

    gpx += `</gpx>\n`;
    fs.writeFileSync(filePath, gpx, 'utf-8');
    return { success: true, filePath };
  } catch (err) { return { error: err.message }; }
});
