/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║                 NPS — National Park Service API                  ║
 * ║           Campgrounds, Visitor Centers, Parking Lots             ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * API Docs: https://www.nps.gov/subjects/developer/api-documentation.htm
 * Base URL: https://developer.nps.gov/api/v1
 * Free API key required: https://www.nps.gov/subjects/developer/get-started.htm
 */

const axios = require('axios');
const { haversine } = require('./utils');

const BASE_URL = 'https://developer.nps.gov/api/v1';

// WA-relevant park codes (can be expanded)
const WA_PARK_CODES = [
  'mora', // Mount Rainier
  'noca', // North Cascades
  'olym', // Olympic
  'sajh', // San Juan Island NHP
  'lach', // Lake Chelan NRA
  'rola', // Ross Lake NRA
  'lewi', // Lewis and Clark NHP
  'fova', // Fort Vancouver NHS
  'whmi', // Whitman Mission NHS
  'ebla', // Ebey's Landing NHR
  'klse', // Klondike Gold Rush NHP (Seattle unit)
  'miin', // Minidoka NHS (partly in WA)
  'haco', // Hanford Reach NM
  'iafl', // Ice Age Floods NM Trail
];

/**
 * Search NPS campgrounds near a location
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusMiles
 * @param {string} apiKey
 * @returns {Promise<Array>}
 */
