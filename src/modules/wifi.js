/**
 * HoboApp – Free WiFi Finder Module
 * Queries OpenStreetMap Overpass API for free / public WiFi hotspots:
 *   - Places explicitly tagged internet_access=wlan + fee=no
 *   - Libraries (almost always have free WiFi)
 *   - Internet cafés
 *   - Public WiFi in parks/plazas/transit
 *   - Major chains known for free WiFi (Starbucks, McDonald's, etc.)
 *   - Community centers with WiFi
 *
 * Data sourced from OpenStreetMap via Overpass API.
 */
const { haversine, overpassQuery } = require('./utils');

// ═══════════════════════════════════════════════════════════════════
// WIFI SPOT CATEGORIES
// ═══════════════════════════════════════════════════════════════════
const WIFI_TYPES = {
  free_public:   { label: 'Free Public WiFi',    icon: 'fa-wifi',         color: '#8b5cf6' },
  library:       { label: 'Library WiFi',         icon: 'fa-book',         color: '#6366f1' },
  cafe:          { label: 'Café WiFi',            icon: 'fa-mug-hot',     color: '#a16207' },
  fast_food:     { label: 'Fast Food WiFi',       icon: 'fa-burger',       color: '#ef4444' },
  internet_cafe: { label: 'Internet Café',        icon: 'fa-desktop',      color: '#0891b2' },
  transit:       { label: 'Transit Stop WiFi',    icon: 'fa-bus',          color: '#0ea5e9' },
  community:     { label: 'Community Center WiFi', icon: 'fa-people-roof', color: '#ec4899' },
  restaurant:    { label: 'Restaurant WiFi',      icon: 'fa-utensils',     color: '#f59e0b' },
  hotel_lobby:   { label: 'Hotel Lobby WiFi',     icon: 'fa-hotel',        color: '#64748b' },
  other:         { label: 'Free WiFi',            icon: 'fa-wifi',         color: '#a855f7' },
};

// ═══════════════════════════════════════════════════════════════════
// OVERPASS QUERY — Comprehensive WiFi hotspot search
// ═══════════════════════════════════════════════════════════════════
function buildWifiQuery(lat, lon, radiusMeters) {
  return `
[out:json][timeout:30];
(
  // ── Explicitly tagged free WiFi (primary signal) ──
  node["internet_access"="wlan"]["internet_access:fee"="no"](around:${radiusMeters},${lat},${lon});
  way["internet_access"="wlan"]["internet_access:fee"="no"](around:${radiusMeters},${lat},${lon});

  // ── WiFi=yes or wifi=free (common alternate tags) ──
  node["wifi"="free"](around:${radiusMeters},${lat},${lon});
  way["wifi"="free"](around:${radiusMeters},${lat},${lon});
  node["wifi"="yes"](around:${radiusMeters},${lat},${lon});
  way["wifi"="yes"](around:${radiusMeters},${lat},${lon});

  // ── internet_access=yes with fee=no ──
  node["internet_access"="yes"]["internet_access:fee"="no"](around:${radiusMeters},${lat},${lon});
  way["internet_access"="yes"]["internet_access:fee"="no"](around:${radiusMeters},${lat},${lon});

  // ── internet_access=wlan with fee=customers (buy a coffee = free WiFi) ──
  node["internet_access"="wlan"]["internet_access:fee"="customers"](around:${radiusMeters},${lat},${lon});
  way["internet_access"="wlan"]["internet_access:fee"="customers"](around:${radiusMeters},${lat},${lon});

  // ── Libraries (almost always have free WiFi) ──
  node["amenity"="library"](around:${radiusMeters},${lat},${lon});
  way["amenity"="library"](around:${radiusMeters},${lat},${lon});

  // ── Internet cafés ──
  node["amenity"="internet_cafe"](around:${radiusMeters},${lat},${lon});
  way["amenity"="internet_cafe"](around:${radiusMeters},${lat},${lon});

  // ── Community centers (often have free WiFi) ──
  node["amenity"="community_centre"]["internet_access"](around:${radiusMeters},${lat},${lon});
  way["amenity"="community_centre"]["internet_access"](around:${radiusMeters},${lat},${lon});

  // ── Cafés / coffee shops with WiFi ──
  node["amenity"="cafe"]["internet_access"="wlan"](around:${radiusMeters},${lat},${lon});
  way["amenity"="cafe"]["internet_access"="wlan"](around:${radiusMeters},${lat},${lon});

  // ── Fast food with WiFi (McDonald's, Starbucks, etc.) ──
  node["amenity"="fast_food"]["internet_access"="wlan"](around:${radiusMeters},${lat},${lon});
  way["amenity"="fast_food"]["internet_access"="wlan"](around:${radiusMeters},${lat},${lon});

  // ── Restaurants with WiFi ──
  node["amenity"="restaurant"]["internet_access"="wlan"](around:${radiusMeters},${lat},${lon});
  way["amenity"="restaurant"]["internet_access"="wlan"](around:${radiusMeters},${lat},${lon});

  // ── Public/open WiFi hotspots in parks or plazas ──
  node["communication"="wifi"](around:${radiusMeters},${lat},${lon});

  // ── Hotels with WiFi (lobby access) ──
  node["tourism"="hotel"]["internet_access"="wlan"]["internet_access:fee"="no"](around:${radiusMeters},${lat},${lon});
  way["tourism"="hotel"]["internet_access"="wlan"]["internet_access:fee"="no"](around:${radiusMeters},${lat},${lon});

  // ── Transit stations with WiFi ──
  node["public_transport"="station"]["internet_access"="wlan"](around:${radiusMeters},${lat},${lon});
  way["public_transport"="station"]["internet_access"="wlan"](around:${radiusMeters},${lat},${lon});
);
out center body;
>;
out skel qt;
`;
}

