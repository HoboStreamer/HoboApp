/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║           HoboApp – WA Transit & Directions Module             ║
 * ║     Community Transit · Zip Shuttle · Metro · Sound Transit      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Provides transit directions, fare info, and multi-modal routing
 * for Washington State transit agencies. Uses OSRM for walking/biking
 * routes and embedded fare databases for transit costs.
 */

const axios = require('axios');
const { haversine } = require('./utils');

// ═══════════════════════════════════════════════════════════════════
// WA TRANSIT AGENCY DATABASE
// ═══════════════════════════════════════════════════════════════════

const TRANSIT_AGENCIES = {
  communityTransit: {
    name: 'Community Transit',
    abbr: 'CT',
    icon: 'fa-bus',
    color: '#0066b3',
    website: 'https://www.communitytransit.org',
    phone: '(425) 353-7433',
    coverage: 'Snohomish County',
    fares: {
      adult: { amount: 2.50, label: 'Adult' },
      youth: { amount: 0, label: 'Youth (18 & under)' },
      orcaLift: { amount: 1.00, label: 'ORCA LIFT' },
      senior: { amount: 1.00, label: 'Senior (65+)' },
      disabled: { amount: 1.00, label: 'Disabled' },
    },
    payment: ['ORCA card', 'Debit/Credit (contactless)', 'Cash (exact change)'],
    services: ['Local Bus', 'Swift BRT', 'Commuter Bus'],
    tripPlanner: 'https://www.communitytransit.org/busservice/schedules',
  },
  zipAlderwood: {
    name: 'Zip Alderwood',
    abbr: 'ZIP-ALD',
    icon: 'fa-shuttle-van',
    color: '#00a651',
    website: 'https://www.communitytransit.org/zip-alderwood',
    phone: '(833) DIAL-ZIP / (833) 342-5947',
    coverage: 'Alderwood / Lynnwood area',
    hours: '5:00 AM – 10:00 PM, 7 days/week',
    fares: {
      adult: { amount: 2.50, label: 'Adult' },
      youth: { amount: 0, label: 'Youth (18 & under)' },
      orcaLift: { amount: 1.00, label: 'ORCA LIFT' },
      senior: { amount: 1.00, label: 'Senior (65+)' },
      disabled: { amount: 1.00, label: 'Disabled' },
    },
    payment: ['ORCA card', 'Debit/Credit', 'Cash', 'Zip Shuttle App'],
    booking: 'Book via Zip Shuttle app, communitytransit.org/zip, or call (833) DIAL-ZIP',
    serviceType: 'On-demand shuttle',
    connections: ['Lynnwood City Center light rail station'],
    bounds: { north: 47.85, south: 47.79, east: -122.25, west: -122.34 },
  },
  zipArlington: {
    name: 'Zip Arlington',
    abbr: 'ZIP-ARL',
    icon: 'fa-shuttle-van',
    color: '#00a651',
    website: 'https://www.communitytransit.org/zip-arlington',
    phone: '(833) DIAL-ZIP / (833) 342-5947',
    coverage: 'Arlington area',
    hours: '6:00 AM – 8:00 PM, 7 days/week',
    fares: {
      adult: { amount: 2.50, label: 'Adult' },
      youth: { amount: 0, label: 'Youth (18 & under)' },
      orcaLift: { amount: 1.00, label: 'ORCA LIFT' },
      senior: { amount: 1.00, label: 'Senior (65+)' },
      disabled: { amount: 1.00, label: 'Disabled' },
    },
    payment: ['ORCA card', 'Debit/Credit', 'Cash', 'Zip Shuttle App'],
    booking: 'Book via Zip Shuttle app or call (833) DIAL-ZIP',
    serviceType: 'On-demand shuttle',
    destinations: ['Downtown Arlington', 'Cascade Valley Hospital', 'Arlington Library', 'Haller Park'],
    bounds: { north: 48.23, south: 48.17, east: -122.09, west: -122.17 },
  },
  zipDarrington: {
    name: 'Zip Darrington',
    abbr: 'ZIP-DAR',
    icon: 'fa-shuttle-van',
    color: '#00a651',
    website: 'https://www.communitytransit.org/zip-darrington',
    phone: '(833) DIAL-ZIP / (833) 342-5947',
    coverage: 'Darrington area',
    hours: '6:00 AM – 8:00 PM, 7 days/week',
    fares: {
      adult: { amount: 2.50, label: 'Adult' },
      youth: { amount: 0, label: 'Youth (18 & under)' },
      orcaLift: { amount: 1.00, label: 'ORCA LIFT' },
      senior: { amount: 1.00, label: 'Senior (65+)' },
      disabled: { amount: 1.00, label: 'Disabled' },
    },
    payment: ['ORCA card', 'Debit/Credit', 'Cash', 'Zip Shuttle App'],
    booking: 'Book via Zip Shuttle app or call (833) DIAL-ZIP',
    serviceType: 'On-demand shuttle',
    destinations: ['IGA', 'Dollar Tree', 'Skagit Regional Health', 'Post Office', 'Cascade Seniors Center', 'Library'],
    bounds: { north: 48.28, south: 48.24, east: -121.57, west: -121.63 },
  },
  zipLakeStevens: {
    name: 'Zip Lake Stevens',
    abbr: 'ZIP-LS',
    icon: 'fa-shuttle-van',
    color: '#00a651',
    website: 'https://www.communitytransit.org/zip-lake-stevens',
    phone: '(833) DIAL-ZIP / (833) 342-5947',
    coverage: 'Lake Stevens area',
    hours: '5:00 AM – 10:00 PM, 7 days/week',
    fares: {
      adult: { amount: 2.50, label: 'Adult' },
      youth: { amount: 0, label: 'Youth (18 & under)' },
      orcaLift: { amount: 1.00, label: 'ORCA LIFT' },
      senior: { amount: 1.00, label: 'Senior (65+)' },
      disabled: { amount: 1.00, label: 'Disabled' },
    },
    payment: ['ORCA card', 'Debit/Credit', 'Cash', 'Zip Shuttle App'],
    booking: 'Book via Zip Shuttle app or call (833) DIAL-ZIP',
    serviceType: 'On-demand shuttle',
    destinations: ['Safeway', 'Tom Thumb', 'Walmart', 'Everett Clinic', 'City Hall', 'Food Bank', 'Senior Center', 'Library'],
    bounds: { north: 48.05, south: 47.98, east: -122.04, west: -122.13 },
  },
  kingCountyMetro: {
    name: 'King County Metro',
    abbr: 'KCM',
    icon: 'fa-bus-simple',
    color: '#003DA5',
    website: 'https://kingcounty.gov/metro',
    phone: '(206) 553-3000',
    coverage: 'King County (Seattle, Bellevue, Redmond, etc.)',
    fares: {
      adult: { amount: 3.00, label: 'Adult' },
      youth: { amount: 0, label: 'Youth (18 & under)' },
      orcaLift: { amount: 1.00, label: 'ORCA LIFT' },
      senior: { amount: 1.00, label: 'Senior (65+)' },
      disabled: { amount: 1.00, label: 'Disabled' },
      access: { amount: 1.75, label: 'Access Paratransit' },
      dayPass: { amount: 6.00, label: 'Regional Day Pass' },
      dayPassReduced: { amount: 2.00, label: 'Day Pass (Reduced)' },
    },
    payment: ['ORCA card', 'Debit/Credit (contactless)', 'Cash (exact change)', 'Transit GO Ticket app'],
    services: ['Bus', 'RapidRide', 'DART On-Demand', 'Metro Flex', 'Water Taxi', 'Vanpool', 'Trailhead Direct'],
    tripPlanner: 'https://kingcounty.gov/metro/schedules-and-maps/trip-planner',
  },
  soundTransit: {
    name: 'Sound Transit',
    abbr: 'ST',
    icon: 'fa-train-subway',
    color: '#004B87',
    website: 'https://www.soundtransit.org',
    phone: '(888) 889-6368',
    coverage: 'Central Puget Sound (Seattle, Tacoma, Everett)',
    fares: {
      lightRail_1zone: { amount: 2.25, label: 'Light Rail (1-2 stops)' },
      lightRail_2zone: { amount: 2.75, label: 'Light Rail (3-6 stops)' },
      lightRail_3zone: { amount: 3.25, label: 'Light Rail (7+ stops)' },
      expressAdult: { amount: 3.25, label: 'ST Express Bus' },
      sounderAdult: { amount: 3.75, label: 'Sounder Train' },
      youth: { amount: 0, label: 'Youth (18 & under)' },
      senior: { amount: 1.00, label: 'Senior (65+)' },
      dayPass: { amount: 6.00, label: 'Regional Day Pass' },
    },
    payment: ['ORCA card', 'Debit/Credit (contactless)', 'Transit GO Ticket app'],
    services: ['1 Line Light Rail', '2 Line Light Rail', 'ST Express Bus', 'Sounder Train', 'T Line (Tacoma Link)'],
    lightRailStations: [
      'Lynnwood City Center', 'Mountlake Terrace', 'Shoreline North', 'Shoreline South',
      'Northgate', 'Roosevelt', 'U District', 'University of Washington', 'Capitol Hill',
      'Westlake', 'Pioneer Square', 'International District', 'Stadium', 'SODO',
      'Beacon Hill', 'Columbia City', 'Othello', 'Rainier Beach', 'Tukwila Intl Blvd',
      'SeaTac/Airport', 'Angle Lake', 'Kent/Des Moines', 'Federal Way Downtown',
    ],
    tripPlanner: 'https://www.soundtransit.org/ride-with-us/trip-planner',
  },
  everettTransit: {
    name: 'Everett Transit',
    abbr: 'ET',
    icon: 'fa-bus',
    color: '#C41E3A',
    website: 'https://www.everetttransit.org',
    phone: '(425) 257-7777',
    coverage: 'City of Everett',
    fares: {
      adult: { amount: 1.25, label: 'Adult' },
      youth: { amount: 0, label: 'Youth (18 & under)' },
      senior: { amount: 0.50, label: 'Senior (65+)' },
      disabled: { amount: 0.50, label: 'Disabled' },
    },
    payment: ['ORCA card', 'Cash (exact change)'],
    services: ['Local Bus'],
    tripPlanner: 'https://www.everetttransit.org/routes',
  },
  piercTransit: {
    name: 'Pierce Transit',
    abbr: 'PT',
    icon: 'fa-bus',
    color: '#1B75BC',
    website: 'https://www.piercetransit.org',
    phone: '(253) 581-8000',
    coverage: 'Pierce County (Tacoma, Lakewood)',
    fares: {
      adult: { amount: 2.00, label: 'Adult' },
      youth: { amount: 0, label: 'Youth (18 & under)' },
      senior: { amount: 0.75, label: 'Senior (65+)' },
      disabled: { amount: 0.75, label: 'Disabled' },
    },
    payment: ['ORCA card', 'Cash (exact change)'],
    services: ['Local Bus', 'Runner On-Demand'],
  },
};