async function searchCampgrounds(lat, lon, radiusMiles, apiKey) {
  if (!apiKey) return [];

  try {
    const params = {
      api_key: apiKey,
      limit: 100,
      stateCode: 'WA',
    };

    const resp = await axios.get(`${BASE_URL}/campgrounds`, {
      params,
      timeout: 15000,
      headers: { 'User-Agent': 'HoboApp/2.0' },
    });

    if (!resp.data?.data) return [];

    return resp.data.data
      .filter(c => c.latitude && c.longitude)
      .map(c => {
        const cLat = parseFloat(c.latitude);
        const cLon = parseFloat(c.longitude);
        const dist = haversine(lat, lon, cLat, cLon);
        if (dist > radiusMiles) return null;

        const amenityList = [];
        if (c.amenities) {
          if (c.amenities.trashRecyclingCollection !== 'No') amenityList.push('Trash Collection');
          if (c.amenities.toilets && !c.amenities.toilets.includes('None')) amenityList.push('Toilets');
          if (c.amenities.showers && !c.amenities.showers.includes('None')) amenityList.push('Showers');
          if (c.amenities.cellPhoneReception !== 'No') amenityList.push('Cell Service');
          if (c.amenities.campStore !== 'No') amenityList.push('Camp Store');
          if (c.amenities.potableWater && !c.amenities.potableWater.includes('No')) amenityList.push('Potable Water');
          if (c.amenities.firewoodForSale !== 'No') amenityList.push('Firewood');
          if (c.amenities.foodStorageLockers !== 'No') amenityList.push('Food Lockers');
        }

        const feeParts = [];
        if (c.fees?.length) {
          c.fees.forEach(f => feeParts.push(`${f.title}: $${f.cost}`));
        }

        return {
          id: `nps-camp-${c.id}`,
          name: c.name,
          description: [
            c.description?.slice(0, 250) || '',
            c.numberOfSitesReservable ? `Reservable sites: ${c.numberOfSitesReservable}` : '',
            c.numberOfSitesFirstComeFirstServe ? `FCFS sites: ${c.numberOfSitesFirstComeFirstServe}` : '',
            feeParts.length ? feeParts.join(', ') : '',
            c.weatherOverview ? `Weather: ${c.weatherOverview.slice(0, 120)}` : '',
          ].filter(Boolean).join(' | '),
          lat: cLat,
          lon: cLon,
          distanceMiles: Math.round(dist * 10) / 10,
          type: 'Campground',
          source: 'NPS',
          sourceIcon: 'fa-mountain-sun',
          reservable: parseInt(c.numberOfSitesReservable) > 0,
          url: c.url || `https://www.nps.gov/${c.parkCode}/planyourvisit/campgrounds.htm`,
          fee: feeParts.length ? feeParts[0] : 'Check NPS',
          stealthRating: 2,
          tags: ['nps', 'campground', 'national-park', ...(c.accessibility?.rvAllowed === '1' ? ['rv'] : [])],
          amenities: amenityList,
          parkCode: c.parkCode,
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.warn('[NPS] Campground search error:', err.message);
    return [];
  }
}

/**
 * Search NPS visitor centers near a location
 */
async function searchVisitorCenters(lat, lon, radiusMiles, apiKey) {
  if (!apiKey) return [];

  try {
    const resp = await axios.get(`${BASE_URL}/visitorcenters`, {
      params: { api_key: apiKey, limit: 50, stateCode: 'WA' },
      timeout: 10000,
      headers: { 'User-Agent': 'HoboApp/2.0' },
    });

    if (!resp.data?.data) return [];

    return resp.data.data
      .filter(v => v.latitude && v.longitude)
      .map(v => {
        const vLat = parseFloat(v.latitude);
        const vLon = parseFloat(v.longitude);
        const dist = haversine(lat, lon, vLat, vLon);
        if (dist > radiusMiles) return null;

        return {
          id: `nps-vc-${v.id}`,
          name: v.name,
          description: [
            v.description?.slice(0, 200) || '',
            v.operatingHours?.[0]?.description ? `Hours: ${v.operatingHours[0].description.slice(0, 100)}` : '',
          ].filter(Boolean).join(' | '),
          lat: vLat,
          lon: vLon,
          distanceMiles: Math.round(dist * 10) / 10,
          type: 'Visitor Center',
          source: 'NPS',
          sourceIcon: 'fa-mountain-sun',
          reservable: false,
          url: v.url,
          fee: 'Free',
          stealthRating: 1,
          tags: ['nps', 'visitor-center', 'restroom', 'water', 'info'],
          amenities: ['Restrooms', 'Information', 'Water'],
          parkCode: v.parkCode,
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.warn('[NPS] Visitor center search error:', err.message);
    return [];
  }
}

/**
 * Search NPS parking lots near a location
 */
async function searchParkingLots(lat, lon, radiusMiles, apiKey) {
  if (!apiKey) return [];

  try {
    const resp = await axios.get(`${BASE_URL}/parkinglots`, {
      params: { api_key: apiKey, limit: 50, stateCode: 'WA' },
      timeout: 10000,
      headers: { 'User-Agent': 'HoboApp/2.0' },
    });

    if (!resp.data?.data) return [];

    return resp.data.data
      .filter(p => p.latitude && p.longitude)
      .map(p => {
        const pLat = parseFloat(p.latitude);
        const pLon = parseFloat(p.longitude);
        const dist = haversine(lat, lon, pLat, pLon);
        if (dist > radiusMiles) return null;

        return {
          id: `nps-lot-${p.id}`,
          name: p.name || 'NPS Parking Lot',
          description: [
            p.description?.slice(0, 200) || '',
            p.isOvernightParkingAllowed === 'Yes' ? '🅿️ Overnight parking allowed!' : '',
            p.managedByOrganization || '',
          ].filter(Boolean).join(' | '),
          lat: pLat,
          lon: pLon,
          distanceMiles: Math.round(dist * 10) / 10,
          type: p.isOvernightParkingAllowed === 'Yes' ? 'Overnight Parking' : 'Parking Lot',
          source: 'NPS',
          sourceIcon: 'fa-mountain-sun',
          reservable: false,
          url: null,
          fee: 'Check NPS',
          stealthRating: p.isOvernightParkingAllowed === 'Yes' ? 3 : 1,
          tags: ['nps', 'parking', p.isOvernightParkingAllowed === 'Yes' ? 'overnight' : ''].filter(Boolean),
          amenities: [],
          parkCode: p.parkCode,
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.warn('[NPS] Parking lot search error:', err.message);
    return [];
  }
}

/**
 * Combined NPS search — campgrounds + visitor centers + parking lots
 */
async function search(lat, lon, radiusMiles, apiKey) {
  if (!apiKey) {
    console.log('[NPS] No API key configured — skipping');
    return [];
  }

  const [campgrounds, visitorCenters, parkingLots] = await Promise.allSettled([
    searchCampgrounds(lat, lon, radiusMiles, apiKey),
    searchVisitorCenters(lat, lon, radiusMiles, apiKey),
    searchParkingLots(lat, lon, radiusMiles, apiKey),
  ]);

  const results = [];
  if (campgrounds.status === 'fulfilled') results.push(...campgrounds.value);
  if (visitorCenters.status === 'fulfilled') results.push(...visitorCenters.value);
  if (parkingLots.status === 'fulfilled') results.push(...parkingLots.value);

  console.log(`[NPS] Found ${results.length} results (${campgrounds.value?.length || 0} campgrounds, ${visitorCenters.value?.length || 0} VCs, ${parkingLots.value?.length || 0} parking lots)`);
  return results;
}

module.exports = { search, searchCampgrounds, searchVisitorCenters, searchParkingLots, WA_PARK_CODES };
