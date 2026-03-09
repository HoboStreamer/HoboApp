/**
 * Geocoder module – converts address strings to lat/lon using
 * the free Nominatim (OpenStreetMap) geocoding service.
 */
const axios = require('axios');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Geocode an address string, biased toward Washington State.
 * @param {string} address
 * @returns {Promise<{lat: number, lon: number, displayName: string}>}
 */
async function geocode(address) {
  // Append ", Washington, USA" if not obviously present
  let query = address;
  if (!/washington|WA\b/i.test(address)) {
    query += ', Washington, USA';
  }

  const { data } = await axios.get(NOMINATIM_URL, {
    params: {
      q: query,
      format: 'json',
      limit: 1,
      countrycodes: 'us',
      addressdetails: 1,
    },
    headers: {
      'User-Agent': 'WA-StealthCampLocator/1.0 (research-project)',
    },
    timeout: 10000,
  });

  if (!data || data.length === 0) {
    throw new Error('Address not found. Try a more specific address in Washington state.');
  }

  const result = data[0];
  return {
    lat: parseFloat(result.lat),
    lon: parseFloat(result.lon),
    displayName: result.display_name,
  };
}

module.exports = { geocode };