// ═══════════════════════════════════════════════════════════════════
// TRANSPORT MODES
// ═══════════════════════════════════════════════════════════════════

const TRANSPORT_MODES = {
  walking: {
    name: 'Walking',
    icon: 'fa-person-walking',
    color: '#22c55e',
    avgSpeedMph: 3.1,
    osrmProfile: 'foot',
    cost: 'Free',
    description: 'On foot – the stealthiest approach',
  },
  cycling: {
    name: 'Cycling',
    icon: 'fa-bicycle',
    color: '#06b6d4',
    avgSpeedMph: 12,
    osrmProfile: 'bike',
    cost: 'Free (own bike)',
    description: 'Bike – fast and flexible',
  },
  scooter: {
    name: 'E-Scooter',
    icon: 'fa-bolt',
    color: '#f59e0b',
    avgSpeedMph: 15,
    osrmProfile: 'bike',
    cost: '$1 unlock + ~$0.39/min',
    description: 'Lime/Bird in Seattle/Everett',
    providers: [
      { name: 'Lime', areas: ['Seattle', 'Everett'] },
      { name: 'Bird', areas: ['Seattle'] },
    ],
  },
  bus: {
    name: 'Bus',
    icon: 'fa-bus',
    color: '#3b82f6',
    cost: '$1.25 – $3.25',
    description: 'Community Transit, Metro, Everett Transit, Pierce Transit',
  },
  zipShuttle: {
    name: 'Zip Shuttle',
    icon: 'fa-shuttle-van',
    color: '#00a651',
    cost: '$2.50 (adult), FREE youth',
    description: 'On-demand rides in Arlington, Darrington, Lake Stevens, Alderwood',
    bookingUrl: 'https://www.communitytransit.org/zip',
    bookingPhone: '(833) DIAL-ZIP',
  },
  lightRail: {
    name: 'Light Rail',
    icon: 'fa-train-subway',
    color: '#a855f7',
    cost: '$2.25 – $3.25',
    description: 'Sound Transit 1 Line (Everett to Federal Way)',
  },
  driving: {
    name: 'Driving',
    icon: 'fa-car',
    color: '#ef4444',
    avgSpeedMph: 35,
    osrmProfile: 'car',
    cost: 'Gas + vehicle',
    description: 'Drive yourself – least stealthy arrival',
  },
};