// ═══════════════════════════════════════════════════════════════════
// CLASSIFY & PARSE
// ═══════════════════════════════════════════════════════════════════
function classifyWifi(tags) {
  const amenity = tags.amenity || '';
  const tourism = tags.tourism || '';
  const pt = tags.public_transport || '';

  if (amenity === 'library') return 'library';
  if (amenity === 'internet_cafe') return 'internet_cafe';
  if (amenity === 'cafe') return 'cafe';
  if (amenity === 'fast_food') return 'fast_food';
  if (amenity === 'restaurant') return 'restaurant';
  if (amenity === 'community_centre') return 'community';
  if (tourism === 'hotel' || tourism === 'hostel') return 'hotel_lobby';
  if (pt === 'station' || amenity === 'bus_station') return 'transit';
  if (tags.communication === 'wifi') return 'free_public';
  // If has explicit free WiFi tag but no specific amenity, it's generic free WiFi
  if (tags.internet_access === 'wlan' || tags.wifi === 'free' || tags.wifi === 'yes') return 'free_public';
  return 'other';
}

function buildWifiName(tags, wifiType) {
  if (tags.name) return tags.name;
  const def = WIFI_TYPES[wifiType];
  return def ? def.label : 'Free WiFi Hotspot';
}

function buildWifiDescription(tags, wifiType) {
  const parts = [];

  if (tags.description) parts.push(tags.description);
  if (tags.operator) parts.push(`Operated by: ${tags.operator}`);
  if (tags.opening_hours) parts.push(`Hours: ${tags.opening_hours}`);

  // SSID info
  if (tags['internet_access:ssid']) parts.push(`Network: ${tags['internet_access:ssid']}`);

  // Fee info
  const fee = tags['internet_access:fee'] || '';
  if (fee === 'no') parts.push('Free WiFi — no purchase required');
  else if (fee === 'customers') parts.push('Free WiFi for customers');
  else if (fee === 'yes') parts.push('Paid WiFi');

  // Type-specific notes
  if (wifiType === 'library') {
    parts.push('Libraries typically offer free WiFi, computers, outlets, warmth, and restrooms');
  }
  if (wifiType === 'fast_food') {
    const brand = tags.brand || tags.name || '';
    if (brand.match(/mcdonald|starbucks|burger king|wendy|taco bell|subway/i)) {
      parts.push('Major chain — free WiFi standard, no time limit usually');
    }
  }
  if (wifiType === 'cafe') {
    parts.push('Buy a drink for access. Outlets usually available');
  }
  if (wifiType === 'hotel_lobby') {
    parts.push('Hotel lobby WiFi — walk in and sit in the lobby');
  }
  if (wifiType === 'transit') {
    parts.push('Transit station WiFi — signal may be limited to station area');
  }

  if (parts.length === 0) parts.push('Free WiFi location');
  return parts.join(' | ');
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SEARCH
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// CURATED WIFI SPOTS — Arlington / Snohomish / WA area
// ═══════════════════════════════════════════════════════════════════
const CURATED_WIFI = [
  { id: 'wifi-cur-1', name: 'Arlington Library', lat: 48.1989, lon: -122.1253, wifiType: 'library', description: 'Sno-Isle Libraries. Free WiFi inside and in parking lot. Power outlets at tables. Open M-Sat.', ssid: 'Sno-Isle_Public', hours: 'M-Th 10-8, F-Sa 10-5', amenities: ['Free WiFi', 'Outlets', 'Restrooms', 'Air Conditioning'] },
  { id: 'wifi-cur-2', name: 'Marysville Library', lat: 48.0520, lon: -122.1770, wifiType: 'library', description: 'Sno-Isle Libraries Marysville branch. Strong WiFi reaches parking lot after hours.', ssid: 'Sno-Isle_Public', hours: 'M-Th 10-8, F-Sa 10-5', amenities: ['Free WiFi', 'Outlets', 'Restrooms'] },
  { id: 'wifi-cur-3', name: 'Smokey Point Library (Lakewood)', lat: 48.1661, lon: -122.1966, wifiType: 'library', description: 'Sno-Isle Libraries branch at Smokey Point. Free WiFi extends to parking area.', ssid: 'Sno-Isle_Public', hours: 'M-Th 10-8, F-Sa 10-5', amenities: ['Free WiFi', 'Outlets', 'Restrooms'] },
  { id: 'wifi-cur-4', name: 'Starbucks - Arlington', lat: 48.1876, lon: -122.1414, wifiType: 'cafe', description: 'Starbucks on Smokey Point Blvd. Free Google WiFi for customers. Power outlets at bar seating.', ssid: 'Google Starbucks', hours: '5am-8pm daily', amenities: ['Free WiFi', 'Outlets'] },
  { id: 'wifi-cur-5', name: 'McDonald\'s - Smokey Point', lat: 48.1683, lon: -122.1941, wifiType: 'fast_food', description: 'McDonald\'s at Smokey Point. Free WiFi. Can sit in lobby or parking lot.', ssid: 'att-wifi', hours: '24hr (lobby closes 11pm)', amenities: ['Free WiFi', 'Restrooms'] },
  { id: 'wifi-cur-6', name: 'Safeway - Arlington', lat: 48.1953, lon: -122.1207, wifiType: 'free_public', description: 'Safeway grocery store. Free WiFi in store and parking lot.', ssid: 'Safeway_Free_Wi-Fi', hours: '5am-12am daily', amenities: ['Free WiFi', 'Restrooms'] },
  { id: 'wifi-cur-7', name: 'Arlington Community Center', lat: 48.2003, lon: -122.1262, wifiType: 'community', description: 'City community center. Free public WiFi during open hours.', hours: 'M-F 8am-9pm, Sa 9-5', amenities: ['Free WiFi', 'Restrooms', 'Outlets'] },
  { id: 'wifi-cur-8', name: 'Granite Falls Library', lat: 48.0839, lon: -121.9679, wifiType: 'library', description: 'Small Sno-Isle branch. WiFi reaches outside. Good for Mountain Loop Hwy staging.', ssid: 'Sno-Isle_Public', hours: 'Tu-Sa 10-6', amenities: ['Free WiFi', 'Outlets', 'Restrooms'] },
  { id: 'wifi-cur-9', name: 'Darrington Library', lat: 48.2548, lon: -121.6012, wifiType: 'library', description: 'Sno-Isle Libraries Darrington branch. Only free WiFi for miles. Critical for backcountry trips.', ssid: 'Sno-Isle_Public', hours: 'Tu-Sa 10-6', amenities: ['Free WiFi', 'Outlets'] },
  { id: 'wifi-cur-10', name: 'Everett Public Library - Main Branch', lat: 47.9793, lon: -122.2022, wifiType: 'library', description: 'Large downtown library. Strong WiFi, many outlets, study rooms.', hours: 'M-Th 10-8, F-Sa 10-5, Su 1-5', amenities: ['Free WiFi', 'Outlets', 'Restrooms', 'Air Conditioning'] },
  { id: 'wifi-cur-11', name: 'Stanwood Library', lat: 48.2410, lon: -122.3705, wifiType: 'library', description: 'Sno-Isle Libraries Stanwood branch. WiFi available in lot after hours.', ssid: 'Sno-Isle_Public', hours: 'M-Th 10-8, F-Sa 10-5', amenities: ['Free WiFi', 'Outlets', 'Restrooms'] },
  { id: 'wifi-cur-12', name: 'Fred Meyer - Marysville', lat: 48.0525, lon: -122.1525, wifiType: 'free_public', description: 'Fred Meyer store with free WiFi in lobby and parking lot.', hours: '6am-11pm daily', amenities: ['Free WiFi', 'Restrooms'] },
  { id: 'wifi-cur-13', name: 'Wendy\'s - Smokey Point', lat: 48.1675, lon: -122.1930, wifiType: 'fast_food', description: 'Wendy\'s at Smokey Point. Free WiFi for customers.', hours: '6:30am-1am daily', amenities: ['Free WiFi'] },
  { id: 'wifi-cur-14', name: 'Seattle Public Library - Central', lat: 47.6067, lon: -122.3326, wifiType: 'library', description: 'Iconic Rem Koolhaas building downtown. Massive free WiFi, hundreds of outlets, restrooms on every floor.', ssid: 'SPL-WiFi', hours: 'M-Th 10-8, F-Sa 10-6, Su 12-6', amenities: ['Free WiFi', 'Outlets', 'Restrooms', 'Air Conditioning', 'Wheelchair Accessible'] },
  { id: 'wifi-cur-15', name: 'Bellingham Public Library', lat: 48.7509, lon: -122.4782, wifiType: 'library', description: 'Central branch with strong WiFi and outlets. Reaches parking lot.', hours: 'M-Th 10-9, F-Sa 10-6, Su 1-5', amenities: ['Free WiFi', 'Outlets', 'Restrooms'] },
];

async function findWifi(lat, lon, radiusMiles) {
  const radiusMeters = Math.min(radiusMiles, 15) * 1609.344;
  const query = buildWifiQuery(lat, lon, radiusMeters);
  const seen = new Set();

  try {
    const resp = await overpassQuery(query, 30000);
    const elements = resp?.data?.elements || [];
    const wifiSpots = [];

    for (const el of elements) {
      if (!el.tags) continue;
      const elLat = el.lat || el.center?.lat;
      const elLon = el.lon || el.center?.lon;
      if (!elLat || !elLon) continue;

      // Dedup by coordinates
      const coordKey = `${elLat.toFixed(5)},${elLon.toFixed(5)}`;
      if (seen.has(coordKey)) continue;
      seen.add(coordKey);

      const wifiType = classifyWifi(el.tags);
      const typeDef = WIFI_TYPES[wifiType] || WIFI_TYPES.other;
      const dist = haversine(lat, lon, elLat, elLon);

      wifiSpots.push({
        id: `wifi-${el.type}-${el.id}`,
        name: buildWifiName(el.tags, wifiType),
        description: buildWifiDescription(el.tags, wifiType),
        lat: elLat,
        lon: elLon,
        distanceMiles: Math.round(dist * 10) / 10,
        wifiType,
        typeLabel: typeDef.label,
        icon: typeDef.icon,
        color: typeDef.color,
        ssid: el.tags['internet_access:ssid'] || null,
        fee: el.tags['internet_access:fee'] || 'unknown',
        hours: el.tags.opening_hours || null,
        wheelchair: el.tags.wheelchair === 'yes',
        website: el.tags.website || el.tags['contact:website'] || null,
        osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        phone: el.tags.phone || el.tags['contact:phone'] || null,
        amenities: [
          'Free WiFi',
          el.tags['internet_access:ssid'] ? `SSID: ${el.tags['internet_access:ssid']}` : '',
          el.tags.wheelchair === 'yes' ? 'Wheelchair Accessible' : '',
          el.tags.air_conditioning === 'yes' ? 'Air Conditioning' : '',
          el.tags.toilets === 'yes' ? 'Restrooms' : '',
          el.tags.power_supply === 'yes' || wifiType === 'library' ? 'Outlets' : '',
        ].filter(Boolean),
      });
    }

    // Merge curated WiFi spots that are within search radius
    const curatedInRange = CURATED_WIFI
      .map(c => {
        const dist = haversine(lat, lon, c.lat, c.lon);
        if (dist > radiusMiles) return null;
        const t = WIFI_TYPES[c.wifiType] || WIFI_TYPES.other;
        return {
          ...c,
          distanceMiles: Math.round(dist * 100) / 100,
          typeLabel: t.label,
          icon: t.icon,
          color: t.color,
          fee: 'no',
          curated: true,
        };
      })
      .filter(Boolean)
      .filter(c => !wifiSpots.some(w =>
        Math.abs(w.lat - c.lat) < 0.001 && Math.abs(w.lon - c.lon) < 0.001
      ));

    const all = [...wifiSpots, ...curatedInRange];
    all.sort((a, b) => a.distanceMiles - b.distanceMiles);
    return { wifi: all };
  } catch (err) {
    console.error('[WiFi] Overpass error:', err.message);
    // Return curated data as fallback on Overpass failure
    const curatedFallback = CURATED_WIFI
      .map(c => {
        const dist = haversine(lat, lon, c.lat, c.lon);
        if (dist > radiusMiles) return null;
        const t = WIFI_TYPES[c.wifiType] || WIFI_TYPES.other;
        return { ...c, distanceMiles: Math.round(dist * 100) / 100, typeLabel: t.label, icon: t.icon, color: t.color, fee: 'no', curated: true };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
    return { wifi: curatedFallback };
  }
}

module.exports = { findWifi, WIFI_TYPES };