// ═══════════════════════════════════════════════════════════════════
// ROUTING (OSRM - Open Source Routing Machine)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get route from OSRM public demo server
 * Profiles: foot, bike, car
 */
async function getOSRMRoute(fromLat, fromLon, toLat, toLon, profile = 'foot') {
  const profileMap = { foot: 'foot', bike: 'bike', car: 'car' };
  const osrmProfile = profileMap[profile] || 'foot';

  try {
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true`;
    const res = await axios.get(url, { timeout: 15000 });

    if (res.data?.code === 'Ok' && res.data.routes?.length > 0) {
      const route = res.data.routes[0];
      return {
        distance: route.distance, // meters
        distanceMiles: (route.distance / 1609.34).toFixed(1),
        duration: route.duration, // seconds
        durationMin: Math.round(route.duration / 60),
        geometry: route.geometry, // GeoJSON LineString
        steps: (route.legs?.[0]?.steps || []).map(s => ({
          instruction: s.maneuver?.instruction || buildInstruction(s),
          distance: s.distance,
          duration: s.duration,
          name: s.name || '',
          type: s.maneuver?.type || '',
          modifier: s.maneuver?.modifier || '',
        })),
      };
    }
    return null;
  } catch (err) {
    console.warn(`OSRM route error (${profile}):`, err.message);
    return null;
  }
}

function buildInstruction(step) {
  const type = step.maneuver?.type || '';
  const modifier = step.maneuver?.modifier || '';
  const name = step.name || 'unnamed road';

  if (type === 'depart') return `Head ${modifier || 'forward'} on ${name}`;
  if (type === 'arrive') return `Arrive at destination`;
  if (type === 'turn') return `Turn ${modifier} onto ${name}`;
  if (type === 'continue') return `Continue on ${name}`;
  if (type === 'merge') return `Merge onto ${name}`;
  if (type === 'fork') return `Take the ${modifier} fork onto ${name}`;
  if (type === 'roundabout') return `Enter roundabout, take exit onto ${name}`;
  return `${type} ${modifier} – ${name}`.trim();
}

// ═══════════════════════════════════════════════════════════════════
// TRANSIT MATCHING
// ═══════════════════════════════════════════════════════════════════

/**
 * Determine which Zip Shuttle zones serve a given location
 */
function getZipZones(lat, lon) {
  const zones = [];
  const zipAgencies = ['zipAlderwood', 'zipArlington', 'zipDarrington', 'zipLakeStevens'];

  for (const key of zipAgencies) {
    const agency = TRANSIT_AGENCIES[key];
    if (agency.bounds) {
      const b = agency.bounds;
      // Expanded check with ~2 mile buffer
      const buffer = 0.03; // ~2 miles in degrees
      if (lat >= b.south - buffer && lat <= b.north + buffer &&
          lon >= b.west - buffer && lon <= b.east + buffer) {
        zones.push({
          key,
          name: agency.name,
          hours: agency.hours,
          fares: agency.fares,
          booking: agency.booking,
          phone: agency.phone,
          destinations: agency.destinations,
          connections: agency.connections,
        });
      }
    }
  }
  return zones;
}

/**
 * Find which bus/transit agencies serve an area based on coordinates
 */
function getTransitAgencies(lat, lon) {
  const agencies = [];

  // Snohomish County: Community Transit
  if (lat >= 47.73 && lat <= 48.35 && lon >= -122.45 && lon <= -121.05) {
    agencies.push(TRANSIT_AGENCIES.communityTransit);
  }

  // King County: Metro
  if (lat >= 47.15 && lat <= 47.78 && lon >= -122.55 && lon <= -121.85) {
    agencies.push(TRANSIT_AGENCIES.kingCountyMetro);
  }

  // Puget Sound region: Sound Transit
  if (lat >= 47.0 && lat <= 48.1 && lon >= -122.55 && lon <= -122.0) {
    agencies.push(TRANSIT_AGENCIES.soundTransit);
  }

  // Everett: Everett Transit
  if (lat >= 47.93 && lat <= 48.03 && lon >= -122.26 && lon <= -122.17) {
    agencies.push(TRANSIT_AGENCIES.everettTransit);
  }

  // Pierce County: Pierce Transit
  if (lat >= 46.9 && lat <= 47.35 && lon >= -122.55 && lon <= -122.15) {
    agencies.push(TRANSIT_AGENCIES.piercTransit);
  }

  return agencies;
}



/**
 * Estimate scooter cost for a trip
 */
function estimateScooterCost(distanceMiles, avgSpeedMph = 15) {
  const minutes = (distanceMiles / avgSpeedMph) * 60;
  const unlock = 1.00;
  const perMin = 0.39;
  return {
    total: (unlock + perMin * minutes).toFixed(2),
    minutes: Math.round(minutes),
    breakdown: `$${unlock.toFixed(2)} unlock + $${perMin}/min × ${Math.round(minutes)} min`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN TRANSIT DIRECTIONS FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Get comprehensive transit directions between two points
 *
 * @param {number} fromLat - Origin latitude
 * @param {number} fromLon - Origin longitude
 * @param {number} toLat   - Destination latitude
 * @param {number} toLon   - Destination longitude
 * @returns {Object} - All transit options with routes, fares, times
 */
async function getTransitDirections(fromLat, fromLon, toLat, toLon) {
  const straightDistance = haversine(fromLat, fromLon, toLat, toLon);
  const results = {
    straightDistance: straightDistance.toFixed(1),
    from: { lat: fromLat, lon: fromLon },
    to: { lat: toLat, lon: toLon },
    modes: [],
    transitAgencies: [],
    zipZones: { origin: [], destination: [] },
    timestamp: new Date().toISOString(),
  };

  // Get available transit agencies for origin and destination
  results.transitAgencies = [
    ...getTransitAgencies(fromLat, fromLon),
    ...getTransitAgencies(toLat, toLon),
  ].filter((a, i, arr) => arr.findIndex(b => b.abbr === a.abbr) === i);

  // Check Zip Shuttle availability
  results.zipZones.origin = getZipZones(fromLat, fromLon);
  results.zipZones.destination = getZipZones(toLat, toLon);

  // ─── Walking Route ───
  const walkRoute = await getOSRMRoute(fromLat, fromLon, toLat, toLon, 'foot');
  if (walkRoute) {
    results.modes.push({
      type: 'walking',
      ...TRANSPORT_MODES.walking,
      route: walkRoute,
      distanceMiles: walkRoute.distanceMiles,
      durationMin: walkRoute.durationMin,
      durationText: formatDuration(walkRoute.durationMin),
      fareText: 'Free',
      fareAmount: 0,
      stealthRating: 5,
      practicality: walkRoute.durationMin <= 120 ? 'recommended' : walkRoute.durationMin <= 240 ? 'possible' : 'impractical',
    });
  }

  // ─── Cycling Route ───
  const bikeRoute = await getOSRMRoute(fromLat, fromLon, toLat, toLon, 'bike');
  if (bikeRoute) {
    results.modes.push({
      type: 'cycling',
      ...TRANSPORT_MODES.cycling,
      route: bikeRoute,
      distanceMiles: bikeRoute.distanceMiles,
      durationMin: bikeRoute.durationMin,
      durationText: formatDuration(bikeRoute.durationMin),
      fareText: 'Free (own bike)',
      fareAmount: 0,
      stealthRating: 4,
      practicality: bikeRoute.durationMin <= 90 ? 'recommended' : bikeRoute.durationMin <= 180 ? 'possible' : 'impractical',
    });

    // ─── E-Scooter (uses bike route) ───
    const scooterCost = estimateScooterCost(parseFloat(bikeRoute.distanceMiles));
    const scooterDuration = Math.round(parseFloat(bikeRoute.distanceMiles) / 15 * 60);
    results.modes.push({
      type: 'scooter',
      ...TRANSPORT_MODES.scooter,
      route: bikeRoute, // same path as bike
      distanceMiles: bikeRoute.distanceMiles,
      durationMin: scooterDuration,
      durationText: formatDuration(scooterDuration),
      fareText: `~$${scooterCost.total}`,
      fareAmount: parseFloat(scooterCost.total),
      fareBreakdown: scooterCost.breakdown,
      stealthRating: 3,
      practicality: scooterDuration <= 30 ? 'recommended' : scooterDuration <= 60 ? 'possible' : 'impractical',
      note: 'Available in Seattle & some Everett areas. Check Lime/Bird app for availability.',
    });
  }

  // ─── Driving Route ───
  const driveRoute = await getOSRMRoute(fromLat, fromLon, toLat, toLon, 'car');
  if (driveRoute) {
    const gasCost = (parseFloat(driveRoute.distanceMiles) / 25 * 4.50).toFixed(2); // ~25 mpg, ~$4.50/gal WA avg
    results.modes.push({
      type: 'driving',
      ...TRANSPORT_MODES.driving,
      route: driveRoute,
      distanceMiles: driveRoute.distanceMiles,
      durationMin: driveRoute.durationMin,
      durationText: formatDuration(driveRoute.durationMin),
      fareText: `~$${gasCost} gas`,
      fareAmount: parseFloat(gasCost),
      fareBreakdown: `${driveRoute.distanceMiles} mi ÷ 25 mpg × $4.50/gal`,
      stealthRating: 1,
      practicality: 'recommended',
    });
  }

  // ─── Bus/Transit Options ───
  if (results.transitAgencies.length > 0) {
    const busInfo = {
      type: 'bus',
      ...TRANSPORT_MODES.bus,
      agencies: results.transitAgencies.map(a => ({
        name: a.name,
        abbr: a.abbr,
        color: a.color,
        fares: a.fares,
        payment: a.payment,
        services: a.services,
        phone: a.phone,
        website: a.website,
        tripPlanner: a.tripPlanner,
      })),
      distanceMiles: driveRoute?.distanceMiles || straightDistance.toFixed(1),
      durationMin: driveRoute ? Math.round(driveRoute.durationMin * 1.8) : Math.round(straightDistance / 15 * 60),
      durationText: formatDuration(driveRoute ? Math.round(driveRoute.durationMin * 1.8) : Math.round(straightDistance / 15 * 60)),
      fareText: getFareRange(results.transitAgencies),
      stealthRating: 3,
      practicality: straightDistance <= 30 ? 'recommended' : 'possible',
      route: driveRoute, // approximate path
      note: 'Times are approximate. Use agency trip planners for exact schedules & routes.',
    };
    results.modes.push(busInfo);
  }

  // ─── Zip Shuttle ───
  const allZipZones = [...results.zipZones.origin, ...results.zipZones.destination];
  if (allZipZones.length > 0) {
    const uniqueZones = allZipZones.filter((z, i, arr) => arr.findIndex(a => a.key === z.key) === i);
    results.modes.push({
      type: 'zipShuttle',
      ...TRANSPORT_MODES.zipShuttle,
      zones: uniqueZones,
      distanceMiles: straightDistance.toFixed(1),
      durationMin: Math.round(straightDistance / 20 * 60) + 15, // drive time + 15 min avg wait
      durationText: formatDuration(Math.round(straightDistance / 20 * 60) + 15),
      fareText: '$2.50 (adult) / FREE (youth)',
      fareAmount: 2.50,
      stealthRating: 3,
      practicality: 'recommended',
      note: `Serving: ${uniqueZones.map(z => z.name).join(', ')}. Book ahead via app or call.`,
    });
  }

  // ─── Light Rail ───
  // If origin or dest is near a light rail station
  const nearOrigin = isNearLightRail(fromLat, fromLon);
  const nearDest = isNearLightRail(toLat, toLon);
  if (nearOrigin || nearDest) {
    results.modes.push({
      type: 'lightRail',
      ...TRANSPORT_MODES.lightRail,
      distanceMiles: driveRoute?.distanceMiles || straightDistance.toFixed(1),
      durationMin: driveRoute ? Math.round(driveRoute.durationMin * 1.2) : Math.round(straightDistance / 30 * 60),
      durationText: formatDuration(driveRoute ? Math.round(driveRoute.durationMin * 1.2) : Math.round(straightDistance / 30 * 60)),
      fareText: '$2.25 – $3.25',
      fareAmount: 2.75,
      stealthRating: 3,
      practicality: (nearOrigin && nearDest) ? 'recommended' : 'possible',
      route: driveRoute,
      nearestStations: {
        origin: nearOrigin,
        destination: nearDest,
      },
      note: nearOrigin && nearDest
        ? `Nearest stations: ${nearOrigin.name} → ${nearDest.name}`
        : `Nearest station: ${(nearOrigin || nearDest).name}. May need bus/walk connection.`,
    });
  }

  // Sort: recommended first, then by duration
  const order = { recommended: 0, possible: 1, impractical: 2 };
  results.modes.sort((a, b) => {
    const pa = order[a.practicality] ?? 1;
    const pb = order[b.practicality] ?? 1;
    if (pa !== pb) return pa - pb;
    return (a.durationMin || 999) - (b.durationMin || 999);
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════════
// LIGHT RAIL STATION DATA
// ═══════════════════════════════════════════════════════════════════

const LIGHT_RAIL_STATIONS = [
  { name: 'Lynnwood City Center', lat: 47.8148, lon: -122.2939 },
  { name: 'Mountlake Terrace', lat: 47.7893, lon: -122.3063 },
  { name: 'Shoreline North/185th', lat: 47.7543, lon: -122.3163 },
  { name: 'Shoreline South/148th', lat: 47.7338, lon: -122.3167 },
  { name: 'Northgate', lat: 47.7069, lon: -122.3273 },
  { name: 'Roosevelt', lat: 47.6765, lon: -122.3173 },
  { name: 'U District', lat: 47.6615, lon: -122.3156 },
  { name: 'University of Washington', lat: 47.6504, lon: -122.3038 },
  { name: 'Capitol Hill', lat: 47.6194, lon: -122.3213 },
  { name: 'Westlake', lat: 47.6113, lon: -122.3376 },
  { name: 'Pioneer Square', lat: 47.6017, lon: -122.3316 },
  { name: 'International District/Chinatown', lat: 47.5985, lon: -122.3277 },
  { name: 'Stadium', lat: 47.5917, lon: -122.3276 },
  { name: 'SODO', lat: 47.5805, lon: -122.3275 },
  { name: 'Beacon Hill', lat: 47.5681, lon: -122.3118 },
  { name: 'Columbia City', lat: 47.5589, lon: -122.2919 },
  { name: 'Othello', lat: 47.5382, lon: -122.2815 },
  { name: 'Rainier Beach', lat: 47.5225, lon: -122.2691 },
  { name: 'Tukwila Intl Blvd', lat: 47.4894, lon: -122.2880 },
  { name: 'SeaTac/Airport', lat: 47.4449, lon: -122.2964 },
  { name: 'Angle Lake', lat: 47.4323, lon: -122.2978 },
  { name: 'Kent/Des Moines', lat: 47.4031, lon: -122.2970 },
  { name: 'Federal Way Downtown', lat: 47.3200, lon: -122.3128 },
];

function isNearLightRail(lat, lon, maxMiles = 2) {
  let nearest = null;
  let minDist = Infinity;

  for (const station of LIGHT_RAIL_STATIONS) {
    const d = haversine(lat, lon, station.lat, station.lon);
    if (d < minDist) {
      minDist = d;
      nearest = { ...station, distance: d.toFixed(1) };
    }
  }

  return minDist <= maxMiles ? nearest : null;
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getFareRange(agencies) {
  const fares = agencies.flatMap(a => Object.values(a.fares).map(f => f.amount)).filter(f => f > 0);
  if (fares.length === 0) return 'Free – varies';
  const min = Math.min(...fares);
  const max = Math.max(...fares);
  return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} – $${max.toFixed(2)}`;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  getTransitDirections,
  getOSRMRoute,
  getZipZones,
  getTransitAgencies,
  isNearLightRail,
  TRANSIT_AGENCIES,
  TRANSPORT_MODES,
  LIGHT_RAIL_STATIONS,
};
