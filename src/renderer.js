/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║                  G H O S T C A M P   v2.0  –  Renderer          ║
 * ║         Washington State Stealth Camp & Shelter Locator          ║
 * ║              "Vanish into the woods. Leave no trace."            ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

/* global L, Chart, Toastify, dayjs, particlesJS, confetti, tippy */

(() => {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════
  const state = {
    map: null,
    markers: null,
    markerCache: new Map(),
    heatLayer: null,
    userMarker: null,
    lastSearch: null,
    searchCenter: null,
    locations: [],
    filtered: [],
    activeFilter: 'all',
    sortBy: 'distance',
    favorites: [],
    notes: {},
    selectedLocation: null,
    darkTiles: null,
    lightTiles: null,
    satelliteTiles: null,
    heatmapOn: false,
    crimeHeatmapOn: false,
    crimeHeatLayer: null,
    crimeHeatData: [],
    forestHeatmapOn: false,
    forestHeatLayer: null,
    satelliteOn: false,
    legendDisabled: new Set(),
    charts: { types: null, sources: null },
    searchCount: 0,
    totalFound: 0,
    queryTime: 0,
    sourceTimings: {},
    legendCounts: {},
    userData: {},
    transitRoute: null,
    transitDestination: null,
    resultsRenderStep: 250,
    renderedResultsLimit: 250,
  };

  // WA center
  const WA_CENTER = [47.6062, -122.3321];

  // ═══════════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════════
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const show = (el) => { if (el) el.classList.remove('hidden'); };
  const hide = (el) => { if (el) el.classList.add('hidden'); };

  // Clean up any modal-specific markers when that modal is dismissed
  function cleanupModalMarkers(modal) {
    if (!modal || !state.map) return;
    const id = modal.id || '';
    if (id === 'grocery-modal') { clearStoreMarkers?.(); clearFoodBankMarkers?.(); };
    if (id === 'bathrooms-modal') { bathroomMarkers?.forEach(m => state.map.removeLayer(m)); bathroomMarkers = []; }
    if (id === 'bridges-modal') { bridgeMarkers?.forEach(m => state.map.removeLayer(m)); bridgeMarkers = []; }
    if (id === 'resources-modal') clearResourceMarkers?.();
  }

  function toast(msg, type = 'info') {
    const bg = {
      info: 'linear-gradient(135deg, #22c55e, #10b981)',
      success: 'linear-gradient(135deg, #22c55e, #059669)',
      error: 'linear-gradient(135deg, #ef4444, #dc2626)',
      warn: 'linear-gradient(135deg, #f59e0b, #d97706)',
      warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
    };
    Toastify({ text: msg, duration: 3500, gravity: 'bottom', position: 'right', style: { background: bg[type] || bg.info, borderRadius: '10px', fontFamily: "'Outfit', sans-serif", fontSize: '12px', padding: '8px 16px' } }).showToast();
  }

  function makeId(loc) {
    return loc.id || `${loc.source}-${loc.name}-${loc.lat?.toFixed(4)}-${loc.lon?.toFixed(4)}`;
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function typeClass(loc) {
    const t = (loc.type || '').toLowerCase();
    const s = (loc.source || '').toLowerCase();
    if (s === 'crime intel') return 'sketch';
    if (t.includes('sketch') || t.includes('crime') || t.includes('shady') || t.includes('grit')) return 'sketch';
    if (s === 'woods') return 'woods';
    if (s === 'waterways') return 'water';
    if (t.includes('ev charg') || t.includes('charging')) return 'urban';
    if (t.includes('bridge')) return 'bridge';
    if (t.includes('cave') || t.includes('rock overhang') || t.includes('tunnel') || t.includes('passage')
        || t.includes('pavilion') || t.includes('bandstand') || t.includes('gazebo')
        || t.includes('parking garage') || t.includes('covered')
        || t.includes('bus shelter') || t.includes('lean-to')
        || t.includes('arcade') || t.includes('colonnade') || t.includes('canopy')
        || t.includes('awning') || t.includes('carport') || t.includes('porch')
        || t.includes('grandstand') || t.includes('bleacher')
        || t.includes('loading dock') || t.includes('pergola')) return 'cover';
    if (t.includes('restroom') || t.includes('shower facility') || (t.includes('toilet') && !t.includes('camp'))) return 'restroom';
    if (t.includes('dispers') || t.includes('blm') || t.includes('boondock')) return 'dispersed';
    if (t.includes('campground') || t.includes('camp')) return 'campground';
    if (t.includes('shelter') || t.includes('hut') || t.includes('alpine')) return 'shelter';
    if (t.includes('forest') || t.includes('trail') || t.includes('nature') || t.includes('hideout')
        || t.includes('wood') || t.includes('canopy') || t.includes('wilderness')
        || t.includes('scrub') || t.includes('protected area') || t.includes('national park')) return 'forest';
    if (t.includes('urban') || t.includes('stealth') || t.includes('parking')
        || t.includes('walmart') || t.includes('casino') || t.includes('rest area')
        || t.includes('overnight') || t.includes('visitor center')) return 'urban';
    if (t.includes('service')) return 'services';
    if (t.includes('water') || t.includes('river') || t.includes('lake') || t.includes('spring')
        || t.includes('stream') || t.includes('creek') || t.includes('pond')
        || t.includes('rapids') || t.includes('waterfall') || t.includes('canal')
        || t.includes('fishing') || t.includes('swimming') || t.includes('ford')
        || t.includes('pier') || t.includes('boat') || t.includes('reservoir')
        || t.includes('wetland') || t.includes('dam')) return 'water';
    return 'default';
  }

  function typeIcon(tc) {
    const icons = {
      dispersed: 'fa-tree', campground: 'fa-campground', forest: 'fa-leaf',
      urban: 'fa-city', services: 'fa-hands-helping', water: 'fa-faucet-drip',
      bridge: 'fa-bridge', cover: 'fa-umbrella', shelter: 'fa-house-chimney',
      restroom: 'fa-restroom', woods: 'fa-tree', sketch: 'fa-skull-crossbones', default: 'fa-map-pin',
    };
    return icons[tc] || 'fa-map-pin';
  }

  function markerColor(tc) {
    const colors = {
      dispersed: '#22c55e', campground: '#3b82f6', forest: '#eab308',
      urban: '#ef4444', services: '#a855f7', water: '#06b6d4',
      bridge: '#818cf8', cover: '#fb923c', shelter: '#ec4899',
      restroom: '#2dd4bf', woods: '#15803d', sketch: '#f87171', default: '#94a3b8',
    };
    return colors[tc] || '#94a3b8';
  }

  function enrichLocation(loc) {
    const enriched = { ...loc, _id: loc._id || makeId(loc) };
    enriched._typeClass = typeClass(enriched);
    return enriched;
  }

  function rebuildLegendCounts() {
    const tally = {};
    state.locations.forEach((loc) => {
      const tc = loc._typeClass || typeClass(loc);
      tally[tc] = (tally[tc] || 0) + 1;
    });
    state.legendCounts = tally;
  }

  function resetSearchDerivedState() {
    state.markerCache.clear();
    state.legendCounts = {};
    state.renderedResultsLimit = state.resultsRenderStep;
  }

  function typeBadge(tc) {
    const badges = {
      dispersed: 'D', campground: 'C', forest: 'F',
      urban: 'U', services: 'S', water: 'W',
      bridge: 'B', cover: 'R', shelter: 'H',
      restroom: 'T', woods: 'N', sketch: '!', default: '?',
    };
    return badges[tc] || '?';
  }

  function stealthStars(rating) {
    const r = Math.min(5, Math.max(0, Math.round(rating || 0)));
    return Array.from({ length: 5 }, (_, i) => `<i class="fa-solid fa-person-shelter stealth-star ${i < r ? 'filled' : ''}"></i>`).join('');
  }

  function stealthBars(rating) {
    const r = Math.min(5, Math.max(0, Math.round(rating || 0)));
    const cls = r <= 2 ? 'low' : r <= 3 ? 'medium' : '';
    return Array.from({ length: 5 }, (_, i) => `<div class="stealth-bar ${i < r ? `filled ${cls}` : ''}"></div>`).join('');
  }

  function distanceText(d) {
    if (!d && d !== 0) return '';
    return d < 0.1 ? '< 0.1 mi' : `${d.toFixed(1)} mi`;
  }

  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function truncate(s, n = 120) { return s && s.length > n ? s.slice(0, n) + '…' : s || ''; }

  // ═══════════════════════════════════════════════════════════════════
  // SPLASH SCREEN
  // ═══════════════════════════════════════════════════════════════════
  function initSplash() {
    const fill = $('#loader-fill');
    const status = $('#splash-status');
    const stages = [
      { pct: 10, text: '<i class="fa-solid fa-person-shelter"></i> Hitching a ride...' },
      { pct: 25, text: '<i class="fa-solid fa-database"></i> Loading RIDB data...' },
      { pct: 35, text: '<i class="fa-brands fa-openstreetmap"></i> Connecting to OpenStreetMap...' },
      { pct: 45, text: '<i class="fa-solid fa-campground"></i> Scanning FreeCampsites...' },
      { pct: 55, text: '<i class="fa-solid fa-globe"></i> Reaching iOverlander...' },
      { pct: 65, text: '<i class="fa-brands fa-reddit"></i> Gathering Reddit intel...' },
      { pct: 75, text: '<i class="fa-solid fa-cloud-sun"></i> Fetching weather data...' },
      { pct: 85, text: '<i class="fa-solid fa-mountain"></i> Analyzing terrain...' },
      { pct: 95, text: '<i class="fa-solid fa-map"></i> Rendering map layers...' },
      { pct: 100, text: '<i class="fa-solid fa-check"></i> Ready to vanish!' },
    ];

    try { particlesJS('particles-bg', particlesConfig()); } catch (e) {}

    let i = 0;
    const interval = setInterval(() => {
      if (i >= stages.length) {
        clearInterval(interval);
        setTimeout(dismissSplash, 500);
        return;
      }
      fill.style.width = stages[i].pct + '%';
      status.innerHTML = stages[i].text;
      i++;
    }, 350);
  }

  function dismissSplash() {
    const splash = $('#splash-screen');
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      // Check if user already accepted the disclaimer
      if (localStorage.getItem('hobocamp_disclaimer_accepted') === 'true') {
        enterApp();
      } else {
        showDisclaimer();
      }
    }, 600);
  }

  function showDisclaimer() {
    const overlay = $('#disclaimer-overlay');
    const checkbox = $('#disclaimer-check');
    const agreeBtn = $('#btn-disclaimer-agree');
    show(overlay);

    checkbox.checked = false;
    agreeBtn.disabled = true;

    checkbox.addEventListener('change', () => {
      agreeBtn.disabled = !checkbox.checked;
    });

    agreeBtn.addEventListener('click', () => {
      if (!checkbox.checked) return;
      localStorage.setItem('hobocamp_disclaimer_accepted', 'true');
      overlay.classList.add('fade-out');
      setTimeout(() => {
        hide(overlay);
        overlay.classList.remove('fade-out');
        enterApp();
      }, 400);
    });
  }

  async function enterApp() {
    show($('#app'));
    await loadUserData();
    initMap();
  }

  function particlesConfig() {
    return {
      particles: {
        number: { value: 50 },
        color: { value: '#22c55e' },
        shape: { type: 'circle' },
        opacity: { value: 0.2, random: true },
        size: { value: 2, random: true },
        move: { enable: true, speed: 0.5, direction: 'none', random: true, out_mode: 'out' },
        line_linked: { enable: true, distance: 150, color: '#22c55e', opacity: 0.06, width: 1 },
      },
      interactivity: { events: { onhover: { enable: false }, onclick: { enable: false } } },
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAP
  // ═══════════════════════════════════════════════════════════════════
  function initMap() {
    state.darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com">CARTO</a>',
      maxZoom: 19,
    });
    state.lightTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    });
    state.satelliteTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19,
    });

    const theme = document.documentElement.getAttribute('data-theme');
    const baseTile = theme === 'light' ? state.lightTiles : state.darkTiles;

    state.map = L.map('map', {
      center: WA_CENTER,
      zoom: 8,
      zoomControl: true,
      layers: [baseTile],
      maxBounds: [[44, -126], [50, -116]],
      maxBoundsViscosity: 0.8,
      preferCanvas: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelDebounceTime: 80,
    });

    state.markers = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 20,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 16,
      animate: false,
      removeOutsideVisibleBounds: true,
      iconCreateFunction: function (cluster) {
        const children = cluster.getAllChildMarkers();
        const count = children.length;
        // Tally dominant type by reading the marker's _typeClass
        const tally = {};
        children.forEach(m => {
          const tc = m._typeClass || 'default';
          tally[tc] = (tally[tc] || 0) + 1;
        });
        // Find dominant type
        let dominant = 'default', maxCount = 0;
        for (const [tc, n] of Object.entries(tally)) {
          if (n > maxCount) { maxCount = n; dominant = tc; }
        }
        const color = markerColor(dominant);
        const size = count < 10 ? 36 : count < 50 ? 42 : 50;
        const half = size / 2;
        // Build pie-chart-like ring if mixed types
        const types = Object.entries(tally).sort((a, b) => b[1] - a[1]);
        let ring = '';
        if (types.length > 1) {
          let cumPct = 0;
          const segments = types.map(([tc, n]) => {
            const pct = (n / count) * 100;
            const seg = `${markerColor(tc)} ${cumPct}% ${cumPct + pct}%`;
            cumPct += pct;
            return seg;
          });
          ring = `background: conic-gradient(${segments.join(', ')});`;
        } else {
          ring = `background: ${color};`;
        }
        return L.divIcon({
          html: `<div class="cluster-ring" style="width:${size}px;height:${size}px;${ring}"><div class="cluster-inner">${count}</div></div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [half, half],
        });
      },
    });
    state.map.addLayer(state.markers);

    // Custom locate control
    const locateBtn = $('#btn-map-locate');
    let locateActive = false;
    let locateWatchId = null;
    let locateMarker = null;
    let locateCircle = null;

    locateBtn.addEventListener('click', () => {
      if (locateActive) {
        // Stop tracking
        locateActive = false;
        locateBtn.classList.remove('active');
        if (locateWatchId !== null) { navigator.geolocation.clearWatch(locateWatchId); locateWatchId = null; }
        if (locateMarker) { state.map.removeLayer(locateMarker); locateMarker = null; }
        if (locateCircle) { state.map.removeLayer(locateCircle); locateCircle = null; }
        return;
      }
      locateActive = true;
      locateBtn.classList.add('active');
      locateBtn.querySelector('i').className = 'fa-solid fa-spinner fa-spin';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          locateBtn.querySelector('i').className = 'fa-solid fa-location-crosshairs';
          state.map.flyTo([lat, lng], 15, { duration: 0.8 });
          if (locateMarker) state.map.removeLayer(locateMarker);
          if (locateCircle) state.map.removeLayer(locateCircle);
          locateMarker = L.marker([lat, lng], {
            icon: L.divIcon({ className: 'locate-pulse-icon', iconSize: [18, 18], iconAnchor: [9, 9] }),
            zIndexOffset: 2000,
          }).addTo(state.map).bindPopup('<b>You are here</b>');
          locateCircle = L.circle([lat, lng], { radius: accuracy, className: 'locate-accuracy-circle' }).addTo(state.map);
        },
        () => {
          locateBtn.querySelector('i').className = 'fa-solid fa-location-crosshairs';
          locateActive = false;
          locateBtn.classList.remove('active');
          toast('Could not determine your location', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });

    // Custom fullscreen control
    const fsBtn = $('#btn-map-fullscreen');
    fsBtn.addEventListener('click', () => {
      const container = $('#map-container');
      if (!document.fullscreenElement) {
        container.requestFullscreen().then(() => {
          fsBtn.querySelector('i').className = 'fa-solid fa-compress';
          state.map.invalidateSize();
        }).catch(() => {});
      } else {
        document.exitFullscreen().then(() => {
          fsBtn.querySelector('i').className = 'fa-solid fa-expand';
          state.map.invalidateSize();
        }).catch(() => {});
      }
    });
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        fsBtn.querySelector('i').className = 'fa-solid fa-expand';
        state.map.invalidateSize();
      }
    });

    // Track mouse coords in footer
    let mouseCoordsFrame = null;
    let latestMouseCoords = null;
    state.map.on('mousemove', (e) => {
      latestMouseCoords = e.latlng;
      if (mouseCoordsFrame) return;
      mouseCoordsFrame = requestAnimationFrame(() => {
        mouseCoordsFrame = null;
        if (!latestMouseCoords) return;
        $('#footer-coords').textContent = `${latestMouseCoords.lat.toFixed(4)}, ${latestMouseCoords.lng.toFixed(4)}`;
      });
    });

    // Click map to add custom spot
    state.map.on('contextmenu', (e) => {
      $('#spot-lat').value = e.latlng.lat.toFixed(6);
      $('#spot-lon').value = e.latlng.lng.toFixed(6);
      show($('#add-spot-modal'));
    });

    // "Search This Area" button — appears when user pans/zooms away from last search center
    const searchAreaBtn = $('#btn-search-area');

    state.map.on('moveend', () => {
      if (!state.searchCenter) return;
      const c = state.map.getCenter();
      const dist = haversine(state.searchCenter.lat, state.searchCenter.lon, c.lat, c.lng);
      if (dist > 3) {
        searchAreaBtn.classList.remove('hidden');
      } else {
        searchAreaBtn.classList.add('hidden');
      }
    });

    searchAreaBtn.addEventListener('click', () => {
      searchAreaBtn.classList.add('hidden');
      const c = state.map.getCenter();
      const coordStr = `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
      $('#search-input').value = coordStr;
      performSearch(coordStr);
    });

    toast('Map initialized — search or click a quick search to begin', 'info');
  }

  // ═══════════════════════════════════════════════════════════════════
  // RECENT SEARCHES AUTOCOMPLETE
  // ═══════════════════════════════════════════════════════════════════
  async function showRecentSearches() {
    const dropdown = $('#recent-searches-dropdown');
    if (!dropdown) return;
    try {
      const recent = await window.campAPI.getRecentSearches();
      if (!recent || !recent.length) { hide(dropdown); return; }

      let html = '<div class="recent-dropdown-header"><i class="fa-solid fa-clock-rotate-left"></i> Recent Searches</div>';
      for (const s of recent) {
        const ago = typeof dayjs !== 'undefined' ? dayjs(s.date).fromNow() : '';
        const label = s.query || `${s.lat.toFixed(2)}, ${s.lon.toFixed(2)}`;
        html += `<div class="recent-dropdown-item" data-query="${label.replace(/"/g, '&quot;')}">
          <i class="fa-solid fa-clock-rotate-left"></i>
          <span class="recent-query">${label}</span>
          <span class="recent-meta">${s.count} spots · ${s.radiusMiles}mi · ${ago}</span>
        </div>`;
      }
      dropdown.innerHTML = html;
      show(dropdown);

      dropdown.querySelectorAll('.recent-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          const q = item.dataset.query;
          $('#search-input').value = q;
          hide(dropdown);
          performSearch(q);
        });
      });
    } catch (e) { hide(dropdown); }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SEARCH PROGRESS TRACKER
  // ═══════════════════════════════════════════════════════════════════
  const SOURCE_META = {
    'RIDB':          { icon: 'fa-database',           label: 'RIDB Recreation Sites' },
    'OpenStreetMap': { icon: 'fa-brands fa-openstreetmap', label: 'OpenStreetMap' },
    'FreeCampsites': { icon: 'fa-campground',         label: 'FreeCampsites.net' },
    'iOverlander':   { icon: 'fa-globe',              label: 'iOverlander' },
    'Built-in DB':   { icon: 'fa-map-pin',            label: 'Curated Database' },
    'Bridges':       { icon: 'fa-bridge',             label: 'Bridge Shelters (FHWA)' },
    'Bathrooms':     { icon: 'fa-restroom',           label: 'Restrooms & Showers' },
    'Resources':     { icon: 'fa-hand-holding-heart', label: 'Survival Resources (OSM)' },
    'USFS':          { icon: 'fa-tree',               label: 'USFS Recreation Sites' },
    'Woods':         { icon: 'fa-tree',               label: 'Woods & Wilderness' },
    'Waterways':     { icon: 'fa-water',              label: 'Rivers & Water Features' },
    'NPS':           { icon: 'fa-mountain-sun',       label: 'National Park Service' },
    'OpenChargeMap': { icon: 'fa-charging-station',   label: 'EV Charging (Van Life)' },
    'WebScraper':    { icon: 'fa-spider',             label: 'Web Scrapers' },
    'Rain Cover':    { icon: 'fa-umbrella',           label: 'Rain Cover & Awnings' },
    'Crime Intel':   { icon: 'fa-skull-crossbones',   label: 'Crime & Sketch Zones' },
  };

  let _sptCleanup = null;

  function initSearchProgressTracker() {
    const container = $('#spt-sources');
    if (!container) return;

    // Build source rows
    const sourceNames = Object.keys(SOURCE_META);
    container.innerHTML = sourceNames.map(name => {
      const m = SOURCE_META[name];
      return `<div class="spt-row" data-source="${name}">
        <span class="spt-icon"><i class="fa-solid ${m.icon}"></i></span>
        <span class="spt-label">${m.label}</span>
        <span class="spt-status spt-pending"><i class="fa-solid fa-ellipsis"></i> Waiting</span>
      </div>`;
    }).join('');

    // Track completed count
    let completed = 0;
    const total = sourceNames.length;

    // Listen for progress events
    if (_sptCleanup) _sptCleanup();
    _sptCleanup = window.campAPI.onSearchProgress(({ name, status, count, elapsed }) => {
      const row = container.querySelector(`[data-source="${name}"]`);
      if (!row) return;
      const statusEl = row.querySelector('.spt-status');
      if (!statusEl) return;

      if (status === 'loading') {
        statusEl.className = 'spt-status spt-loading';
        statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Querying...';
        row.classList.add('spt-active');
      } else if (status === 'done') {
        completed++;
        const sec = (elapsed / 1000).toFixed(1);
        statusEl.className = 'spt-status spt-done';
        statusEl.innerHTML = `<i class="fa-solid fa-check"></i> ${count} found <span class="spt-time">${sec}s</span>`;
        row.classList.remove('spt-active');
        row.classList.add('spt-complete');
        updateSptFooter(completed, total);
        updateSearchBtnProgress(completed, total);
      } else if (status === 'error') {
        completed++;
        statusEl.className = 'spt-status spt-error';
        statusEl.innerHTML = '<i class="fa-solid fa-xmark"></i> Failed';
        row.classList.remove('spt-active');
        row.classList.add('spt-failed');
        updateSptFooter(completed, total);
        updateSearchBtnProgress(completed, total);
      }
    });
  }

  function updateSptFooter(done, total) {
    const footer = $('#spt-footer');
    if (!footer) return;
    const pct = Math.round((done / total) * 100);
    footer.innerHTML = `<div class="spt-progress-wrap">
      <div class="spt-progress-bar"><div class="spt-progress-fill" style="width:${pct}%"></div></div>
      <span>${done} / ${total} sources complete</span>
    </div>`;
    if (done >= total) {
      footer.innerHTML = '<i class="fa-solid fa-check-double"></i> All sources complete — processing results...';
    }
  }

  function updateSearchBtnProgress(done, total) {
    const btn = $('#btn-search');
    if (!btn || !btn.classList.contains('loading')) return;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>${done}/${total} sources</span>`;
    btn.style.setProperty('--search-progress', `${Math.round((done / total) * 100)}%`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════════
  async function performSearch(query) {
    if (!query || query.trim() === '') return;
    query = query.trim();

    const btnSearch = $('#btn-search');
    btnSearch.classList.add('loading');
    const _srcTotal = Object.keys(SOURCE_META).length;
    btnSearch.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>0/${_srcTotal} sources</span>`;
    btnSearch.style.setProperty('--search-progress', '0%');
    setFooterStatus('<i class="fa-solid fa-spinner fa-spin"></i> Searching for "' + query + '"...');

    // Show live search progress in sidebar
    $('#results-list').innerHTML = `
      <div class="search-progress-tracker">
        <div class="spt-header">
          <i class="fa-solid fa-person-shelter spt-hobo-anim"></i>
          <span>Hobo is riding the rails...</span>
        </div>
        <div class="spt-sources" id="spt-sources"></div>
        <div class="spt-footer" id="spt-footer">0 / ${Object.keys(SOURCE_META).length} sources complete</div>
      </div>`;
    hide($('#welcome-card'));
    initSearchProgressTracker();

    // Safety timeout — force-reset if search hangs (e.g., a source never responds)
    const SEARCH_SAFETY_TIMEOUT = 90000;
    state._searchSafetyTimer = setTimeout(() => {
      if (btnSearch.classList.contains('loading')) {
        if (state._partialCleanup) { state._partialCleanup(); state._partialCleanup = null; }
        btnSearch.classList.remove('loading');
        btnSearch.innerHTML = '<i class="fa-solid fa-person-shelter"></i><span>Search</span>';
        btnSearch.style.removeProperty('--search-progress');
        setFooterStatus(`<i class="fa-solid fa-exclamation-triangle"></i> Search timed out — showing ${state.locations.length} spots found`);
        toast('Search timed out — some sources didn\'t respond', 'warning');
        if (state.locations.length > 0) {
          applyFilters(); showSortControls();
        }
      }
    }, SEARCH_SAFETY_TIMEOUT);

    // Clear any leftover modal markers
    cleanupModalMarkers($('#grocery-modal'));
    cleanupModalMarkers($('#bathrooms-modal'));
    cleanupModalMarkers($('#bridges-modal'));
    cleanupModalMarkers($('#resources-modal'));

    // ── Progressive loading: stream results to map as each source completes ──
    state.locations = [];
    resetSearchDerivedState();
    state._partialBounds = null;

    // Clean up previous partial results listener
    if (state._partialCleanup) { state._partialCleanup(); state._partialCleanup = null; }

    state._partialCleanup = window.campAPI.onSearchPartialResults(({ source, locations }) => {
      if (!Array.isArray(locations) || locations.length === 0) return;

      // Tag new locations with IDs and append
      const newLocs = locations.map(enrichLocation);
      state.locations.push(...newLocs);
      rebuildLegendCounts();

      // Debounced map update — batch rapid source completions together
      // instead of re-rendering markers for every single source
      clearTimeout(state._partialMapTimer);
      state._partialMapTimer = setTimeout(() => {
        applyFilters();
      }, 400);

      // Update status footer (lightweight, no debounce needed)
      setFooterStatus(`<i class="fa-solid fa-spinner fa-spin"></i> ${state.locations.length} spots found so far...`);
    });

    // Clean up previous crime heatmap listener
    if (state._crimeHeatCleanup) { state._crimeHeatCleanup(); state._crimeHeatCleanup = null; }

    state._crimeHeatCleanup = window.campAPI.onCrimeHeatmapData((data) => {
      if (data && Array.isArray(data.heatmapPoints)) {
        state.crimeHeatData = data.heatmapPoints;
        updateCrimeHeatLayer();
      }
    });

    try {
      // Geocode
      const geo = await window.campAPI.geocodeAddress(query);
      if (geo.error) throw new Error(geo.error);

      const { lat, lon, display_name } = geo;
      const radiusMiles = parseInt($('#search-radius').value) || 25;

      state.searchCenter = { lat, lon, name: display_name };

      // Set user marker
      if (state.userMarker) state.map.removeLayer(state.userMarker);
      state.userMarker = L.marker([lat, lon], {
        icon: L.divIcon({ className: 'user-marker', iconSize: [20, 20], iconAnchor: [10, 10] }),
        zIndexOffset: 1000,
      }).addTo(state.map).bindPopup(`<b>Search Center</b><br>${display_name}`);

      // Set view to search center immediately (no animation to avoid zoom fighting with incoming results)
      state.map.setView([lat, lon], 11, { animate: false });

      // Search — results stream in via onSearchPartialResults as each source completes
      const t0 = Date.now();
      const result = await window.campAPI.searchLocations({ lat, lon, radiusMiles, query });
      state.queryTime = ((Date.now() - t0) / 1000).toFixed(1);

      // Clean up partial results listener
      if (state._partialCleanup) { state._partialCleanup(); state._partialCleanup = null; }

      if (result.locations) {
        // Final deduped results replace the incrementally built list
        state.locations = result.locations.map(enrichLocation);

        // Merge in custom spots within search radius
        try {
          const customLocs = await window.campAPI.getCustomLocations();
          for (const c of customLocs) {
            if (c.lat && c.lon) {
              const dist = haversine(lat, lon, c.lat, c.lon);
              if (dist <= radiusMiles) {
                state.locations.push(enrichLocation({ ...c, _id: c.id || makeId(c), _source: 'Custom', distanceMiles: Math.round(dist * 10) / 10 }));
              }
            }
          }
        } catch (e) {}

        resetSearchDerivedState();
        rebuildLegendCounts();

        state.lastSearch = { query, lat, lon, radiusMiles, result };

        applyFilters();
        showSortControls();

        // Final fit bounds — single smooth zoom once all data is in
        clearTimeout(state._partialMapTimer);
        if (state.locations.length > 0) {
          const bounds = L.latLngBounds(state.locations.map(l => [l.lat, l.lon]));
          bounds.extend([lat, lon]);
          state.map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 13, duration: 0.6 });
        } else {
          state.map.flyTo([lat, lon], 12, { duration: 0.6 });
        }

        // Fetch weather
        fetchWeather(lat, lon);

        setFooterStatus(`<i class="fa-solid fa-check-circle"></i> Found ${state.locations.length} spots near "${query}" in ${state.queryTime}s`);
        toast(`Found ${state.locations.length} locations near ${query}`, 'info');

        if (result.errors?.length) {
          result.errors.forEach(e => console.warn(`Source error [${e.source}]: ${e.error}`));
          const failedSources = result.errors.map(e => e.source).join(', ');
          toast(`Some sources failed: ${failedSources}`, 'warning');
        }

        // Store source timings for stats
        if (result.sourceTimings) state.sourceTimings = result.sourceTimings;
      }
    } catch (err) {
      // Clean up partial results listener on error
      if (state._partialCleanup) { state._partialCleanup(); state._partialCleanup = null; }
      setFooterStatus(`<i class="fa-solid fa-exclamation-triangle"></i> Error: ${err.message}`);
      toast(err.message, 'error');
      $('#results-list').innerHTML = `<div class="muted-text"><i class="fa-solid fa-triangle-exclamation"></i> ${err.message}</div>`;
    } finally {
      clearTimeout(state._searchSafetyTimer);
      btnSearch.classList.remove('loading');
      btnSearch.innerHTML = '<i class="fa-solid fa-person-shelter"></i><span>Search</span>';
      btnSearch.style.removeProperty('--search-progress');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FILTERS & SORT
  // ═══════════════════════════════════════════════════════════════════
  function applyFilters() {
    let list = [...state.locations];

    if (state.activeFilter === 'favorites') {
      list = list.filter(l => state.favorites.includes(l._id));
    } else if (state.activeFilter === 'free') {
      list = list.filter(l => !l.fee || l.fee === 'Free' || l.fee === 'No' || l.fee === '$0');
    } else if (state.activeFilter === 'cover') {
      // "Rain Cover" is a compound filter: bridges + covered structures + caves + dense canopy + shelters
      list = list.filter(l => {
        const tc = l._typeClass || typeClass(l);
        return tc === 'cover' || tc === 'bridge' || tc === 'shelter';
      });
    } else if (state.activeFilter !== 'all') {
      list = list.filter(l => (l._typeClass || typeClass(l)) === state.activeFilter);
    }

    // Sort
    switch (state.sortBy) {
      case 'distance': list.sort((a, b) => (a.distanceMiles || 999) - (b.distanceMiles || 999)); break;
      case 'stealth': list.sort((a, b) => (b.stealthRating || 0) - (a.stealthRating || 0)); break;
      case 'name': list.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
      case 'type': list.sort((a, b) => (a.type || '').localeCompare(b.type || '')); break;
    }

    // Apply legend type toggles
    if (state.legendDisabled?.size > 0) {
      list = list.filter(l => !state.legendDisabled.has(l._typeClass || typeClass(l)));
    }

    state.filtered = list;
    state.renderedResultsLimit = state.resultsRenderStep;
    renderResults();
    updateMap();
    updateResultsSummary();
    updateLegendCounts();
  }

  /** Update the live counts shown on each legend row */
  function updateLegendCounts() {
    if (state.locations.length === 0) return;
    document.querySelectorAll('.legend-item[data-type]').forEach(el => {
      const tc = el.dataset.type;
      const badge = el.querySelector('.legend-count');
      const count = state.legendCounts[tc] || 0;
      if (badge) badge.textContent = count;
      el.style.display = count > 0 ? '' : 'none';
    });
  }

  function updateResultsSummary() {
    const summary = $('#results-summary');
    if (state.locations.length === 0) { summary.innerHTML = ''; return; }
    const shown = Math.min(state.filtered.length, state.renderedResultsLimit);
    const shownText = state.filtered.length > shown ? ` <span class="muted-text">(showing ${shown})</span>` : '';
    summary.innerHTML = `<strong>${state.filtered.length}</strong> of ${state.locations.length} spots${shownText} <button id="btn-export-results" class="export-inline-btn" title="Export as GPX"><i class="fa-solid fa-file-export"></i></button>`;
    const exportBtn = $('#btn-export-results');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const locs = state.filtered.length ? state.filtered : state.locations;
        const result = await window.campAPI.exportGpx({ locations: locs, filename: 'hobocamp-results.gpx' });
        if (result.success) toast(`Exported ${locs.length} spots to GPX!`, 'success');
        else if (result.error) toast(`Export failed: ${result.error}`, 'error');
      });
    }
  }

  function showSortControls() {
    const sc = $('#sort-controls');
    if (state.locations.length > 0) sc.style.display = 'flex';
  }

  // ═══════════════════════════════════════════════════════════════════
  // RESULTS RENDERING
  // ═══════════════════════════════════════════════════════════════════
  function renderResults() {
    const container = $('#results-list');
    if (state.filtered.length === 0) {
      container.innerHTML = `<div class="muted-text"><i class="fa-solid fa-person-shelter"></i> No matching spots found. Try a different search or filter.</div>`;
      return;
    }

    const visibleResults = state.filtered.slice(0, state.renderedResultsLimit);
    const hasMore = state.filtered.length > visibleResults.length;

    container.innerHTML = visibleResults.map((loc, i) => {
      const tc = loc._typeClass || typeClass(loc);
      const isFav = state.favorites.includes(loc._id);
      const dist = loc.distanceMiles ? distanceText(loc.distanceMiles) : '';
      return `
        <div class="result-card" data-idx="${i}" data-id="${loc._id}">
          <button class="result-fav-btn ${isFav ? 'favorited' : ''}" data-fav-id="${loc._id}" title="Toggle favorite">
            <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
          </button>
          <div class="result-card-header">
            <div class="result-type-icon ${tc}"><i class="fa-solid ${typeIcon(tc)}"></i></div>
            <div style="flex:1;min-width:0;">
              <div class="result-name">${loc.name}</div>
              <div class="result-meta">
                <span class="result-type-label">${loc.type || 'Unknown'}</span>
                <span class="result-source"><i class="fa-solid ${loc.sourceIcon || 'fa-database'}"></i> ${loc.source || ''}</span>
                ${loc.fee ? `<span class="result-fee ${loc.fee !== 'Free' && loc.fee !== 'No' ? 'paid' : ''}">${loc.fee === 'Free' || loc.fee === 'No' ? '<i class="fa-solid fa-hand-holding-heart"></i> Free' : '<i class="fa-solid fa-dollar-sign"></i> ' + loc.fee}</span>` : ''}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              ${dist ? `<div class="result-distance">${dist}</div>` : ''}
              <div class="stealth-rating">${stealthStars(loc.stealthRating)}</div>
            </div>
          </div>
          ${loc.description ? `<div class="result-description">${truncate(loc.description, 100)}</div>` : ''}
          <div class="result-tags">
            ${(loc.amenities || []).slice(0, 4).map(a => `<span class="result-tag"><i class="fa-solid fa-check"></i> ${a}</span>`).join('')}
          </div>
        </div>`;
    }).join('') + (hasMore ? `
      <div class="results-load-more-wrap">
        <button class="detail-btn primary" id="btn-results-load-more" type="button">
          <i class="fa-solid fa-chevron-down"></i> Load ${Math.min(state.resultsRenderStep, state.filtered.length - visibleResults.length)} More
        </button>
      </div>` : '');
  }

  function initTooltips() {
    try { tippy('.header-btn', { theme: 'translucent', placement: 'bottom', delay: [400, 0] }); } catch (e) {}
    try { tippy('.filter-tool-btn', { theme: 'translucent', placement: 'bottom', delay: [400, 0] }); } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAP MARKERS
  // ═══════════════════════════════════════════════════════════════════
  function updateMap() {
    state.markers.clearLayers();

    // Build all markers in a batch array, then add at once for performance
    const batch = [];
    state.filtered.forEach(loc => {
      if (!loc.lat || !loc.lon) return;
      const tc = loc._typeClass || typeClass(loc);
      let marker = state.markerCache.get(loc._id);
      if (!marker) {
        const icon = L.divIcon({
          html: `<div class="custom-marker ${tc}" data-badge="${typeBadge(tc)}"><i class="fa-solid ${typeIcon(tc)}"></i></div>`,
          className: '',
          iconSize: [42, 42],
          iconAnchor: [21, 42],
          popupAnchor: [0, -42],
        });

        marker = L.marker([loc.lat, loc.lon], { icon });
        marker._typeClass = tc;
        const dist = loc.distanceMiles ? `<br><span class="popup-distance">${distanceText(loc.distanceMiles)}</span>` : '';
        marker.bindPopup(`
          <div class="popup-name">${loc.name}</div>
          <div class="popup-type">${loc.type || 'Unknown'} – ${loc.source || ''}</div>
          ${dist}
          <a href="#" class="popup-link">View details →</a>
        `);
        marker.on('click', () => selectLocation(loc));
        marker.on('popupopen', () => {
          const link = marker.getPopup().getElement()?.querySelector('.popup-link');
          if (link) link.addEventListener('click', (e) => { e.preventDefault(); selectLocation(loc); }, { once: true });
        });
        state.markerCache.set(loc._id, marker);
      }
      batch.push(marker);
    });

    // Batch add — much faster than individual addLayer calls
    state.markers.addLayers(batch);

    updateHeatLayer();
    updateForestHeatLayer();
  }

  function updateHeatLayer() {
    if (state.heatLayer) state.map.removeLayer(state.heatLayer);
    if (!state.heatmapOn || state.filtered.length === 0) return;

    const points = state.filtered
      .filter(l => l.lat && l.lon)
      .map(l => [l.lat, l.lon, (l.stealthRating || 3) / 5]);

    state.heatLayer = L.heatLayer(points, {
      radius: 30, blur: 20, maxZoom: 13,
      gradient: { 0.2: '#064e3b', 0.5: '#22c55e', 0.8: '#f59e0b', 1.0: '#ef4444' },
    }).addTo(state.map);
  }

  function updateCrimeHeatLayer() {
    if (state.crimeHeatLayer) state.map.removeLayer(state.crimeHeatLayer);
    state.crimeHeatLayer = null;
    if (!state.crimeHeatmapOn || state.crimeHeatData.length === 0) return;

    state.crimeHeatLayer = L.heatLayer(state.crimeHeatData, {
      radius: 35, blur: 25, maxZoom: 14, minOpacity: 0.35,
      gradient: { 0.2: '#312e81', 0.4: '#6d28d9', 0.6: '#dc2626', 0.8: '#f97316', 1.0: '#fbbf24' },
    }).addTo(state.map);
  }

  function updateForestHeatLayer() {
    if (state.forestHeatLayer) state.map.removeLayer(state.forestHeatLayer);
    state.forestHeatLayer = null;
    if (!state.forestHeatmapOn) return;

    // Gather all forest + woods type locations (from full locations list, not just filtered)
    const points = state.locations
      .filter(l => {
        if (!l.lat || !l.lon) return false;
        const tc = typeClass(l);
        return tc === 'forest' || tc === 'woods';
      })
      .map(l => {
        // Weight by stealth rating — higher stealth = denser canopy cover
        const weight = (l.stealthRating || 3) / 5;
        return [l.lat, l.lon, weight];
      });

    if (points.length === 0) return;

    state.forestHeatLayer = L.heatLayer(points, {
      radius: 40, blur: 30, maxZoom: 14, minOpacity: 0.25,
      gradient: {
        0.1: '#064e3b',   // deep emerald
        0.3: '#065f46',   // dark forest
        0.5: '#047857',   // medium green
        0.7: '#059669',   // green
        0.85: '#10b981',  // emerald
        1.0: '#34d399',   // bright mint
      },
    }).addTo(state.map);
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOCATION DETAIL
  // ═══════════════════════════════════════════════════════════════════
  function selectLocation(loc) {
    state.selectedLocation = loc;
    const panel = $('#detail-panel');
    const isFav = state.favorites.includes(loc._id);

    $('#detail-name').textContent = loc.name;
    $('#detail-type').innerHTML = `<i class="fa-solid ${typeIcon(typeClass(loc))}"></i> ${loc.type || 'Unknown'} – ${loc.source || ''}`;
    const favBtn = $('#btn-favorite-detail');
    favBtn.className = `detail-fav-btn ${isFav ? 'favorited' : ''}`;
    favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;

    const body = $('#detail-body');
    const dist = loc.distanceMiles ? distanceText(loc.distanceMiles) : 'N/A';
    const noteData = state.notes[loc._id];
    body.innerHTML = `
      <div class="detail-section">
        <h3><i class="fa-solid fa-eye-slash"></i> Stealth Rating</h3>
        <div class="stealth-meter">${stealthBars(loc.stealthRating)}<span style="margin-left:8px;font-size:13px;font-weight:700;color:var(--green)">${loc.stealthRating || '?'}/5</span></div>
      </div>

      <div class="detail-section">
        <h3><i class="fa-solid fa-circle-info"></i> Information</h3>
        <div class="detail-info-row"><span class="label"><i class="fa-solid fa-route"></i> Distance</span><span class="value">${dist}</span></div>
        <div class="detail-info-row"><span class="label"><i class="fa-solid fa-map-pin"></i> Coordinates</span><span class="value" style="font-family:var(--font-mono);font-size:11px;">${loc.lat?.toFixed(5)}, ${loc.lon?.toFixed(5)}</span></div>
        ${loc.fee ? `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-dollar-sign"></i> Fee</span><span class="value">${loc.fee}</span></div>` : ''}
        ${loc.elevation ? `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-mountain"></i> Elevation</span><span class="value">${loc.elevation} ft</span></div>` : ''}
        ${loc.source ? `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-database"></i> Source</span><span class="value">${loc.source}</span></div>` : ''}
      </div>

      ${loc.description ? `
      <div class="detail-section">
        <h3><i class="fa-solid fa-align-left"></i> Description</h3>
        <p>${loc.description}</p>
      </div>` : ''}

      ${loc.photos?.length ? `
      <div class="detail-section">
        <h3><i class="fa-solid fa-images"></i> Photos (${loc.photos.length})</h3>
        <div class="detail-photos-grid" id="detail-photos-grid">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>
      </div>` : ''}

      ${loc.shelterScore !== undefined ? `
      <div class="detail-section">
        <h3><i class="fa-solid fa-bridge"></i> Bridge / Shelter Details</h3>
        <div class="detail-info-row"><span class="label"><i class="fa-solid fa-shield-halved"></i> Shelter Score</span><span class="value"><span class="stealth-meter">${stealthBars(Math.round(loc.shelterScore / 20))}</span> ${loc.shelterScore}/100</span></div>
        ${loc.material ? `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-cubes"></i> Material</span><span class="value">${loc.material}</span></div>` : ''}
        ${loc.clearance ? `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-arrows-up-down"></i> Clearance</span><span class="value">${loc.clearance} ft</span></div>` : ''}
        ${loc.deckWidth ? `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-arrows-left-right"></i> Deck Width</span><span class="value">${loc.deckWidth} ft</span></div>` : ''}
        ${loc.underCategory ? `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-tag"></i> Category</span><span class="value">${loc.underCategory}</span></div>` : ''}
        ${loc.yearBuilt ? `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-calendar"></i> Year Built</span><span class="value">${loc.yearBuilt}</span></div>` : ''}
      </div>` : ''}

      ${loc._bathroomData ? `
      <div class="detail-section">
        <h3><i class="fa-solid fa-restroom"></i> Restroom Details</h3>
        ${loc._bathroomData.accessible !== undefined ? `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-wheelchair"></i> Accessible</span><span class="value">${loc._bathroomData.accessible ? 'Yes' : 'No'}</span></div>` : ''}
        ${loc._bathroomData.changing_table !== undefined ? `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-baby"></i> Changing Table</span><span class="value">${loc._bathroomData.changing_table ? 'Yes' : 'No'}</span></div>` : ''}
        ${loc._bathroomData.unisex !== undefined ? `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-restroom"></i> Unisex</span><span class="value">${loc._bathroomData.unisex ? 'Yes' : 'No'}</span></div>` : ''}
        ${loc._bathroomData.hours ? `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-clock"></i> Hours</span><span class="value">${loc._bathroomData.hours}</span></div>` : ''}
        ${loc._bathroomData.directions ? `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-diamond-turn-right"></i> Directions</span><span class="value">${loc._bathroomData.directions}</span></div>` : ''}
      </div>` : ''}

      ${loc.amenities?.length ? `
      <div class="detail-section">
        <h3><i class="fa-solid fa-list-check"></i> Amenities</h3>
        <div class="result-tags">${loc.amenities.map(a => `<span class="result-tag"><i class="fa-solid fa-check"></i> ${a}</span>`).join('')}</div>
      </div>` : ''}

      <div class="detail-section" id="terrain-section">
        <h3><i class="fa-solid fa-mountain-sun"></i> Terrain Analysis</h3>
        <p class="muted-text" id="terrain-loading"><i class="fa-solid fa-spinner fa-spin"></i> Analyzing terrain...</p>
      </div>

      <div class="detail-section">
        <h3><i class="fa-solid fa-link"></i> Actions</h3>
        <div class="detail-actions">
          <button class="detail-btn primary" id="btn-transit-to"><i class="fa-solid fa-route"></i> Transit Directions</button>
          <a class="detail-btn" href="https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lon}" target="_blank"><i class="fa-solid fa-diamond-turn-right"></i> Google Directions</a>
          <a class="detail-btn" href="https://www.google.com/maps/@${loc.lat},${loc.lon},15z" target="_blank"><i class="fa-solid fa-map"></i> Google Maps</a>
          <button class="detail-btn" id="btn-copy-coords"><i class="fa-solid fa-copy"></i> Copy Coords</button>
        </div>
      </div>

      <div class="detail-section">
        <h3><i class="fa-solid fa-note-sticky"></i> Personal Notes</h3>
        <div class="detail-note-area">
          <textarea id="detail-note" placeholder="Add your notes about this spot...">${noteData?.text || ''}</textarea>
          <button id="btn-save-note"><i class="fa-solid fa-floppy-disk"></i> Save Note</button>
        </div>
      </div>
    `;

    show(panel);

    // Load photos for custom locations
    if (loc.photos?.length) {
      loadDetailPhotos(loc.photos);
    }

    // Highlight result card
    $$('.result-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.querySelector(`.result-card[data-id="${loc._id}"]`);
    if (activeCard) {
      activeCard.classList.add('active');
      activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Fly to location
    state.map.flyTo([loc.lat, loc.lon], 14, { animate: true });

    // Save note
    $('#btn-save-note').addEventListener('click', async () => {
      const note = $('#detail-note').value;
      await window.campAPI.saveNote({ locationId: loc._id, note });
      state.notes[loc._id] = { text: note, updated: new Date().toISOString() };
      toast('Note saved!', 'info');
    });

    // Transit directions button
    const transitToBtn = $('#btn-transit-to');
    if (transitToBtn) {
      transitToBtn.addEventListener('click', () => {
        openTransitModal(loc);
      });
    }

    // Copy coordinates with feedback
    const copyBtn = $('#btn-copy-coords');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(`${loc.lat},${loc.lon}`).then(() => {
          toast('Coordinates copied!', 'success');
          copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
          setTimeout(() => { copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Coords'; }, 2000);
        });
      });
    }

    // Terrain analysis
    analyzeTerrain(loc);
  }

  async function analyzeTerrain(loc) {
    try {
      const result = await window.campAPI.analyzeTerrain({ lat: loc.lat, lon: loc.lon });
      const section = $('#terrain-section');
      if (!section || result.error) return;

      let html = `<h3><i class="fa-solid fa-mountain-sun"></i> Terrain Analysis</h3>`;

      if (result.elevation !== undefined) {
        html += `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-mountain"></i> Elevation</span><span class="value">${result.elevation}m (${Math.round(result.elevation * 3.281)}ft) – ${result.elevClass || ''}</span></div>`;
      }

      if (result.landUse) {
        const lu = result.landUse;
        html += `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-tree"></i> Forest Cover</span><span class="value">${lu.coverScore ? Math.round(lu.coverScore * 100) + '%' : 'N/A'}</span></div>`;
        if (lu.nearestWater) html += `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-water"></i> Water Nearby</span><span class="value">Yes</span></div>`;
        if (lu.isUrban) html += `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-city"></i> Urban Area</span><span class="value">Yes – be extra stealthy</span></div>`;
      }

      section.innerHTML = html;
    } catch (e) {
      const section = $('#terrain-section');
      if (section) {
        const loading = $('#terrain-loading');
        if (loading) loading.innerHTML = '<i class="fa-solid fa-exclamation-circle"></i> Terrain data unavailable';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // WEATHER
  // ═══════════════════════════════════════════════════════════════════
  async function fetchWeather(lat, lon) {
    try {
      const w = await window.campAPI.getWeather({ lat, lon });
      if (w.error) return;

      // Map widget
      const widget = $('#weather-widget');
      show(widget);
      $('#weather-temp').textContent = w.current?.temperature != null ? `${Math.round(w.current.temperature)}°F` : '--';
      $('#weather-desc').textContent = w.current?.description || w.forecast?.shortForecast || '';

      let details = '';
      if (w.current) {
        if (w.current.windSpeed != null) details += `<i class="fa-solid fa-wind"></i> Wind: ${w.current.windSpeed} mph  `;
        if (w.current.humidity != null) details += `<i class="fa-solid fa-droplet"></i> Humidity: ${w.current.humidity}%  `;
      }
      if (w.sun?.sunrise) details += `<br><i class="fa-solid fa-sun"></i> Rise: ${formatTime(w.sun.sunrise)} `;
      if (w.sun?.sunset) details += ` Set: ${formatTime(w.sun.sunset)}`;
      $('#weather-details').innerHTML = details;

      // Update moon from weather data
      if (w.moon) {
        $('#moon-emoji').textContent = w.moon.emoji || '🌑';
        $('#moon-name').textContent = w.moon.name || '';
        $('#moon-stealth').textContent = w.moon.stealthRating || '';
      }
    } catch (e) { console.warn('Weather error:', e); }
  }

  function formatTime(iso) {
    try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
    catch { return iso; }
  }

  // Moon phase is set by fetchWeather() from the weather API response

  // ═══════════════════════════════════════════════════════════════════
  // FAVORITES
  // ═══════════════════════════════════════════════════════════════════
  async function toggleFavorite(locId) {
    // Find the current location data to save alongside the favorite
    const loc = state.locations.find(l => l._id === locId);
    const locData = loc ? { name: loc.name, type: loc.type, lat: loc.lat, lon: loc.lon, source: loc.source, description: loc.description, distanceMiles: loc.distanceMiles } : null;
    const result = await window.campAPI.toggleFavorite(locId, locData);
    if (result.favorites) {
      state.favorites = result.favorites;
      renderResults();
      updateMap();

      const wasFav = !state.favorites.includes(locId);
      toast(wasFav ? 'Removed from favorites' : 'Added to favorites!', 'info');

      if (!wasFav) {
        try { confetti({ particleCount: 60, spread: 50, origin: { y: 0.8 }, colors: ['#22c55e', '#10b981', '#06b6d4'] }); } catch (e) {}
      }

      // Update detail panel if open
      if (state.selectedLocation?._id === locId) {
        const favBtn = $('#btn-favorite-detail');
        const isFav = state.favorites.includes(locId);
        favBtn.className = `detail-fav-btn ${isFav ? 'favorited' : ''}`;
        favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
      }
    }
  }

  async function renderFavoritesModal() {
    const container = $('#favorites-content');
    // First get favorites from current search
    let favLocs = state.locations.filter(l => state.favorites.includes(l._id));
    
    // Then merge in any persisted favorites not in current results
    try {
      const savedFavLocations = await window.campAPI.getFavoriteLocations();
      for (const favId of state.favorites) {
        if (!favLocs.find(l => l._id === favId) && savedFavLocations[favId]) {
          const saved = savedFavLocations[favId];
          favLocs.push({ ...saved, _id: favId, _saved: true });
        }
      }
    } catch (e) {}

    if (favLocs.length === 0) {
      container.innerHTML = '<p class="muted-text"><i class="fa-regular fa-heart"></i> No favorites yet. Heart a location to save it here.</p>';
      return;
    }

    container.innerHTML = favLocs.map(loc => {
      const tc = typeClass(loc);
      return `
        <div class="reddit-post" style="cursor:pointer" data-fav-loc-id="${loc._id}">
          <div class="reddit-post-title"><i class="fa-solid ${typeIcon(tc)}" style="color:${markerColor(tc)}"></i> ${loc.name}</div>
          <div class="reddit-post-meta">
            <span><i class="fa-solid fa-map-pin"></i> ${loc.type || 'Unknown'}</span>
            <span><i class="fa-solid fa-database"></i> ${loc.source || ''}</span>
            ${loc.distanceMiles ? `<span><i class="fa-solid fa-route"></i> ${distanceText(loc.distanceMiles)}</span>` : ''}
          </div>
          <div class="reddit-post-body">${truncate(loc.description || 'No description available', 150)}</div>
        </div>`;
    }).join('');

    container.querySelectorAll('[data-fav-loc-id]').forEach(el => {
      el.addEventListener('click', () => {
        const loc = state.locations.find(l => l._id === el.dataset.favLocId) || favLocs.find(l => l._id === el.dataset.favLocId);
        if (loc) {
          hide($('#favorites-modal'));
          if (loc._saved && loc.lat && loc.lon) {
            // Saved favorite not in current search — fly to it
            state.map.flyTo([loc.lat, loc.lon], 14, { animate: true });
            toast(`Flying to ${loc.name}`, 'info');
          } else {
            selectLocation(loc);
          }
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // USER DATA
  // ═══════════════════════════════════════════════════════════════════
  async function loadUserData() {
    try {
      const data = await window.campAPI.getUserData();
      state.userData = data;
      state.favorites = data.favorites || [];
      state.notes = data.notes || {};

      if (data.settings?.theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch (e) { console.warn('Failed to load user data:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════
  // REDDIT
  // ═══════════════════════════════════════════════════════════════════
  async function searchReddit(query) {
    const container = $('#reddit-results');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p class="loading-text"><i class="fa-brands fa-reddit"></i> Searching Reddit...</p></div>';

    try {
      const result = await window.campAPI.searchReddit({ query });
      if (result.error) throw new Error(result.error);

      if (!result.posts?.length) {
        container.innerHTML = '<p class="muted-text"><i class="fa-brands fa-reddit"></i> No relevant posts found. Try different keywords.</p>';
        return;
      }

      container.innerHTML = result.posts.map(post => `
        <div class="reddit-post">
          <div class="reddit-post-title">
            <a href="${post.url}" target="_blank">${post.title}</a>
          </div>
          <div class="reddit-post-meta">
            <span><i class="fa-brands fa-reddit"></i> r/${post.subreddit}</span>
            <span><i class="fa-solid fa-arrow-up"></i> ${post.score || 0}</span>
            <span><i class="fa-solid fa-comment"></i> ${post.numComments || 0}</span>
            <span><i class="fa-solid fa-clock"></i> ${post.created ? dayjs.unix(post.created).fromNow() : ''}</span>
          </div>
          ${post.body ? `<div class="reddit-post-body">${truncate(post.body, 300)}</div>` : ''}
          ${post.campingTips?.length ? `<div class="result-tags" style="margin-top:6px">${post.campingTips.map(t => `<span class="result-tag"><i class="fa-solid fa-lightbulb"></i> ${t}</span>`).join('')}</div>` : ''}
        </div>
      `).join('');

    } catch (e) {
      container.innerHTML = `<div class="muted-text"><i class="fa-solid fa-triangle-exclamation"></i> ${e.message}</div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SETTINGS MODAL
  // ═══════════════════════════════════════════════════════════════════
  async function openSettingsModal() {
    const { apiKeys = {}, settings = {} } = await window.campAPI.getSettings();

    // Populate API key fields
    const keyFields = [
      { id: 'api-key-ridb', key: 'ridb', statusId: 'status-ridb' },
      { id: 'api-key-nps', key: 'nps', statusId: 'status-nps' },
      { id: 'api-key-openchargemap', key: 'openchargemap', statusId: 'status-openchargemap' },
      { id: 'api-key-openuv', key: 'openuv', statusId: 'status-openuv' },
      { id: 'api-key-openweathermap', key: 'openweathermap', statusId: 'status-openweathermap' },
      { id: 'api-key-aqicn', key: 'aqicn', statusId: 'status-aqicn' },
      { id: 'api-key-weatherbit', key: 'weatherbit', statusId: 'status-weatherbit' },
      { id: 'api-key-purpleair', key: 'purpleair', statusId: 'status-purpleair' },
    ];
    for (const f of keyFields) {
      const input = $(`#${f.id}`);
      if (input) input.value = apiKeys[f.key] || '';
      const status = $(`#${f.statusId}`);
      if (status) {
        if (apiKeys[f.key]) {
          status.textContent = 'Configured';
          status.className = 'api-status configured';
        } else {
          status.textContent = 'Not set';
          status.className = 'api-status not-configured';
        }
      }
    }

    // Populate source toggles
    const toggleContainer = $('#source-toggles');
    if (toggleContainer) {
      const disabledSources = settings.disabledSources || [];
      toggleContainer.innerHTML = Object.entries(SOURCE_META).map(([name, meta]) => {
        const checked = !disabledSources.includes(name) ? 'checked' : '';
        return `<label class="source-toggle">
          <input type="checkbox" data-source="${name}" ${checked}>
          <i class="fa-solid ${meta.icon}"></i>
          <span class="source-label">${meta.label}</span>
        </label>`;
      }).join('');
    }

    // Populate search preferences
    const radiusSel = $('#setting-default-radius');
    if (radiusSel && settings.defaultRadius) radiusSel.value = settings.defaultRadius;
    const maxSel = $('#setting-max-results');
    if (maxSel && settings.maxResults) maxSel.value = settings.maxResults;

    show($('#settings-modal'));
  }

  async function saveSettingsFromModal() {
    const apiKeys = {};
    const keyFields = [
      { id: 'api-key-ridb', key: 'ridb' },
      { id: 'api-key-nps', key: 'nps' },
      { id: 'api-key-openchargemap', key: 'openchargemap' },
      { id: 'api-key-openuv', key: 'openuv' },
      { id: 'api-key-openweathermap', key: 'openweathermap' },
      { id: 'api-key-aqicn', key: 'aqicn' },
      { id: 'api-key-weatherbit', key: 'weatherbit' },
      { id: 'api-key-purpleair', key: 'purpleair' },
    ];
    for (const f of keyFields) {
      const val = $(`#${f.id}`)?.value?.trim();
      if (val) apiKeys[f.key] = val;
    }

    // Collect disabled sources
    const disabledSources = [];
    const toggles = document.querySelectorAll('#source-toggles input[type="checkbox"]');
    toggles.forEach(t => {
      if (!t.checked) disabledSources.push(t.dataset.source);
    });

    const settings = {
      disabledSources,
      defaultRadius: parseInt($('#setting-default-radius')?.value) || 25,
      maxResults: parseInt($('#setting-max-results')?.value) || 50,
    };

    await window.campAPI.saveSettings({ apiKeys, settings });
    toast('Settings saved!', 'success');
    hide($('#settings-modal'));

    // Update search radius dropdown if default changed
    const radiusSelect = $('#search-radius');
    if (radiusSelect && settings.defaultRadius) {
      radiusSelect.value = settings.defaultRadius;
    }
  }

  async function resetSettings() {
    const keyFields = ['api-key-ridb', 'api-key-nps', 'api-key-openchargemap', 'api-key-openuv', 'api-key-openweathermap', 'api-key-aqicn', 'api-key-weatherbit', 'api-key-purpleair'];
    keyFields.forEach(id => { const el = $(`#${id}`); if (el) el.value = ''; });
    const toggles = document.querySelectorAll('#source-toggles input[type="checkbox"]');
    toggles.forEach(t => { t.checked = true; });
    $('#setting-default-radius').value = '25';
    $('#setting-max-results').value = '50';
    toast('Settings reset to defaults', 'info');
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════════
  function updateStats() {
    const locs = state.locations;
    $('#stat-total').textContent = locs.length;
    $('#stat-dispersed').textContent = locs.filter(l => typeClass(l) === 'dispersed').length;
    $('#stat-free').textContent = locs.filter(l => !l.fee || l.fee === 'Free' || l.fee === 'No' || l.fee === '$0').length;
    $('#stat-stealth').textContent = locs.filter(l => (l.stealthRating || 0) >= 4).length;
    $('#stat-time').textContent = state.queryTime + 's';
    $('#stat-favs').textContent = state.favorites.length;

    // Source timings breakdown
    const timingsEl = $('#stat-source-timings');
    if (timingsEl && state.sourceTimings) {
      const entries = Object.entries(state.sourceTimings).sort((a, b) => b[1] - a[1]);
      if (entries.length) {
        const maxMs = Math.max(...entries.map(e => e[1]), 1);
        timingsEl.innerHTML = entries.map(([name, ms]) => {
          const pct = Math.min(100, (ms / maxMs) * 100);
          const cls = ms < 1000 ? 'fast' : ms < 3000 ? 'medium' : 'slow';
          return `<div class="timing-row"><span class="timing-name">${name}</span><span class="timing-bar ${cls}" style="width:${pct}%"></span><span class="timing-ms">${(ms / 1000).toFixed(1)}s</span></div>`;
        }).join('');
      }
    }

    renderCharts();
  }

  function renderCharts() {
    // Type distribution
    const typeCounts = {};
    state.locations.forEach(l => {
      const tc = typeClass(l);
      typeCounts[tc] = (typeCounts[tc] || 0) + 1;
    });

    const typeLabels = Object.keys(typeCounts);
    const typeData = Object.values(typeCounts);
    const typeColors = typeLabels.map(t => markerColor(t));

    if (state.charts.types) state.charts.types.destroy();
    try {
      state.charts.types = new Chart($('#stats-chart'), {
        type: 'doughnut',
        data: { labels: typeLabels.map(capitalize), datasets: [{ data: typeData, backgroundColor: typeColors, borderWidth: 0 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Outfit', size: 11 } } }, title: { display: true, text: 'By Type', color: '#e2e8f0', font: { family: 'Outfit', size: 13 } } } },
      });
    } catch (e) {}

    // Source distribution
    const srcCounts = {};
    state.locations.forEach(l => { const s = l.source || 'Unknown'; srcCounts[s] = (srcCounts[s] || 0) + 1; });
    const srcLabels = Object.keys(srcCounts);
    const srcData = Object.values(srcCounts);
    const srcColors = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#06b6d4', '#ef4444', '#64748b', '#ec4899'];

    if (state.charts.sources) state.charts.sources.destroy();
    try {
      state.charts.sources = new Chart($('#sources-chart'), {
        type: 'bar',
        data: { labels: srcLabels, datasets: [{ label: 'Locations', data: srcData, backgroundColor: srcColors.slice(0, srcLabels.length), borderWidth: 0, borderRadius: 6 }] },
        options: { responsive: true, scales: { x: { ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 10 } }, grid: { display: false } }, y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(34,197,94,0.06)' } } }, plugins: { legend: { display: false }, title: { display: true, text: 'By Source', color: '#e2e8f0', font: { family: 'Outfit', size: 13 } } } },
      });
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════════
  // SURVIVAL GUIDE
  // ═══════════════════════════════════════════════════════════════════
  const guideContent = {
    stealth: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-eye-slash"></i> Stealth Camping Fundamentals</h3>
        <p>Stealth camping means setting up camp in locations where camping isn't explicitly allowed, while remaining undetected. The goal: arrive late, leave early, leave no trace.</p>
        <ul>
          <li><strong>Arrive after dark</strong> (after 9 PM in summer, after 6 PM in winter)</li>
          <li><strong>Leave at first light</strong> — pack up by sunrise</li>
          <li><strong>No fire, no lights</strong> — use red-filtered headlamp only</li>
          <li><strong>Dark-colored gear</strong> — green, brown, black tents & tarps</li>
          <li><strong>Scout by day, camp by night</strong> — always preview your spot first</li>
          <li><strong>Single-night stays only</strong> — never camp the same spot twice in a row</li>
          <li><strong>Pack out everything</strong> — leave no trace whatsoever</li>
          <li><strong>Keep low profile</strong> — no music, quiet conversations only</li>
          <li><strong>Have an exit strategy</strong> — know alternate routes out</li>
          <li><strong>Check moon phase</strong> — new moon = darkest nights = best stealth</li>
        </ul>
      </div>`,
    wallis: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-tent"></i> Steve Wallis-Inspired Tips</h3>
        <p>Canadian stealth camping legend Steve Wallis pioneered many techniques for comfortable stealth camping.</p>
        <ul>
          <li><strong>"Nice and cozy"</strong> — Comfort matters. Good sleeping pad = good sleep = good stealth</li>
          <li><strong>The Backyard Test</strong> — If your setup looks natural from 50 feet away, you're golden</li>
          <li><strong>Urban Invisibility</strong> — Act like you belong. Confidence is the best camouflage</li>
          <li><strong>Industrial Areas</strong> — Empty lots near industrial zones are often overlooked</li>
          <li><strong>The "Hobo Stove"</strong> — Small, contained cooking. No big fires, no smoke</li>
          <li><strong>Tree Line Strategy</strong> — Just inside the tree line is the sweet spot</li>
          <li><strong>Weather Window</strong> — Rain = fewer people out = better stealth conditions</li>
          <li><strong>The Wave & Smile</strong> — If spotted, friendly greeting defuses suspicion</li>
          <li><strong>Car Camping Stealth</strong> — Dark window covers, arrive late, don't idle engine</li>
          <li><strong>Adventure mindset</strong> — Every spot is a story. Keep it fun, keep it safe</li>
        </ul>
      </div>`,
    rules: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-gavel"></i> Camping Rules by Land Type</h3>
        <ul>
          <li><strong>National Forest (USFS)</strong> — Dispersed camping generally allowed. 14-day limit. 100ft from water. Free.</li>
          <li><strong>BLM Land</strong> — Dispersed camping allowed. 14-day limit. Check fire restrictions.</li>
          <li><strong>DNR Land (WA)</strong> — Some areas allow dispersed camping. Check specific unit rules.</li>
          <li><strong>National Parks</strong> — Backcountry permits required. No dispersed camping without permit.</li>
          <li><strong>State Parks (WA)</strong> — Camping only in designated sites. Reservations needed.</li>
          <li><strong>City/County Parks</strong> — Camping usually prohibited. High risk of enforcement.</li>
          <li><strong>Private Land</strong> — Trespassing. Need owner permission.</li>
          <li><strong>Walmart/Rest Stops</strong> — Overnight parking varies by location. Ask first.</li>
        </ul>
        <p><strong>Washington State Specifics:</strong> Mt. Baker-Snoqualmie NF and Olympic NF have extensive dispersed camping corridor along forest roads. The Mountain Loop Highway near Granite Falls/Darrington is a classic dispersed corridor.</p>
      </div>`,
    gear: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-backpack"></i> Stealth Camping Gear Checklist</h3>
        <ul>
          <li><strong>Shelter:</strong> Dark-colored bivy, tarp, or small tent (no bright colors)</li>
          <li><strong>Sleep System:</strong> 20°F-rated bag + insulated pad (WA gets cold)</li>
          <li><strong>Light:</strong> Red-filtered headlamp (preserves night vision, less visible)</li>
          <li><strong>Water:</strong> Filter (Sawyer/LifeStraw) + 2L capacity minimum</li>
          <li><strong>Food:</strong> No-cook options or small backpacking stove. Bear canister in bear country</li>
          <li><strong>Navigation:</strong> Physical map + compass. Don't rely only on phone GPS</li>
          <li><strong>Layers:</strong> Rain shell (WA = rain), insulation, moisture-wicking base</li>
          <li><strong>First Aid:</strong> Basic kit + emergency blanket + whistle</li>
          <li><strong>Tools:</strong> Multi-tool, paracord 50ft, trash bags (pack out waste)</li>
          <li><strong>Communication:</strong> Charged phone + portable battery. Consider PLB for remote areas</li>
          <li><strong>Stealth Extras:</strong> Dark stuff sacks, camo netting, dark tarp for ground cover</li>
        </ul>
      </div>`,
    safety: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-shield-heart"></i> Safety & Ethics</h3>
        <ul>
          <li><strong>Tell someone</strong> your plans — location, expected return time</li>
          <li><strong>Wildlife awareness</strong> — Bear country (Cascades): hang food 200ft from camp, 10ft high</li>
          <li><strong>River safety</strong> — WA rivers rise fast with rain. Don't camp in flood zones</li>
          <li><strong>Hypothermia</strong> — #1 risk in PNW. Wet + wind + cold = danger even in summer</li>
          <li><strong>Fire safety</strong> — Check burn ban status. WA has frequent summer fire bans</li>
          <li><strong>Leave No Trace</strong> — Pack out all trash, bury human waste 6-8" deep 200ft from water</li>
          <li><strong>Respect nature</strong> — Don't cut live trees, don't disturb wildlife</li>
          <li><strong>Legal awareness</strong> — Know the land type. If asked to leave, leave politely</li>
          <li><strong>Trust your gut</strong> — If a spot feels wrong, move on. Safety first</li>
          <li><strong>Emergency numbers</strong> — 911, WA State Patrol: (360) 596-4000</li>
        </ul>
      </div>
      <div class="guide-section">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> Danger Zone Awareness</h3>
        <ul>
          <li><strong>Flood zones</strong> — Avoid riverbanks, dry creek beds, and low-lying areas during rain. WA flash floods are real.</li>
          <li><strong>Landslide areas</strong> — Steep hillsides after heavy rain are deadly. Oso landslide (2014) killed 43 people.</li>
          <li><strong>Lahar zones</strong> — Near Mt. Rainier, Mt. Baker, Mt. St. Helens: volcanic mudflow danger. Know lahar evacuation routes.</li>
          <li><strong>Tsunami zones</strong> — Coastal camping: heed tsunami warning signs. Move to 100ft+ elevation immediately.</li>
          <li><strong>Railroad right-of-way</strong> — Bridge camping near tracks is extremely dangerous. Trains are silent until close.</li>
          <li><strong>Private land</strong> — Trespassing is a misdemeanor in WA. Look for "No Trespassing" signs, fences, crops.</li>
          <li><strong>Highway underpasses</strong> — carbon monoxide buildup, drainage flooding, and WSDOT patrols. Use as last resort.</li>
          <li><strong>Abandoned structures</strong> — Structural collapse, asbestos, mold, squatters with territorial behavior.</li>
        </ul>
      </div>
      <div class="guide-section">
        <h3><i class="fa-solid fa-droplet"></i> Water Safety</h3>
        <ul>
          <li><strong>Always filter/treat</strong> — Even clear mountain streams can have Giardia, E. coli, Crypto.</li>
          <li><strong>Best methods</strong> — Sawyer Squeeze, LifeStraw, boiling 1+ minutes, or SteriPEN UV.</li>
          <li><strong>Avoid</strong> — Water downstream of farms, mines, or roads. Stagnant water. Runoff during rain.</li>
          <li><strong>Municipal sources</strong> — Use the Resources panel to find public drinking water fountains (pre-treated).</li>
          <li><strong>Library trick</strong> — Most WA libraries have drinking fountains, restrooms, and free WiFi.</li>
        </ul>
      </div>
      <div class="guide-section">
        <h3><i class="fa-solid fa-temperature-low"></i> WA-Specific Weather Dangers</h3>
        <ul>
          <li><strong>Atmospheric rivers</strong> — Heavy rain events that can last days. Have waterproof gear.</li>
          <li><strong>Convergence zone</strong> — Puget Sound Convergence Zone dumps surprise heavy rain on north King/south Snohomish Co.</li>
          <li><strong>Wind storms</strong> — PNW gets major windstorms in fall/winter. Widowmakers (dead tree limbs) are real.</li>
          <li><strong>Summer heat</strong> — Eastern WA and low elevations can hit 100°F+. Carry extra water.</li>
          <li><strong>Mountain weather</strong> — Can change in minutes above 3000ft. Always carry rain gear in the Cascades.</li>
        </ul>
      </div>`,
    sources: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-database"></i> Data Sources</h3>
        <p>HoboCamp aggregates data from 16 sources to build the most complete picture:</p>
        <ul>
          <li><strong>RIDB / Recreation.gov</strong> — Federal recreation database. Official campgrounds, trailheads.</li>
          <li><strong>OpenStreetMap (Overpass)</strong> — Community-mapped camping, shelters, caves, pavilions, water sources.</li>
          <li><strong>FreeCampsites.net</strong> — User-submitted free camping spots.</li>
          <li><strong>iOverlander</strong> — Overlander community spots (car camping, wild camping).</li>
          <li><strong>NBI / FHWA Bridges</strong> — National Bridge Inventory data for underpass shelter locations.</li>
          <li><strong>Refuge Restrooms + OSM</strong> — Public restrooms, showers, and drinking water nearby.</li>
          <li><strong>Survival Resources (OSM)</strong> — Libraries, public showers, laundromats, community centers, drinking water, food banks, free WiFi hotspots.</li>
          <li><strong>Reddit</strong> — r/StealthCamping, r/WashingtonHiking, r/urbancarliving intel.</li>
          <li><strong>NWS Weather API</strong> — Real-time weather, forecasts, alerts from NOAA.</li>
          <li><strong>Open-Meteo</strong> — Elevation data, terrain analysis, current conditions.</li>
          <li><strong>Curated Database</strong> — 100+ hand-curated WA locations, including Arlington, Granite Falls, Snohomish, Seattle, Darrington, and more.</li>
          <li><strong>Rain Cover</strong> — OSM covered walkways, canopies, arcades, carports, porches + 45 curated WA cover spots.</li>
        </ul>
      </div>`,
    fire: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-fire"></i> Fire Starting — Methods</h3>
        <p class="guide-warn"><i class="fa-solid fa-triangle-exclamation"></i> <strong>WA State burn bans are common May–October.</strong> Always check <a href="https://burnpermits.dnr.wa.gov" target="_blank">DNR burn permits</a> before making any fire. Stealth fires = stealth busted. Use only when survival-critical.</p>

        <div class="guide-card">
          <h4><i class="fa-solid fa-1"></i> Ferro Rod (Best carry option)</h4>
          <ol>
            <li>Prepare a <strong>tinder bundle</strong> — dry grass, birch bark, dryer lint, cotton balls w/ vaseline, or fatwood shavings</li>
            <li>Hold the rod <strong>close to the tinder</strong> (1–2 inches away)</li>
            <li>Press the spine/striker against the rod at 45° angle</li>
            <li><strong>Push the rod back</strong> (not the striker forward) — this keeps sparks on target</li>
            <li>Sparks land on tinder → gently blow at the base</li>
            <li>Add <strong>pencil-thin sticks</strong> once flame catches, then thumb-thick, then wrist-thick</li>
          </ol>
          <p class="guide-tip"><i class="fa-solid fa-lightbulb"></i> Scrape the black coating off a new ferro rod first. Vaseline cotton balls are the #1 reliable tinder — waterproof and burn 3+ minutes.</p>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-2"></i> Lighter / Matches (Easiest)</h4>
          <ol>
            <li>Carry a <strong>BIC lighter</strong> (reliable, cheap, works wet if you dry it)</li>
            <li>Keep in a <strong>Ziploc bag</strong> — WA rain will kill matches and soak butane valves</li>
            <li>Stormproof matches > regular matches — light in wind and rain</li>
            <li>Light tinder bundle first, then build up fuel</li>
          </ol>
          <p class="guide-tip"><i class="fa-solid fa-lightbulb"></i> Carry 2 fire sources minimum. A dead lighter in the rain could be a survival emergency.</p>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-3"></i> Bow Drill (Primitive / Emergency)</h4>
          <ol>
            <li><strong>Fireboard</strong> — flat piece of dry, soft wood (cedar, willow, cottonwood). Carve a small notch</li>
            <li><strong>Spindle</strong> — straight, dry stick ~¾" diameter, 12–18" long. Round one end, point the other</li>
            <li><strong>Bow</strong> — curved stick ~arm length, with paracord/shoelace tied end to end (slight slack)</li>
            <li><strong>Socket</strong> — hardwood or rock with a depression to press on top of spindle</li>
            <li>Wrap cord once around spindle, place round end in fireboard notch</li>
            <li>Press socket on top, saw bow back and forth — <strong>fast, steady strokes</strong></li>
            <li>Black dust collects in notch → eventually glows → transfer ember to tinder bundle</li>
          </ol>
          <p class="guide-tip"><i class="fa-solid fa-lightbulb"></i> This is HARD. Practice at home first. In WA rain, finding dry wood is the real challenge — check inside standing dead trees, underside of logs.</p>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-4"></i> Battery + Steel Wool (Urban hack)</h4>
          <ol>
            <li>Touch a <strong>9V battery</strong> terminals to fine <strong>#0000 steel wool</strong></li>
            <li>Steel wool ignites instantly — place in tinder bundle</li>
            <li>Also works with 2 AA batteries taped in series + gum wrapper (foil bridge)</li>
          </ol>
        </div>
      </div>

      <div class="guide-section">
        <h3><i class="fa-solid fa-campground"></i> Fire Lay Types</h3>
        <div class="guide-card">
          <h4>Teepee Fire</h4>
          <p>Lean sticks together in a cone shape over tinder. Burns hot and fast. Good for getting warm quickly. Bad in wind.</p>
        </div>
        <div class="guide-card">
          <h4>Log Cabin Fire</h4>
          <p>Stack fuel in alternating layers like Lincoln logs with tinder in center. Burns evenly, good for cooking. Steady, long burn.</p>
        </div>
        <div class="guide-card">
          <h4>Dakota Fire Hole (Stealth!)</h4>
          <p>Dig two holes 12" deep, 8" apart, connected by a tunnel at the bottom. Fire goes in one hole, air feeds from the other. <strong>Almost invisible at night</strong> — flame is below ground. Minimal smoke. Best stealth fire method.</p>
        </div>
        <div class="guide-card">
          <h4>Swedish Torch / Log Candle</h4>
          <p>Split a short log into quarters, stand them back up with tinder in center gaps. Self-feeding, good platform for cooking pot. One-log fire.</p>
        </div>
        <div class="guide-card">
          <h4>Hobo Stove (Can Stove)</h4>
          <p>Cut air holes in bottom of a large can (#10 size). Feed small sticks through a side door. Concentrated heat, works as pot stand. <strong>Classic hobo tech — portable, leaves no fire ring.</strong></p>
        </div>
      </div>

      <div class="guide-section">
        <h3><i class="fa-solid fa-tree"></i> Finding Dry Fuel in WA Rain</h3>
        <ul>
          <li><strong>Standing dead wood</strong> — Snap branches off dead-but-standing trees. They stay drier than ground wood</li>
          <li><strong>Underside of logs</strong> — Flip large logs and harvest dry bark/wood from underneath</li>
          <li><strong>Fatwood</strong> — Resinous heartwood of dead conifers (pine, Douglas fir). Looks amber, smells piney. <strong>Burns even when wet</strong></li>
          <li><strong>Birch bark</strong> — Paper birch bark has oils that ignite readily even damp. Peel from dead trees only</li>
          <li><strong>Inner bark</strong> — Shred inner bark of cedar into a fibrous tinder nest</li>
          <li><strong>Thick bark shelters</strong> — Big Douglas fir bark slabs make good rain shields for a fire underneath</li>
          <li><strong>Bring your own</strong> — Carry cotton balls+vaseline, dryer lint in Ziploc, or commercial tinder tabs</li>
        </ul>
      </div>`,
    knots: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-link"></i> Essential Knots for Hobo Life</h3>
        <p>Learn these 10 knots and you can build shelter, hang food, secure gear, make repairs, and save your ass in emergencies. Practice until you can tie them in the dark.</p>

        <div class="guide-card">
          <h4>1. Bowline — "The King of Knots"</h4>
          <p><strong>Use:</strong> Creates a fixed loop that won't slip or bind under load. Rescue loop, hanging bear bag, tie to anchor point.</p>
          <ol>
            <li>Make a small loop in the standing part (the "rabbit hole")</li>
            <li>Pass the free end up through the hole (rabbit comes out)</li>
            <li>Go around behind the standing part (around the tree)</li>
            <li>Back down through the same hole (back in the hole)</li>
            <li>Pull tight — the loop is now fixed size</li>
          </ol>
          <p class="guide-tip"><i class="fa-solid fa-lightbulb"></i> Memory trick: "The rabbit comes out of the hole, goes around the tree, and back down the hole."</p>
        </div>

        <div class="guide-card">
          <h4>2. Taut-Line Hitch — Adjustable Tension</h4>
          <p><strong>Use:</strong> Guy lines for tarps and tents. Adjustable — slides to tighten, holds under load.</p>
          <ol>
            <li>Wrap the free end around the anchor (tree/stake) and back toward standing part</li>
            <li>Make 2 wraps inside the loop going toward the anchor</li>
            <li>Make 1 more wrap outside (above) those 2 wraps</li>
            <li>Pull tight — slide the knot to adjust tension</li>
          </ol>
        </div>

        <div class="guide-card">
          <h4>3. Clove Hitch — Quick Attach</h4>
          <p><strong>Use:</strong> Fast tie to a pole, tree, or post. Starting knot for lashings. Easy to adjust.</p>
          <ol>
            <li>Wrap rope around post</li>
            <li>Cross over the first wrap to make an X</li>
            <li>Tuck free end under the X cross</li>
            <li>Pull both ends tight</li>
          </ol>
          <p class="guide-warn"><i class="fa-solid fa-triangle-exclamation"></i> Can slip on smooth poles — add a half hitch for security.</p>
        </div>

        <div class="guide-card">
          <h4>4. Trucker's Hitch — Mechanical Advantage</h4>
          <p><strong>Use:</strong> Tensioning ridgelines, tying down loads, clothesline. Gives 3:1 pulling power.</p>
          <ol>
            <li>Tie one end to anchor A</li>
            <li>Make a slip loop (bight) midway in the rope</li>
            <li>Pass free end around anchor B and back through the loop</li>
            <li>Pull down hard — the loop acts as a pulley — then secure with 2 half hitches</li>
          </ol>
          <p class="guide-tip"><i class="fa-solid fa-lightbulb"></i> This is THE knot for tight tarp ridgelines. Master this one early.</p>
        </div>

        <div class="guide-card">
          <h4>5. Figure-8 on a Bight — Secure Loop</h4>
          <p><strong>Use:</strong> Bombproof loop in the middle of a rope. Clip carabiners to it. Rescue, climbing, hanging heavy loads.</p>
          <ol>
            <li>Double the rope to form a bight (loop)</li>
            <li>Tie a figure-8 with the doubled rope — over, under, and through</li>
            <li>Dress the knot (make it neat) and pull both strands tight</li>
          </ol>
        </div>

        <div class="guide-card">
          <h4>6. Sheet Bend — Join Two Ropes</h4>
          <p><strong>Use:</strong> Tying two different ropes together, even different diameters. Extending cordage.</p>
          <ol>
            <li>Make a bight (J-shape) in the thicker rope</li>
            <li>Pass the thinner rope up through the bight from behind</li>
            <li>Wrap around both tails of the bight</li>
            <li>Tuck the end under itself (between itself and the bight)</li>
          </ol>
        </div>

        <div class="guide-card">
          <h4>7. Prusik Knot — Grip a Rope</h4>
          <p><strong>Use:</strong> Slide along a rope but lock under weight. Climbing, adjustable tarp attachment, bear bag retrieval.</p>
          <ol>
            <li>Make a loop of thinner cord (accessory cord)</li>
            <li>Wrap the loop around the thicker rope 3 times, threading through itself</li>
            <li>Pull tight — slides when pushed, grips when loaded</li>
          </ol>
        </div>

        <div class="guide-card">
          <h4>8. Two Half Hitches — General Tie-Off</h4>
          <p><strong>Use:</strong> Securing rope to a post, tree, or ring. Simple, reliable, easy to untie.</p>
          <ol>
            <li>Pass rope around anchor</li>
            <li>Make a half hitch (loop around standing part, tuck under)</li>
            <li>Repeat one more time in the same direction</li>
            <li>Pull snug</li>
          </ol>
        </div>

        <div class="guide-card">
          <h4>9. Timber Hitch — Dragging Logs</h4>
          <p><strong>Use:</strong> Hauling logs, starting a diagonal lashing, dragging heavy gear. Grips tighter under load.</p>
          <ol>
            <li>Pass rope around the log/object</li>
            <li>Wrap the free end around itself 3–4 times (twist it into itself)</li>
            <li>Pull — it cinches down and holds. Release tension to remove</li>
          </ol>
        </div>

        <div class="guide-card">
          <h4>10. Constrictor Knot — Permanent Bind</h4>
          <p><strong>Use:</strong> Clamping bags shut, binding bundle of sticks, emergency hose clamp. Very hard to untie — meant to be cut off.</p>
          <ol>
            <li>Like a clove hitch, but tuck the end under BOTH wraps instead of just the cross</li>
            <li>Pull both ends hard — bites into whatever it's wrapped around</li>
          </ol>
        </div>
      </div>

      <div class="guide-section">
        <h3><i class="fa-solid fa-rope"></i> Cordage Tips</h3>
        <ul>
          <li><strong>550 Paracord</strong> — Carry 50–100ft minimum. 550lb test. Inner strands can be pulled out for thread/fishing line</li>
          <li><strong>Bank line</strong> — Tarred nylon twine. Cheap, strong, rot-resistant, ties great knots. #36 is ideal</li>
          <li><strong>Natural cordage</strong> — Emergency: twist inner bark of cedar, dogbane, or stinging nettle fibers into rope</li>
          <li><strong>Burn rope ends</strong> — Melt synthetic rope ends with a lighter to prevent fraying</li>
          <li><strong>Wet rope stretches</strong> — In WA rain, taut-line hitch lets you re-tension after wet stretch</li>
        </ul>
      </div>`,
    firstaid: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-kit-medical"></i> First Aid — Wound Care</h3>
        <p class="guide-warn"><i class="fa-solid fa-triangle-exclamation"></i> This is basic field first aid, not medical advice. For serious injuries call 911. WA has good helicopter medevac coverage in the Cascades.</p>

        <div class="guide-card">
          <h4><i class="fa-solid fa-bandage"></i> Cuts & Lacerations</h4>
          <ol>
            <li><strong>Stop bleeding</strong> — Direct pressure with clean cloth/bandana. Press HARD for 10+ minutes for deep cuts</li>
            <li><strong>Elevate</strong> — Raise wound above heart level if possible</li>
            <li><strong>Clean</strong> — Flush with clean water (drinking water or saline). Remove debris with tweezers</li>
            <li><strong>Close</strong> — Butterfly strips or steri-strips for gaping wounds (pull edges together, don't overlap)</li>
            <li><strong>Cover</strong> — Apply antibiotic ointment, then gauze pad secured with medical tape or wrap</li>
            <li><strong>Monitor</strong> — Watch for infection: increasing redness, warmth, swelling, red streaks, pus, fever</li>
          </ol>
          <p class="guide-tip"><i class="fa-solid fa-lightbulb"></i> Super glue (cyanoacrylate) works as an emergency wound closure for small cuts. The medical version is literally the same chemistry.</p>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-droplet"></i> Severe Bleeding</h4>
          <ol>
            <li><strong>Direct pressure</strong> — Pack the wound with gauze/cloth, press hard with both hands</li>
            <li><strong>Don't remove the first pad</strong> — If blood soaks through, add more on top</li>
            <li><strong>Tourniquet</strong> — For life-threatening limb bleeding ONLY: place 2–3" above wound, tighten until bleeding stops, <strong>note the time</strong></li>
            <li><strong>Improvised TQ</strong> — Belt, torn shirt strip + stick as a windlass. Must be at least 1.5" wide</li>
            <li><strong>Call 911</strong> — Arterial bleeding (bright red, spurting) = immediate emergency</li>
          </ol>
          <p class="guide-warn"><i class="fa-solid fa-triangle-exclamation"></i> A properly applied tourniquet is safe for 2+ hours. Don't loosen it once applied — that's a hospital job.</p>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-bone"></i> Sprains & Fractures</h4>
          <p><strong>RICE Protocol:</strong></p>
          <ul>
            <li><strong>R</strong>est — Stop using the injured area</li>
            <li><strong>I</strong>ce — Cold water/snow in a bag wrapped in cloth. 20 min on, 20 min off</li>
            <li><strong>C</strong>ompression — Wrap with ACE bandage or torn shirt. Snug, not cutting circulation</li>
            <li><strong>E</strong>levation — Keep above heart level to reduce swelling</li>
          </ul>
          <p><strong>Suspected fracture:</strong> Splint it. Use sticks/trekking poles padded with clothing. Immobilize the joint above AND below the break. Don't try to straighten it.</p>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-fire-flame-curved"></i> Burns</h4>
          <ol>
            <li><strong>Cool immediately</strong> — Run cool (not ice cold) water over burn for 10–20 minutes</li>
            <li><strong>Don't pop blisters</strong> — They're sterile protection. Cover with loose gauze</li>
            <li><strong>No butter/toothpaste</strong> — Old wives' tales that trap heat and cause infection</li>
            <li><strong>Cover loosely</strong> — Non-stick gauze or cling wrap. Change daily</li>
            <li><strong>Pain relief</strong> — Ibuprofen reduces pain AND inflammation</li>
          </ol>
          <p class="guide-warn"><i class="fa-solid fa-triangle-exclamation"></i> Burns larger than your palm, on face/hands/groin, or that look white/charred = ER immediately.</p>
        </div>
      </div>

      <div class="guide-section">
        <h3><i class="fa-solid fa-temperature-low"></i> Environmental Injuries</h3>

        <div class="guide-card">
          <h4><i class="fa-solid fa-snowflake"></i> Hypothermia (PNW #1 Killer)</h4>
          <p><strong>Stages:</strong></p>
          <ul>
            <li><strong>Mild</strong> — Shivering, cold hands/feet, fumbling. <em>Can still self-rescue</em></li>
            <li><strong>Moderate</strong> — Violent shivering, confusion, slurred speech, stumbling. <em>Need help NOW</em></li>
            <li><strong>Severe</strong> — Shivering stops, rigid muscles, semiconscious. <em>911 emergency</em></li>
          </ul>
          <p><strong>Treatment:</strong></p>
          <ol>
            <li>Get out of wind and rain</li>
            <li>Remove wet clothes, replace with dry (or nothing + sleeping bag)</li>
            <li>Warm the <strong>core first</strong> — hot water bottles to armpits + groin + neck</li>
            <li>Warm sweet drinks if conscious. NO alcohol</li>
            <li>Skin-to-skin in a sleeping bag (yes, really — it works)</li>
            <li><strong>Handle gently</strong> — Rough movement can cause cardiac arrest in severe hypothermia</li>
          </ol>
          <p class="guide-tip"><i class="fa-solid fa-lightbulb"></i> In WA, hypothermia kills more people than any other outdoor hazard. 50°F + rain + wind = deadly. Cotton kills — wear synthetics or wool.</p>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-sun"></i> Heat Exhaustion / Heat Stroke</h4>
          <p><strong>Heat exhaustion:</strong> Heavy sweating, weakness, nausea, headache, dizziness. Skin cool and clammy.</p>
          <ul>
            <li>Move to shade, lie down, sip water with electrolytes, cool with wet cloths</li>
          </ul>
          <p><strong>Heat stroke (EMERGENCY):</strong> Hot dry skin, confusion, temp > 104°F, possible seizures.</p>
          <ul>
            <li>Call 911. Immerse in cold water or pack ice on neck, armpits, groin. This can kill fast.</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-spider"></i> Bites & Stings (WA Specifics)</h4>
          <ul>
            <li><strong>Black widow</strong> — Found in Eastern WA woodpiles, outhouses. Red hourglass. Painful cramps. Seek ER</li>
            <li><strong>Hobo spider</strong> — Common in WA. Painless bite → slow-healing wound. Clean and monitor</li>
            <li><strong>Yellow jackets</strong> — Ground nests everywhere in WA. Multiple stings = possible anaphylaxis</li>
            <li><strong>Ticks</strong> — Eastern WA + San Juan Islands. Grasp head with tweezers, pull straight out. Save tick for ID</li>
            <li><strong>No venomous snakes west of Cascades.</strong> Eastern WA has rattlesnakes — listen for rattle, back away slowly</li>
          </ul>
          <p class="guide-warn"><i class="fa-solid fa-triangle-exclamation"></i> Carry Benadryl (diphenhydramine) and know signs of anaphylaxis: throat swelling, difficulty breathing, widespread hives. Use EpiPen if available, call 911.</p>
        </div>
      </div>

      <div class="guide-section">
        <h3><i class="fa-solid fa-suitcase-medical"></i> Hobo First Aid Kit (Minimum)</h3>
        <ul>
          <li>Gauze pads (4x4) × 6 + rolled gauze</li>
          <li>Medical tape + butterfly closures (steri-strips)</li>
          <li>ACE bandage (compression + splint wrap)</li>
          <li>Antiseptic wipes + triple antibiotic ointment</li>
          <li>Ibuprofen 200mg + Benadryl 25mg</li>
          <li>Tweezers + safety pins + small scissors</li>
          <li>Moleskin (blisters — your feet are your transport)</li>
          <li>SAM splint (moldable aluminum splint, weighs nothing)</li>
          <li>Nitrile gloves × 2 pairs</li>
          <li>Emergency mylar blanket (hypothermia + signaling)</li>
          <li>Oral rehydration salts (diarrhea = dehydration = death spiral)</li>
        </ul>
        <p class="guide-tip"><i class="fa-solid fa-lightbulb"></i> Duct tape wrapped around a pencil = compact wound closure, blister prevention, and gear repair. Multi-use MVP.</p>
      </div>`,
    sheltercraft: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-tarp"></i> Tarp Shelters — Configurations</h3>
        <p>A 8×10 or 10×10 tarp is the most versatile shelter piece a hobo can carry. Lighter than a tent, infinite setups.</p>

        <div class="guide-card">
          <h4>A-Frame (All-around best)</h4>
          <p>Tie ridgeline between two trees at chest height. Drape tarp over ridgeline. Stake out both sides at 45°. Fast, sheds rain well, protects from wind on both sides.</p>
          <p class="guide-tip"><i class="fa-solid fa-lightbulb"></i> Use a <strong>trucker's hitch</strong> for a tight ridgeline. Pitch steeper in heavy rain for faster runoff.</p>
        </div>

        <div class="guide-card">
          <h4>Lean-To (Quick & simple)</h4>
          <p>Tie ridgeline high. Stake tarp down on one side only, angled to ground. Open on one side — face opening away from wind. Good for fire reflection.</p>
        </div>

        <div class="guide-card">
          <h4>C-Fly / Stealth Low Profile</h4>
          <p>Like A-frame but ridgeline only 2–3 feet high. Creates very low, almost invisible shelter. Hard to spot from a distance. Best for stealth camps.</p>
        </div>

        <div class="guide-card">
          <h4>Plough Point</h4>
          <p>One corner tied to tree at waist height. Opposite corner staked to ground. Two side corners staked out wide. Creates a wedge shape that sheds wind and rain. Good for one person.</p>
        </div>

        <div class="guide-card">
          <h4>Hammock + Tarp</h4>
          <p>String tarp as A-frame over your hammock ridgeline. Extend tarp 12"+ past hammock each end. Best way to sleep off wet ground in the PNW.</p>
        </div>
      </div>

      <div class="guide-section">
        <h3><i class="fa-solid fa-igloo"></i> Natural Shelters</h3>
        <ul>
          <li><strong>Debris hut</strong> — Ridgepole from ground to waist-high support. Lean sticks on sides. Pile leaves/debris 2–3ft thick over skeleton. Tiny entrance. Very warm, very labor-intensive</li>
          <li><strong>Fallen tree shelter</strong> — A large blowdown creates a natural wall. Lean branches against it, cover with debris or tarp</li>
          <li><strong>Rock overhang</strong> — Natural cave/overhang. Check for critter signs. Block wind with debris wall. WA has many in the Cascades</li>
          <li><strong>Snow cave</strong> — In deep snow: dig into a bank, tunnel up (warm air rises). Poke ventilation hole. Can be 32°F inside when -20°F outside. Emergency only — takes 2+ hours</li>
          <li><strong>Evergreen canopy</strong> — Big spruce/fir trees have naturally dry areas at their base. The lowest branches form a roof. Enhance with tarp</li>
        </ul>
      </div>

      <div class="guide-section">
        <h3><i class="fa-solid fa-bed"></i> Sleep System — Stay Warm on the Ground</h3>
        <ul>
          <li><strong>Insulate from ground</strong> — You lose more heat downward than upward. Sleeping pad R-value of 3+ for WA (R5+ for winter)</li>
          <li><strong>Improvised pad</strong> — Pile dry leaves/pine needles 6" thick. Cardboard is excellent insulation (R ~3-4 per layer)</li>
          <li><strong>Vapor barrier</strong> — Trash bag between you and bag liner prevents sweat from saturating insulation in multi-day cold</li>
          <li><strong>Hot water bottle</strong> — Fill Nalgene with hot water, put in sleeping bag 10 min before bed. Sleep next to it</li>
          <li><strong>Wear hat to bed</strong> — Seriously, you lose significant heat through your head</li>
          <li><strong>Eat fat before sleep</strong> — Your body generates heat digesting calorie-dense food overnight</li>
        </ul>
      </div>`,
    water_food: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-droplet"></i> Water — Finding & Purifying</h3>

        <div class="guide-card">
          <h4><i class="fa-solid fa-filter"></i> Purification Methods (ranked)</h4>
          <ol>
            <li><strong>Sawyer Squeeze / Mini</strong> — Best value. Filters 100K gallons. Weighs 3oz. Removes bacteria & protozoa. Does NOT remove viruses (rarely an issue in US)</li>
            <li><strong>Boiling</strong> — Rolling boil for 1 minute (3 min above 6,500ft). Kills everything. Needs fuel + time</li>
            <li><strong>SteriPEN / UV</strong> — 90 seconds, kills everything including viruses. Needs batteries. Doesn't work in murky water</li>
            <li><strong>Chemical (Aquamira/tablets)</strong> — Lightweight backup. 30-minute wait time. Taste is rough but it works</li>
            <li><strong>LifeStraw</strong> — Drink directly from source. Good emergency tool, awkward for filling containers</li>
          </ol>
          <p class="guide-warn"><i class="fa-solid fa-triangle-exclamation"></i> NEVER drink untreated water. Even crystal-clear mountain streams can have Giardia, Crypto, and E. coli. WA streams draining from pasture land are high-risk.</p>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-magnifying-glass"></i> Finding Water in WA</h4>
          <ul>
            <li><strong>Downhill</strong> — Water flows down. Follow drainages, gullies, animal trails heading downhill</li>
            <li><strong>Green vegetation</strong> — Lush green = water nearby, especially cottonwoods, willows, cattails</li>
            <li><strong>Listen</strong> — At dawn/dusk, you can hear streams from surprisingly far away</li>
            <li><strong>Rain collection</strong> — WA gets 37" avg/yr. Tarp → funnel → container. You'll rarely lack rain here</li>
            <li><strong>Morning dew</strong> — Drag an absorbent cloth through grass at dawn, wring into container. Slow but works</li>
            <li><strong>Urban: Libraries, parks, gas stations</strong> — Public sources marked in HoboCamp's Resources layer</li>
          </ul>
        </div>
      </div>

      <div class="guide-section">
        <h3><i class="fa-solid fa-utensils"></i> Food — Foraging & No-Cook Meals</h3>

        <div class="guide-card">
          <h4><i class="fa-solid fa-leaf"></i> WA Edible Wild Plants (SAFE — learn to positively identify)</h4>
          <ul>
            <li><strong>Blackberries (Himalayan)</strong> — Everywhere in WA lowlands, Jul–Sep. Invasive, so eat guilt-free. Loaded with calories and vitamin C</li>
            <li><strong>Salal berries</strong> — Dark purple, mild flavor. Common in WA forests. Edible raw, year-round where they grow</li>
            <li><strong>Huckleberries</strong> — Mountain areas, Aug–Sep. WA's best wild berry. Worth the hike</li>
            <li><strong>Dandelion</strong> — Entire plant edible: leaves raw/cooked (bitter but nutritious), roots roast for coffee substitute</li>
            <li><strong>Clover</strong> — Flowers and young leaves edible raw. Found in every lawn and field</li>
            <li><strong>Cattail</strong> — The "supermarket of the swamp." Roots (starch), young shoots (raw), pollen heads (flour). Found in WA wetlands</li>
            <li><strong>Stinging nettle</strong> — Cook or dry to remove sting. Extremely nutritious greens. Common in WA forests</li>
            <li><strong>Sword fern fiddleheads</strong> — Young curled fronds in spring. Cook first. Common in PNW forests</li>
          </ul>
          <p class="guide-warn"><i class="fa-solid fa-triangle-exclamation"></i> <strong>Never eat anything you can't 100% identify.</strong> WA has deadly lookalikes: death camas (looks like wild onion), water hemlock (looks like wild carrot), destroying angel mushroom (looks like puffball when young). When in doubt, go hungry.</p>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-box-open"></i> No-Cook Hobo Meals</h4>
          <ul>
            <li><strong>Instant oatmeal + cold water</strong> — Actually works. Not hot, but fills you up. Add sugar/raisin packets</li>
            <li><strong>Peanut butter + tortillas</strong> — High calorie (190cal/2tbsp), doesn't need refrigeration, lightweight</li>
            <li><strong>Tuna/chicken packets</strong> — Foil pouches, no can opener needed. 26g protein each</li>
            <li><strong>Trail mix / GORP</strong> — Good Old Raisins and Peanuts. Calorie-dense, lightweight, no prep</li>
            <li><strong>Ramen bricks dry</strong> — In a pinch, eat ramen like crackers. Flavor packet = instant seasoning salt for anything</li>
            <li><strong>Sardines / kippers</strong> — Cheap protein, omega-3s, shelf-stable. Pull tab = no tools needed</li>
            <li><strong>Hard cheese + summer sausage</strong> — Last days unrefrigerated. Dense calories and flavor</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-fire"></i> Hobo Stove Cooking</h4>
          <ul>
            <li><strong>Hobo can stove</strong> — #10 can with fuel door holes. Burns sticks. Free fuel everywhere</li>
            <li><strong>Alcohol stove</strong> — Penny stove from 2 soda cans. Burns denatured alcohol/HEET. Silent, no smoke</li>
            <li><strong>Esbit tabs</strong> — Solid fuel tablets. Ultralight, no spill. Each tab boils 2 cups water</li>
            <li><strong>JetBoil / pocket rocket</strong> — Fast, efficient, runs on isobutane canisters. Not stealth (hiss sound)</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-hand-holding-heart"></i> Free Food Resources</h4>
          <ul>
            <li><strong>Food banks</strong> — WA has extensive food bank network. Search in HoboCamp Resources layer</li>
            <li><strong>Sikh Gurdwaras</strong> — Free meals (langar) for anyone, no questions. Several in WA</li>
            <li><strong>Dumpster diving</strong> — Legal in WA unless posted "No Trespassing." Grocery stores discard good food nightly</li>
            <li><strong>Day-old bread</strong> — Bakeries often give away or sell cheap. Ask near closing time</li>
            <li><strong>211 hotline</strong> — Dial 211 for local food/shelter resources in WA</li>
          </ul>
        </div>
      </div>`,
    urban: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-city"></i> Urban Stealth Survival</h3>
        <p>Surviving in WA cities — Seattle, Tacoma, Everett, Spokane — has its own rules. The key: <strong>blend in, be invisible, stay mobile.</strong></p>

        <div class="guide-card">
          <h4><i class="fa-solid fa-moon"></i> Urban Sleep Spots (Ranked by stealth)</h4>
          <ol>
            <li><strong>24-hour businesses</strong> — Denny's, some McDonald's, hospital waiting rooms. Buy something small, rest in a corner</li>
            <li><strong>Airport terminals</strong> — Sea-Tac has sleeping travelers. Blend right in with a backpack</li>
            <li><strong>Parking garages (upper levels)</strong> — Quiet after business hours. Covered, dry, usually warm. Leave before 6 AM</li>
            <li><strong>Church doorways</strong> — Many have deep recessed entries. Often no cameras. Community tolerance is higher</li>
            <li><strong>University buildings</strong> — UW, WSU, WWU campuses have covered walkways, hidden study areas, 24hr buildings</li>
            <li><strong>Behind commercial buildings</strong> — Loading docks with overhangs. Empty 9 PM–5 AM. Watch for security patrols</li>
            <li><strong>Under highway overpasses</strong> — Last resort. Noisy, dirty, but dry. WA overpasses often have fenced areas</li>
          </ol>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-suitcase"></i> Urban Gear Strategy</h4>
          <ul>
            <li><strong>Don't look homeless</strong> — Clean clothes, normal backpack (not camo), no cardboard. Looking "normal" = not being hassled</li>
            <li><strong>Bivy over tent</strong> — In cities, a tent screams "homeless camp." A dark bivy under a bush is invisible</li>
            <li><strong>Earbud trick</strong> — Wear earbuds while resting. People assume you're just chilling listening to music</li>
            <li><strong>Laptop/tablet prop</strong> — In a coffee shop or library, being on a device = invisible worker/student</li>
            <li><strong>Day locker</strong> — Some transit stations and gyms have day lockers. Stash non-essential gear</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-bolt"></i> Charging & Connectivity</h4>
          <ul>
            <li><strong>Libraries</strong> — Free WiFi, outlet charging, restrooms, water. WA library system is excellent. No card needed for day use</li>
            <li><strong>Coffee shops</strong> — Buy a $2 coffee, charge for hours. Starbucks has free WiFi everywhere in WA</li>
            <li><strong>Outdoor outlets</strong> — Building exteriors, park structures, transit stations. Often live 24/7</li>
            <li><strong>Solar charger</strong> — 21W panel charges phone in 3–4 hours of direct sun. Even WA cloudy days give some charge</li>
            <li><strong>Power bank</strong> — 20,000mAh = ~5 full phone charges. $15–25. Essential carry</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-bus"></i> WA Urban Transit (Getting Around Cheap)</h4>
          <ul>
            <li><strong>ORCA LIFT card</strong> — Low-income reduced fare for all WA transit. $1.50/ride. Apply at Community Transit offices</li>
            <li><strong>Free ride areas</strong> — Some routes have free zones. Check agency maps</li>
            <li><strong>Sounder train</strong> — Connects Seattle↔Tacoma↔Everett. Covered platforms at every station</li>
            <li><strong>Link Light Rail</strong> — SeaTac to Lynnwood. Good covered stations. Relatively warm</li>
            <li><strong>Community shuttles</strong> — Many WA counties have free/low-cost dial-a-ride services</li>
          </ul>
        </div>
      </div>

      <div class="guide-section">
        <h3><i class="fa-solid fa-handshake"></i> Interacting with People</h3>
        <ul>
          <li><strong>Police encounters</strong> — Be calm, polite, cooperative. "I'm just passing through" works in most WA jurisdictions. Know your rights but don't escalate</li>
          <li><strong>Security guards</strong> — Usually just want you to move along. Say "no problem" and relocate. Don't argue</li>
          <li><strong>Neighbors/residents</strong> — Smile and wave. Be brief. "Just enjoying the trail/park." Confidence is camouflage</li>
          <li><strong>Other unhoused people</strong> — Be respectful of established camps. Don't set up right next to someone without asking. Share intel on good spots</li>
          <li><strong>Martin v. Boise ruling</strong> — Cities can't criminalize sleeping in public if no shelter beds available. Know this, don't cite it aggressively</li>
        </ul>
      </div>`,
    hygiene: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-soap"></i> Staying Clean on the Road</h3>
        <p>Hygiene isn't luxury — it prevents skin infections, foot rot, and disease. Plus, being clean helps you blend into society and access resources.</p>

        <div class="guide-card">
          <h4><i class="fa-solid fa-shower"></i> Shower Access</h4>
          <ul>
            <li><strong>Planet Fitness</strong> — $10/month "Black Card" = unlimited showers at any location. Multiple in WA. Best deal going</li>
            <li><strong>Community centers</strong> — Many WA cities have day-use shower at community rec centers. $2–5</li>
            <li><strong>Truck stops</strong> — Flying J, Pilot. Around $15/shower. Clean, private, sometimes free with fuel purchase</li>
            <li><strong>Public pools</strong> — Pay swim admission ($3–8), use showers. Indoor pools year-round in WA</li>
            <li><strong>Campground showers</strong> — Some USFS/state park showers are accessible without camping fee</li>
            <li><strong>Solar shower bag</strong> — 5-gallon bag, leave in sun 3 hours. Hang from tree. Works even in WA summer</li>
            <li><strong>Search "Bathrooms"</strong> — HoboCamp's Bathrooms & Showers source finds all nearby options</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-hand-sparkles"></i> No-Shower Cleaning</h4>
          <ul>
            <li><strong>Baby wipes</strong> — The #1 hobo hygiene tool. Full body "wipe bath" — hit pits, groin, feet, face</li>
            <li><strong>Cornstarch</strong> — Natural dry shampoo. Sprinkle on oily hair, brush out. Also prevents chafing</li>
            <li><strong>Baking soda</strong> — Deodorant (pat under arms), toothpaste, foot odor killer. Multi-use champion</li>
            <li><strong>Bandana bath</strong> — Wet bandana with a drop of camp soap. Wipe down. Rinse bandana, repeat</li>
            <li><strong>Hand sanitizer</strong> — Deodorant in a pinch (kills bacteria that cause odor). Don't use on broken skin</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-socks"></i> Foot Care (Critical!)</h4>
          <ul>
            <li><strong>Dry socks daily</strong> — Carry 2+ pairs of WOOL socks (not cotton). Rotate daily. Hang wet pair on pack to dry</li>
            <li><strong>Air feet out</strong> — Every rest stop, take shoes off, air dry feet. Wiggle toes. Check for hot spots</li>
            <li><strong>Moleskin for hot spots</strong> — Apply BEFORE blisters form. Once you feel friction, stop and treat</li>
            <li><strong>Foot powder</strong> — Gold Bond or cornstarch in socks and shoes. Prevents trench foot in WA rain</li>
            <li><strong>Trench foot</strong> — Numb, pale, swollen feet from staying wet. EMERGENCY — warm and dry feet, elevate, seek medical care. Can cause permanent damage</li>
          </ul>
          <p class="guide-warn"><i class="fa-solid fa-triangle-exclamation"></i> Your feet are your transportation. A hobo with bad feet is stranded. Foot care is not optional.</p>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-tooth"></i> Dental & General Health</h4>
          <ul>
            <li><strong>Brush teeth daily</strong> — Carry a travel toothbrush. Infections from bad teeth can become life-threatening</li>
            <li><strong>Clove oil</strong> — Natural tooth pain relief. A few drops on cotton ball applied to cavity/sore tooth</li>
            <li><strong>Free dental clinics</strong> — WA has free/low-cost dental through community health centers. Dial 211</li>
            <li><strong>Laundry</strong> — Laundromats: ~$3-5/load. Or hand-wash in a dry bag with camp soap, hang dry on paracord line</li>
          </ul>
        </div>
      </div>`,
    navigation: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-compass"></i> Navigation Without GPS</h3>
        <p>Your phone dies, GPS fails, or you're in a canyon with no signal. Know these methods and you won't be lost.</p>

        <div class="guide-card">
          <h4><i class="fa-solid fa-compass"></i> Compass Basics</h4>
          <ul>
            <li><strong>Red arrow = magnetic north.</strong> Rotate bezel until N aligns with red arrow. Now you have bearings</li>
            <li><strong>WA magnetic declination</strong> — ~15° East. True north is 15° left of where your compass needle points. This matters for map work</li>
            <li><strong>Taking a bearing</strong> — Point direction-of-travel arrow at target, rotate bezel until red needle sits in red outline ("red in the shed"), read bearing number at index line</li>
            <li><strong>Following a bearing</strong> — Set desired bearing, rotate whole body until needle is in the shed, walk the direction the travel arrow points</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-sun"></i> Natural Navigation</h4>
          <ul>
            <li><strong>Sun rises East, sets West</strong> — In WA mid-latitudes, sun is due south at noon (solar noon, not clock noon)</li>
            <li><strong>Watch method</strong> — Point hour hand at sun. South is halfway between hour hand and 12 o'clock</li>
            <li><strong>Shadow stick</strong> — Plant a stick. Mark tip of shadow. Wait 15 min. Mark new tip. Line between marks runs roughly East-West (first mark = West)</li>
            <li><strong>North Star (Polaris)</strong> — Find Big Dipper, extend the "pointer stars" (front edge) 5× the distance between them. That's Polaris = true north</li>
            <li><strong>Moss myth</strong> — Moss does NOT reliably grow on the north side of trees. It grows on the WET side, which in WA can be any direction</li>
            <li><strong>Prevailing wind</strong> — WA west side: wind usually from SW/W. Tree lean and flag-shaped trees indicate prevailing wind direction</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-map"></i> Reading Terrain</h4>
          <ul>
            <li><strong>Contour lines close together</strong> = steep. Far apart = flat. V-shapes pointing uphill = valleys/drainages</li>
            <li><strong>Follow water downhill</strong> — Streams lead to rivers, rivers lead to civilization</li>
            <li><strong>Ridgeline travel</strong> — Stay on ridges for better visibility, cell signal, and drier ground. Harder walking but harder to get lost</li>
            <li><strong>Handrails</strong> — Use linear features (roads, rivers, ridges, power lines) as guides. Aim for them as backstops in case you overshoot your target</li>
            <li><strong>Aiming off</strong> — Intentionally aim to one side of your target. When you hit the handrail, you know which way to turn</li>
          </ul>
        </div>
      </div>

      <div class="guide-section">
        <h3><i class="fa-solid fa-satellite-dish"></i> Phone Navigation Tips</h3>
        <ul>
          <li><strong>Download offline maps</strong> — Google Maps, Gaia GPS, or AllTrails let you download WA topo maps for offline use. DO THIS before going out</li>
          <li><strong>Airplane mode + GPS</strong> — GPS works WITHOUT cell service. Turn on airplane mode to save battery, leave GPS on</li>
          <li><strong>Screenshot maps</strong> — Quick backup: screenshot your route before heading out</li>
          <li><strong>Battery conservation</strong> — Dark mode, low brightness, airplane mode, close background apps. A full phone lasts 3+ days this way</li>
          <li><strong>Mark waypoints</strong> — Drop a pin at your camp, water source, car, and road access. Future you will be grateful</li>
        </ul>
      </div>`,
    weather_survival: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-cloud-bolt"></i> Weather Survival — WA Specifics</h3>

        <div class="guide-card">
          <h4><i class="fa-solid fa-cloud-rain"></i> Rain (Your Constant Companion)</h4>
          <p>WA west of Cascades gets 37–90 inches of rain annually. Rain is not if, it's when.</p>
          <ul>
            <li><strong>Layer system</strong> — Waterproof shell over insulating layer over moisture-wicking base. NEVER cotton ("cotton kills")</li>
            <li><strong>Re-waterproof gear</strong> — DWR (durable water repellent) wears off. Re-apply Nikwax/Grangers every few months</li>
            <li><strong>Manage moisture</strong> — Open pit zips when hiking (vent sweat), close when stopped. Wet insulation = zero warmth</li>
            <li><strong>Dry bag essentials</strong> — Sleeping bag, spare clothes, first aid, fire kit in dry bags even INSIDE your pack</li>
            <li><strong>Wring out before bed</strong> — Wring rain out of everything before getting in sleeping bag. Bring nothing wet inside</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-bolt"></i> Lightning</h4>
          <ul>
            <li><strong>30/30 rule</strong> — Flash-to-bang less than 30 seconds = danger. Stay sheltered 30 min after last thunder</li>
            <li><strong>Avoid</strong> — Ridges, open fields, tall isolated trees, water, metal (fences, poles)</li>
            <li><strong>Lightning crouch</strong> — If caught in the open: crouch low on balls of feet, ears covered, minimize ground contact. Don't lie flat</li>
            <li><strong>WA risk</strong> — Eastern WA and Cascades get summer thunderstorms. West side is relatively low risk</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-wind"></i> Windstorms</h4>
          <ul>
            <li><strong>WA gets major windstorms</strong> — November–March especially. 50–80mph gusts happen yearly</li>
            <li><strong>Widowmakers</strong> — Dead limbs/trees that fall in wind. <strong>Never camp under dead limbs.</strong> Look UP when choosing a site</li>
            <li><strong>Tent stakes</strong> — Use all of them. Add rocks on top. Wind can shred an unstaked tarp instantly</li>
            <li><strong>Wind chill</strong> — 40°F + 30mph wind = feels like 28°F. Wind steals heat exponentially. Get behind windbreaks</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-snowflake"></i> Snow & Cold (Oct–Apr in Cascades)</h4>
          <ul>
            <li><strong>Cascade passes</strong> — Snoqualmie, Stevens, White Pass can get snow Oct–May. Carry traction devices above 2,500ft in winter</li>
            <li><strong>Insulate from snow</strong> — Snow = wet ground. Extra sleeping pad layers or evergreen bough platform under tent</li>
            <li><strong>Snow as water</strong> — Melt snow for drinking (don't eat snow directly — costs body heat). Pack snow loosely or it burns to the pan</li>
            <li><strong>Day length</strong> — WA winter: sunset ~4:15 PM, sunrise ~7:45 AM. That's 15+ hours of darkness. Plan accordingly</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-cloud-fog"></i> Reading the Sky</h4>
          <ul>
            <li><strong>Cirrus (wispy high clouds)</strong> — Weather change coming in 24–48 hours. Start planning shelter</li>
            <li><strong>Cumulonimbus (tall, anvil-shaped)</strong> — Thunderstorm imminent. Seek shelter NOW</li>
            <li><strong>Wall of gray from the SW</strong> — Classic WA atmospheric river approaching. Hours of heavy rain coming</li>
            <li><strong>Red sky at morning</strong> — Actually works in WA: morning red = moisture moving in from the west. Rain likely</li>
            <li><strong>Rapid pressure drop</strong> — If your ears pop or altimeter watch shows dropping pressure, storm approaching</li>
          </ul>
        </div>
      </div>`,
    tools_repair: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-screwdriver-wrench"></i> Essential Tools & Field Repair</h3>

        <div class="guide-card">
          <h4><i class="fa-solid fa-knife"></i> The Multi-Tool (Most Important Tool)</h4>
          <ul>
            <li><strong>Leatherman or Victorinox</strong> — Pliers, knife, saw, can opener, screwdrivers, file all in one. Carry it always</li>
            <li><strong>Knife sharpening</strong> — Bottom of a ceramic mug works as an emergency sharpener. Or carry a small puck stone ($5)</li>
            <li><strong>Locking blade</strong> — Folding knife must lock open for safe cutting. Non-locking = dangerous for batoning or prying</li>
            <li><strong>WA knife law</strong> — Fixed blades legal to carry openly. Concealed fixed blade varies by city. Folding knives generally OK</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-tape"></i> Repair Kit (The "Oh Shit" Kit)</h4>
          <ul>
            <li><strong>Duct tape</strong> — Wrap 10ft around a pencil/water bottle. Fixes torn tarp, broken poles, blisters, splits, everything</li>
            <li><strong>Tenacious Tape</strong> — Gear-specific repair tape. Better than duct tape for jackets, sleeping pads, tents</li>
            <li><strong>Needle + thread</strong> — Upholstery needle (curved helps) + dental floss (stronger than thread). Fix rips in pack, clothes, tent</li>
            <li><strong>Safety pins × 6</strong> — Instant zipper fix, tarp grommets, first aid sling, hang drying clothes</li>
            <li><strong>Zip ties × 10</strong> — Structural repairs, lashing, emergency buckle replacement. Assorted sizes</li>
            <li><strong>1/16" shock cord (4ft)</strong> — Replace broken tent pole elastic, drawstring replacement, lashing</li>
            <li><strong>Aquaseal</strong> — Shoe sole separation repair. Works on boots, rain gear, dry bags. Cures overnight</li>
            <li><strong>Sleeping pad patch kit</strong> — Most come with one. Carry it separately in a known location</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-hammer"></i> Improvised Tools</h4>
          <ul>
            <li><strong>Rock hammer</strong> — Fist-sized flat rock for pounding tent stakes, cracking nuts, hammer tasks. Free, everywhere</li>
            <li><strong>Digging stick</strong> — Sharpen the end of a sturdy stick. Dig cat holes, fire pits, edible roots. Caveman tech that works</li>
            <li><strong>Needle from safety pin</strong> — Straighten safety pin for sewing, splinter removal, fish hook</li>
            <li><strong>Wire from bra/notebook</strong> — Emergency snare wire, lashing, hanging line. Surprisingly useful</li>
            <li><strong>Aluminum can</strong> — Cut and flatten for: stove, shim, signal mirror, cutting edge, pot scraper</li>
            <li><strong>Plastic bag</strong> — Water carrier, rain cover, pillow (stuffed with clothes), transpiration water collector (tie around leafy branch)</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-shoe-prints"></i> Boot / Shoe Repair</h4>
          <ul>
            <li><strong>Sole separation</strong> — Aquaseal + clamp (or tight wrap with cord) overnight. Duct tape as temporary fix</li>
            <li><strong>Lace breaks</strong> — Paracord cut to length works perfectly as replacement laces</li>
            <li><strong>Wet boots</strong> — Stuff with crumpled newspaper/dry leaves overnight. Remove insoles to dry separately. Never dry boots by fire (cracks leather/melts synthetics)</li>
            <li><strong>Waterproofing</strong> — Beeswax-based waterproofer for leather. Silicone spray for synthetics. Or garbage bags inside boots in emergency</li>
          </ul>
        </div>
      </div>`,
    signals: `
      <div class="guide-section">
        <h3><i class="fa-solid fa-tower-broadcast"></i> Emergency Signals & Communication</h3>

        <div class="guide-card">
          <h4><i class="fa-solid fa-phone"></i> Emergency Contacts — WA</h4>
          <ul>
            <li><strong>911</strong> — Works even without cell plan (any GSM phone). Give GPS coordinates if possible</li>
            <li><strong>WA State Patrol</strong> — (360) 596-4000</li>
            <li><strong>Poison Control</strong> — 1-800-222-1222 (plants, snake bites, chemicals)</li>
            <li><strong>211</strong> — Social services, shelter, food, mental health resources</li>
            <li><strong>Crisis Text Line</strong> — Text HOME to 741741 (24/7 mental health support)</li>
            <li><strong>SAR (Search & Rescue)</strong> — Call 911 and request SAR. WA has excellent volunteer SAR teams in every county</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-triangle-exclamation"></i> Universal Distress Signals</h4>
          <ul>
            <li><strong>3 of anything</strong> — 3 whistle blasts, 3 fires in triangle, 3 rock piles, 3 gunshots = universal "HELP"</li>
            <li><strong>Whistle</strong> — Carry one always. Sound carries much farther than yelling. 3 blasts, pause, repeat</li>
            <li><strong>Signal mirror</strong> — Flash at aircraft or distant people. Visible 10+ miles in sun. Aim by looking through center hole at target</li>
            <li><strong>Ground-to-air signals</strong> — Large "X" = need help. "V" = need assistance. Make 10ft+ wide with contrasting material on open ground</li>
            <li><strong>Signal fire</strong> — Once regular fire is burning, add green branches / wet leaves for thick white smoke. 3 fires in a triangle</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-walkie-talkie"></i> Communication Gear</h4>
          <ul>
            <li><strong>Cell phone</strong> — Your #1 tool. Keep charged. Know that 911 works on ANY network, not just yours</li>
            <li><strong>PLB (Personal Locator Beacon)</strong> — $250, no subscription. One-button 911 satellite alert with GPS coords. For remote Cascade trips</li>
            <li><strong>Garmin InReach Mini</strong> — Two-way satellite messenger + SOS button. Monthly subscription. Can text from anywhere on Earth</li>
            <li><strong>FRS/GMRS radio</strong> — No license for FRS. 2-mile range in forest, 5+ on ridges. Coordinate with partners. Channel 1 is common hailing frequency</li>
            <li><strong>Ham radio</strong> — Technician license ($15 test). Access to 2m repeaters all over WA. Range: 50+ miles through repeaters. Major upgrade for backcountry comms</li>
          </ul>
        </div>

        <div class="guide-card">
          <h4><i class="fa-solid fa-map-pin"></i> Making Yourself Findable</h4>
          <ul>
            <li><strong>Stay put</strong> — If lost and rescue is coming, STAY WHERE YOU ARE. Moving makes SAR's job exponentially harder</li>
            <li><strong>Get visible</strong> — Bright clothing/tarp in the open. Contrasting colors against terrain</li>
            <li><strong>Get high</strong> — Move to ridgeline or clearing for cell signal, visibility, and helicopter access</li>
            <li><strong>Leave breadcrumbs</strong> — Tell someone your plan before you leave. Mark your trail with stacked rocks, broken branches, or flagging tape</li>
            <li><strong>SPOT/InReach tracking</strong> — Let family follow your GPS track in real-time for remote WA trips</li>
          </ul>
          <p class="guide-tip"><i class="fa-solid fa-lightbulb"></i> The best emergency plan is prevention: tell someone where you're going, when you'll be back, and at what point they should call 911 if they don't hear from you.</p>
        </div>
      </div>`,
  };

  // ═══════════════════════════════════════════════════════════════════
  // TRANSIT & DIRECTIONS
  // ═══════════════════════════════════════════════════════════════════
  function openTransitModal(destination) {
    state.transitDestination = destination;
    const destNameEl = $('#transit-dest-name');
    if (destNameEl) {
      destNameEl.textContent = destination ? `${destination.name} (${destination.lat?.toFixed(4)}, ${destination.lon?.toFixed(4)})` : 'Select a location first';
    }

    // Pre-fill origin from search center
    const fromInput = $('#transit-from');
    if (fromInput && state.searchCenter?.name && !fromInput.value) {
      fromInput.value = state.searchCenter.name;
    }

    show($('#transit-modal'));
  }

  async function getTransitDirections() {
    const fromInput = $('#transit-from');
    const fromAddr = fromInput?.value?.trim();
    const dest = state.transitDestination;

    if (!fromAddr) { toast('Enter a starting address', 'error'); return; }
    if (!dest) { toast('Select a destination location first', 'error'); return; }

    const resultsEl = $('#transit-results');
    resultsEl.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p class="loading-text"><i class="fa-solid fa-route"></i> Calculating routes...</p>
      </div>`;

    try {
      // Geocode the origin address
      let fromLat, fromLon;
      const coordsMatch = fromAddr.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
      if (coordsMatch) {
        fromLat = parseFloat(coordsMatch[1]);
        fromLon = parseFloat(coordsMatch[2]);
      } else {
        const geo = await window.campAPI.geocodeAddress(fromAddr);
        if (geo.error) throw new Error(`Could not geocode: ${geo.error}`);
        fromLat = geo.lat;
        fromLon = geo.lon;
      }

      const toLat = dest.lat;
      const toLon = dest.lon;

      // Get transit directions from backend
      const result = await window.campAPI.getTransitDirections({ fromLat, fromLon, toLat, toLon });
      if (result.error) throw new Error(result.error);

      renderTransitResults(result, fromLat, fromLon, toLat, toLon);
    } catch (err) {
      resultsEl.innerHTML = `<div class="muted-text"><i class="fa-solid fa-triangle-exclamation"></i> ${err.message}</div>`;
      toast(err.message, 'error');
    }
  }

  function renderTransitResults(data, fromLat, fromLon, toLat, toLon) {
    const el = $('#transit-results');
    if (!data.modes?.length) {
      el.innerHTML = '<div class="muted-text"><i class="fa-solid fa-triangle-exclamation"></i> No routes found between these locations.</div>';
      return;
    }

    let html = `
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:12px;color:var(--text-muted)"><i class="fa-solid fa-ruler" style="color:var(--green)"></i> Straight-line: <strong style="color:var(--green)">${data.straightDistance} mi</strong></span>
        <span style="font-size:10px;color:var(--text-muted)">|</span>
        <span style="font-size:12px;color:var(--text-muted)"><i class="fa-solid fa-route" style="color:var(--green)"></i> ${data.modes.length} travel options</span>
      </div>
      <div class="transit-modes-list">`;

    data.modes.forEach((mode, idx) => {
      const practClass = mode.practicality || 'possible';
      const practLabel = practClass === 'recommended' ? '✓ Recommended' : practClass === 'possible' ? '~ Possible' : '✗ Impractical';

      html += `
        <div class="transit-mode-card ${mode.type}" data-transit-idx="${idx}">
          <div class="transit-mode-header">
            <div class="transit-mode-icon ${mode.type}"><i class="fa-solid ${mode.icon}"></i></div>
            <div class="transit-mode-info">
              <div class="transit-mode-name">
                ${mode.name}
                <span class="transit-badge ${practClass}">${practLabel}</span>
              </div>
              <div class="transit-mode-desc">${mode.description || ''}</div>
              ${renderTransitStealth(mode.stealthRating || 0)}
            </div>
            <div class="transit-mode-stats">
              <div class="transit-stat">
                <span class="transit-stat-value">${mode.durationText || '?'}</span>
                <span class="transit-stat-label">Time</span>
              </div>
              <div class="transit-stat">
                <span class="transit-stat-value">${mode.fareText || '?'}</span>
                <span class="transit-stat-label">Cost</span>
              </div>
              <div class="transit-stat">
                <span class="transit-stat-value">${mode.distanceMiles || '?'}</span>
                <span class="transit-stat-label">Miles</span>
              </div>
            </div>
          </div>
          <div class="transit-mode-details">
            ${renderTransitModeDetails(mode)}
          </div>
        </div>`;
    });

    html += '</div>';
    el.innerHTML = html;

    // Click to expand / show route on map
    el.querySelectorAll('.transit-mode-card').forEach(card => {
      card.addEventListener('click', () => {
        const wasExpanded = card.classList.contains('expanded');
        el.querySelectorAll('.transit-mode-card').forEach(c => c.classList.remove('expanded', 'active'));
        if (!wasExpanded) {
          card.classList.add('expanded', 'active');
          const idx = parseInt(card.dataset.transitIdx);
          const mode = data.modes[idx];
          if (mode.route?.geometry) {
            showRouteOnMap(mode, fromLat, fromLon, toLat, toLon);
          }
        } else {
          clearTransitRoute();
        }
      });
    });
  }

  function renderTransitStealth(rating) {
    const r = Math.min(5, Math.max(0, rating || 0));
    let html = '<div class="transit-stealth"><span style="font-size:9px;color:var(--text-muted);margin-right:2px">Stealth:</span>';
    for (let i = 0; i < 5; i++) {
      html += `<i class="fa-solid fa-person-shelter transit-stealth-icon ${i < r ? 'filled' : 'empty'}" style="font-size:9px"></i>`;
    }
    html += '</div>';
    return html;
  }

  function renderTransitModeDetails(mode) {
    let html = '';

    // Fare breakdown
    if (mode.fareBreakdown) {
      html += `<div class="transit-note"><i class="fa-solid fa-calculator"></i> ${mode.fareBreakdown}</div>`;
    }

    // Note
    if (mode.note) {
      html += `<div class="transit-note"><i class="fa-solid fa-info-circle"></i> ${mode.note}</div>`;
    }

    // Agency fare tables (for bus mode)
    if (mode.agencies?.length) {
      mode.agencies.forEach(agency => {
        html += `
          <div class="transit-agency-info">
            <h4><i class="fa-solid ${mode.icon}" style="color:${agency.color}"></i> ${agency.name}</h4>
            <table class="transit-fare-table">
              <thead><tr><th>Passenger</th><th>Fare</th></tr></thead>
              <tbody>`;
        Object.values(agency.fares).forEach(f => {
          html += `<tr><td>${f.label}</td><td>${f.amount === 0 ? 'FREE' : '$' + f.amount.toFixed(2)}</td></tr>`;
        });
        html += `</tbody></table>`;
        if (agency.payment?.length) {
          html += `<p style="margin-top:6px"><i class="fa-solid fa-credit-card" style="color:var(--green)"></i> Payment: ${agency.payment.join(', ')}</p>`;
        }
        if (agency.tripPlanner) {
          html += `<p><a href="${agency.tripPlanner}" target="_blank"><i class="fa-solid fa-external-link"></i> Trip Planner →</a></p>`;
        }
        if (agency.phone) {
          html += `<p><i class="fa-solid fa-phone" style="color:var(--green)"></i> ${agency.phone}</p>`;
        }
        html += `</div>`;
      });
    }

    // Zip Shuttle zone info
    if (mode.zones?.length) {
      mode.zones.forEach(zone => {
        html += `
          <div class="transit-agency-info">
            <h4><i class="fa-solid fa-shuttle-van" style="color:#00a651"></i> ${zone.name}</h4>
            <p><i class="fa-solid fa-clock" style="color:var(--green)"></i> Hours: ${zone.hours || 'Check website'}</p>
            <p><i class="fa-solid fa-phone" style="color:var(--green)"></i> ${zone.phone}</p>
            <p><i class="fa-solid fa-mobile" style="color:var(--green)"></i> ${zone.booking || 'Book via Zip Shuttle app'}</p>
            <table class="transit-fare-table">
              <thead><tr><th>Passenger</th><th>Fare</th></tr></thead>
              <tbody>`;
        if (zone.fares) {
          Object.values(zone.fares).forEach(f => {
            html += `<tr><td>${f.label}</td><td>${f.amount === 0 ? 'FREE' : '$' + f.amount.toFixed(2)}</td></tr>`;
          });
        }
        html += `</tbody></table>`;
        if (zone.destinations?.length) {
          html += `<p style="margin-top:4px"><i class="fa-solid fa-map-pin" style="color:var(--green)"></i> Key stops: ${zone.destinations.join(', ')}</p>`;
        }
        html += `</div>`;
      });
    }

    // Nearest light rail stations
    if (mode.nearestStations) {
      const ns = mode.nearestStations;
      html += `<div class="transit-agency-info"><h4><i class="fa-solid fa-train-subway" style="color:#a855f7"></i> Light Rail Stations</h4>`;
      if (ns.origin) html += `<p>Near start: <strong>${ns.origin.name}</strong> (${ns.origin.distance} mi away)</p>`;
      if (ns.destination) html += `<p>Near destination: <strong>${ns.destination.name}</strong> (${ns.destination.distance} mi away)</p>`;
      html += `</div>`;
    }

    // Turn-by-turn steps
    if (mode.route?.steps?.length && (mode.type === 'walking' || mode.type === 'cycling' || mode.type === 'driving')) {
      html += `<div style="margin-top:8px"><strong style="font-size:11px;color:var(--text-muted)"><i class="fa-solid fa-list-ol"></i> Turn-by-Turn</strong></div>`;
      html += '<ul class="transit-steps">';
      const steps = mode.route.steps.slice(0, 15); // Limit displayed steps
      steps.forEach((step, i) => {
        const stepIcon = getStepIcon(step.type, step.modifier);
        const distText = step.distance ? `${(step.distance / 1609.34).toFixed(2)} mi` : '';
        html += `
          <li class="transit-step">
            <span class="transit-step-num">${i + 1}</span>
            <span class="transit-step-text"><i class="fa-solid ${stepIcon}" style="color:var(--green);margin-right:4px;font-size:10px"></i> ${step.instruction || step.name || '...'}</span>
            <span class="transit-step-dist">${distText}</span>
          </li>`;
      });
      if (mode.route.steps.length > 15) {
        html += `<li class="transit-step"><span class="transit-step-num">...</span><span class="transit-step-text" style="color:var(--text-muted)">+ ${mode.route.steps.length - 15} more steps</span><span></span></li>`;
      }
      html += '</ul>';
    }

    return html;
  }

  function getStepIcon(type, modifier) {
    if (type === 'depart') return 'fa-play';
    if (type === 'arrive') return 'fa-flag-checkered';
    if (type === 'turn') {
      if (modifier?.includes('left')) return 'fa-arrow-left';
      if (modifier?.includes('right')) return 'fa-arrow-right';
      return 'fa-arrow-up';
    }
    if (type === 'continue' || type === 'new name') return 'fa-arrow-up';
    if (type === 'merge') return 'fa-code-merge';
    if (type === 'fork') return 'fa-code-branch';
    if (type === 'roundabout') return 'fa-rotate';
    return 'fa-arrow-up';
  }

  function showRouteOnMap(mode, fromLat, fromLon, toLat, toLon) {
    clearTransitRoute();

    const color = mode.color || '#22c55e';

    // Add route polyline
    if (mode.route?.geometry?.coordinates) {
      const coords = mode.route.geometry.coordinates.map(c => [c[1], c[0]]); // GeoJSON is [lon,lat]
      const polyline = L.polyline(coords, {
        color: color,
        weight: 5,
        opacity: 0.8,
        dashArray: mode.type === 'walking' ? '8,12' : mode.type === 'cycling' ? '12,8' : null,
        className: 'transit-route-polyline',
      }).addTo(state.map);

      // Origin marker
      const originIcon = L.divIcon({
        html: '<div class="transit-route-marker origin"></div>',
        className: '',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const originMarker = L.marker([fromLat, fromLon], { icon: originIcon })
        .addTo(state.map)
        .bindPopup('<b>Starting Point</b>');

      // Destination marker
      const destIcon = L.divIcon({
        html: '<div class="transit-route-marker destination"></div>',
        className: '',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const destMarker = L.marker([toLat, toLon], { icon: destIcon })
        .addTo(state.map)
        .bindPopup(`<b>${state.transitDestination?.name || 'Destination'}</b>`);

      state.transitRoute = { polyline, originMarker, destMarker };

      // Fit map bounds to route
      state.map.fitBounds(polyline.getBounds(), { padding: [60, 60] });
    }
  }

  function clearTransitRoute() {
    if (state.transitRoute) {
      if (state.transitRoute.polyline) state.map.removeLayer(state.transitRoute.polyline);
      if (state.transitRoute.originMarker) state.map.removeLayer(state.transitRoute.originMarker);
      if (state.transitRoute.destMarker) state.map.removeLayer(state.transitRoute.destMarker);
      state.transitRoute = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // GROCERY BUDGET OPTIMIZER
  // ═══════════════════════════════════════════════════════════════════
  const STORE_COLORS = {
    walmart: '#0071dc', fredmeyer: '#e21836', safeway: '#e8351e',
    dollartree: '#00a651', groceryoutlet: '#ff6600',
  };
  let storeMarkers = [];
  let lastNearbyStores = null; // Cache nearby stores for distance-aware optimization
  let lastMealPlanResult = null; // Cache for shuffle
  function clearStoreMarkers() { storeMarkers.forEach(m => state.map.removeLayer(m)); storeMarkers = []; }
  const STORE_NAMES = {
    walmart: 'Walmart', fredmeyer: 'Fred Meyer', safeway: 'Safeway',
    dollartree: 'Dollar Tree', groceryoutlet: 'Grocery Outlet',
  };
  const GROUP_COLORS = {
    protein: '#9b59b6', grains: '#e67e22', vegetables: '#27ae60',
    fruits: '#e74c3c', dairy: '#3498db', fats: '#f1c40f',
  };
  const MEAL_ICONS = {
    breakfast: 'fa-mug-hot', lunch: 'fa-utensils', dinner: 'fa-fire-burner', snack: 'fa-cookie-bite',
  };
  const MEAL_LABELS = {
    breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks',
  };

  function openGroceryModal() {
    show($('#grocery-modal'));
    // Auto-load compare tab on first open
    if (!$('#grocery-compare-results').innerHTML) {
      loadCompareTab();
    }
  }

  function switchGroceryTab(tab) {
    $$('.grocery-tab').forEach(t => t.classList.toggle('active', t.dataset.gtab === tab));
    $$('.grocery-tab-panel').forEach(p => p.classList.toggle('active', p.id === `gtab-${tab}`));
  }

  // Fetch nearby stores for distance-aware optimization
  async function fetchNearbyStoresForOptimizer() {
    const center = state.map.getCenter();
    try {
      const stores = await window.campAPI.groceryFindStores({ lat: center.lat, lon: center.lng, radiusMeters: 8000 });
      if (Array.isArray(stores)) {
        lastNearbyStores = stores;
        return stores;
      }
    } catch (err) {
      console.warn('Could not fetch nearby stores for optimizer:', err.message);
    }
    return null;
  }

  // Quick Meal Plan — one-click randomized distance-aware plan
  async function runQuickMealPlan() {
    const resultsEl = $('#grocery-optimizer-results');
    // Switch to optimizer tab
    switchGroceryTab('optimizer');
    show($('#grocery-modal'));

    resultsEl.innerHTML = '<div class="transit-intro"><div class="transit-intro-icon"><i class="fa-solid fa-dice fa-spin fa-2x"></i></div><p>Finding nearby stores & generating meal plan...</p></div>';

    try {
      const center = state.map.getCenter();
      const result = await window.campAPI.groceryQuickPlan({ lat: center.lat, lon: center.lng });

      if (result.error) {
        resultsEl.innerHTML = `<div class="transit-intro"><p style="color:#ef4444;">Error: ${result.error}</p></div>`;
        return;
      }

      lastMealPlanResult = result;
      const shuffleBtn = $('#btn-shuffle-plan');
      if (shuffleBtn) shuffleBtn.disabled = false;
      renderOptimizerResults(result, resultsEl);
      toast('Randomized meal plan generated!', 'success');
    } catch (err) {
      resultsEl.innerHTML = `<div class="transit-intro"><p style="color:#ef4444;">Error: ${err.message}</p></div>`;
    }
  }

  // Shuffle — re-run with randomize flag to get a different plan
  async function shuffleMealPlan() {
    const resultsEl = $('#grocery-optimizer-results');
    resultsEl.innerHTML = '<div class="transit-intro"><div class="transit-intro-icon"><i class="fa-solid fa-shuffle fa-spin fa-2x"></i></div><p>Shuffling meal plan...</p></div>';

    try {
      const budget = parseFloat($('#grocery-budget').value) || 20;
      const days = parseInt($('#grocery-days').value) || 3;
      const campFriendlyOnly = $('#grocery-camp-only').checked;
      const shelfStableOnly = $('#grocery-shelf-stable').checked;
      const useDistance = $('#grocery-use-distance').checked;

      const selectedStores = [];
      $$('.grocery-store-chip input:checked').forEach(cb => selectedStores.push(cb.value));

      // Get nearby stores for distance if enabled
      let nearbyStores = null;
      if (useDistance) {
        nearbyStores = lastNearbyStores || await fetchNearbyStoresForOptimizer();
      }

      const result = await window.campAPI.groceryOptimize({
        budget, days,
        preferences: {
          campFriendlyOnly, shelfStableOnly,
          preferredStores: selectedStores.length > 0 ? selectedStores : null,
          randomize: true,
          nearbyStores,
        }
      });

      if (result.error) {
        resultsEl.innerHTML = `<div class="transit-intro"><p style="color:#ef4444;">Error: ${result.error}</p></div>`;
        return;
      }

      lastMealPlanResult = result;
      renderOptimizerResults(result, resultsEl);
      toast('Shuffled!', 'success');
    } catch (err) {
      resultsEl.innerHTML = `<div class="transit-intro"><p style="color:#ef4444;">Error: ${err.message}</p></div>`;
    }
  }

  async function runOptimizer(randomize = false) {
    const budget = parseFloat($('#grocery-budget').value) || 20;
    const days = parseInt($('#grocery-days').value) || 3;
    const campFriendlyOnly = $('#grocery-camp-only').checked;
    const shelfStableOnly = $('#grocery-shelf-stable').checked;
    const useDistance = $('#grocery-use-distance').checked;

    const selectedStores = [];
    $$('.grocery-store-chip input:checked').forEach(cb => selectedStores.push(cb.value));

    const resultsEl = $('#grocery-optimizer-results');
    resultsEl.innerHTML = `<div class="transit-intro"><div class="transit-intro-icon"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div><p>${useDistance ? 'Finding nearby stores & optimizing...' : 'Calculating optimal meal plan...'}</p></div>`;

    try {
      // Fetch nearby stores if distance-aware mode is on
      let nearbyStores = null;
      if (useDistance) {
        nearbyStores = lastNearbyStores || await fetchNearbyStoresForOptimizer();
      }

      const result = await window.campAPI.groceryOptimize({
        budget, days,
        preferences: {
          campFriendlyOnly, shelfStableOnly,
          preferredStores: selectedStores.length > 0 ? selectedStores : null,
          randomize,
          nearbyStores,
        }
      });

      if (result.error) {
        resultsEl.innerHTML = `<div class="transit-intro"><p style="color:#ef4444;">Error: ${result.error}</p></div>`;
        return;
      }

      lastMealPlanResult = result;
      const shuffleBtn = $('#btn-shuffle-plan');
      if (shuffleBtn) shuffleBtn.disabled = false;
      renderOptimizerResults(result, resultsEl);
    } catch (err) {
      resultsEl.innerHTML = `<div class="transit-intro"><p style="color:#ef4444;">Error: ${err.message}</p></div>`;
    }
  }

  function renderOptimizerResults(result, el) {
    let html = '';

    // Summary cards
    html += '<div class="grocery-plan-summary">';
    html += statCard('$' + result.totalCost.toFixed(2), `of $${result.budget} budget`);
    html += statCard(result.caloriesPerDay.toLocaleString(), 'cal / day');
    html += statCard(result.proteinPerDay + 'g', 'protein / day');
    html += statCard(result.plan.length, 'items');
    html += statCard(result.coveredGroupCount + '/' + result.totalGroups, 'food groups');
    html += statCard('$' + result.remainingBudget.toFixed(2), 'remaining');
    html += '</div>';

    // Meal Plan Structure (Breakfast / Lunch / Dinner / Snacks)
    if (result.mealPlan) {
      html += '<div class="grocery-section-header"><i class="fa-solid fa-plate-wheat"></i> Daily Meal Plan</div>';
      html += '<div class="grocery-meal-grid">';
      for (const [meal, items] of Object.entries(result.mealPlan)) {
        if (items.length === 0) continue;
        const mealCals = items.reduce((sum, i) => sum + (i.calories * i.servings), 0);
        const mealCost = items.reduce((sum, i) => sum + i.cheapestPrice, 0);
        html += `<div class="grocery-meal-card">
          <div class="meal-card-header">
            <i class="fa-solid ${MEAL_ICONS[meal]}"></i>
            <span class="meal-name">${MEAL_LABELS[meal]}</span>
            <span class="meal-stats">${mealCals} cal · $${mealCost.toFixed(2)}</span>
          </div>
          <div class="meal-card-items">`;
        for (const item of items) {
          const storeColor = STORE_COLORS[item.cheapestStore] || '#888';
          html += `<div class="meal-item">
            <span class="meal-item-name">${item.name}</span>
            <span class="meal-item-price" style="color:${storeColor}">$${item.cheapestPrice.toFixed(2)}</span>
          </div>`;
        }
        html += '</div></div>';
      }
      html += '</div>';
    }

    // Nutrient coverage
    html += '<div class="grocery-section-header"><i class="fa-solid fa-shield-halved"></i> Nutritional Coverage</div>';
    html += '<div class="grocery-coverage-grid">';
    for (const [group, data] of Object.entries(result.groupCoverage)) {
      const cls = data.covered ? 'covered' : 'uncovered';
      const icon = data.covered ? 'fa-circle-check' : 'fa-circle-xmark';
      html += `<div class="grocery-coverage-card ${cls}">
        <div class="coverage-check"><i class="fa-solid ${icon}"></i></div>
        <div class="coverage-icon"><i class="fa-solid ${data.icon}" style="color:${GROUP_COLORS[group]}"></i></div>
        <div class="coverage-name">${data.name}</div>
        <div class="coverage-status">${data.covered ? data.items + ' items — $' + data.totalCost.toFixed(2) : 'Not covered'}</div>
      </div>`;
    }
    html += '</div>';

    // Store breakdown with distance
    html += '<div class="grocery-section-header"><i class="fa-solid fa-store"></i> Shopping List by Store</div>';
    html += '<div class="grocery-store-breakdown">';
    for (const [store, info] of Object.entries(result.storeBreakdown)) {
      const distText = info.distance != null ? ` · ${info.distance.toFixed(1)} mi` : '';
      html += `<div class="grocery-store-summary">
        <span class="store-dot" style="background:${STORE_COLORS[store]}"></span>
        <span class="store-name">${STORE_NAMES[store]}</span>
        <span class="store-cost">$${info.cost.toFixed(2)}</span>
        <span class="store-items">(${info.items} items${distText})</span>
      </div>`;
    }
    html += '</div>';

    // Distance status indicator
    if (result.usedNearbyStores) {
      html += '<div class="grocery-distance-note"><i class="fa-solid fa-location-dot"></i> Prices optimized for nearby stores based on your map location</div>';
    }

    // Nearby food banks callout
    if (result.nearbyFoodBanks && result.nearbyFoodBanks.length > 0) {
      html += '<div class="grocery-section-header"><i class="fa-solid fa-hand-holding-heart"></i> Free Food Nearby</div>';
      html += '<div class="foodbank-callout">';
      html += `<div class="foodbank-callout-text"><i class="fa-solid fa-circle-info"></i> ${result.nearbyFoodBanks.length} food bank${result.nearbyFoodBanks.length > 1 ? 's' : ''} found nearby — check the <strong>Free Food</strong> tab for details</div>`;
      html += '<div class="foodbank-callout-list">';
      for (const fb of result.nearbyFoodBanks.slice(0, 3)) {
        const color = FOOD_BANK_COLORS[fb.type] || '#ef4444';
        html += `<div class="foodbank-callout-item" onclick="window.dispatchEvent(new CustomEvent('fly-to', {detail:{lat:${fb.lat},lon:${fb.lon}}}))">
          <i class="fa-solid ${FOOD_BANK_ICONS[fb.type] || 'fa-utensils'}" style="color:${color}"></i>
          <span class="fb-callout-name">${fb.name}</span>
          <span class="fb-callout-dist">${fb.distance} mi</span>
        </div>`;
      }
      html += '</div></div>';
    }

    // Item list
    html += '<div class="grocery-section-header"><i class="fa-solid fa-list-check"></i> All Items</div>';
    html += '<div class="grocery-plan-list">';
    for (const item of result.plan) {
      const groupColor = GROUP_COLORS[item.group] || '#888';
      html += `<div class="grocery-plan-item">
        <div class="item-group-dot" style="background:${groupColor}"></div>
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-meta">
            <span>${item.calories * item.servings} cal total</span>
            <span>${item.proteinG * item.servings}g protein</span>
            <span>${item.servings} servings</span>
            ${renderCampStars(item.campFriendly)}
            ${item.shelfStable ? '<span style="color:#22c55e"><i class="fa-solid fa-box"></i> Shelf-stable</span>' : ''}
          </div>
        </div>
        <div class="item-price">$${item.cheapestPrice.toFixed(2)}</div>
        <div class="item-store ${item.cheapestStore}">${STORE_NAMES[item.cheapestStore]}</div>
      </div>`;
    }
    html += '</div>';

    el.innerHTML = html;
  }

  function statCard(value, label) {
    return `<div class="grocery-stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  }

  function renderCampStars(rating) {
    let s = '<span class="camp-stars">';
    for (let i = 1; i <= 5; i++) {
      s += `<i class="fa-solid fa-campground ${i <= rating ? 'filled' : 'empty'}"></i>`;
    }
    return s + '</span>';
  }

  async function loadCompareTab(filters = {}) {
    const resultsEl = $('#grocery-compare-results');
    resultsEl.innerHTML = '<div class="transit-intro"><div class="transit-intro-icon"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div><p>Loading price comparisons...</p></div>';

    try {
      const foods = await window.campAPI.groceryGetFoods(filters);
      renderCompareResults(foods, resultsEl);
    } catch (err) {
      resultsEl.innerHTML = `<p style="color:#ef4444;">Error: ${err.message}</p>`;
    }
  }

  function renderCompareResults(foods, el) {
    if (!foods || foods.length === 0) {
      el.innerHTML = '<div class="transit-intro"><p class="muted-text">No items found matching your filters.</p></div>';
      return;
    }

    let html = '<div class="grocery-compare-grid">';

    for (const food of foods) {
      const groupColor = GROUP_COLORS[food.group] || '#888';
      const maxPrice = Math.max(...food.storeComparisons.map(s => s.price));

      html += `<div class="grocery-compare-card">
        <div class="grocery-compare-header">
          <div>
            <span class="food-name">${food.name}</span>
            <div class="food-stats">
              <span>${food.calories} cal</span>
              <span>${food.proteinG}g protein</span>
              <span>${food.costPerServing}/srv</span>
            </div>
          </div>
          <span class="food-group-badge" style="background:${groupColor}22;color:${groupColor}">${food.group}</span>
        </div>
        <div class="grocery-price-bars">`;

      for (const comp of food.storeComparisons) {
        const pct = maxPrice > 0 ? (comp.price / maxPrice) * 100 : 0;
        const isCheapest = comp.price === food.cheapestPrice;
        html += `<div class="grocery-price-row">
          <span class="store-label">${comp.storeName}</span>
          <div class="grocery-price-bar-track">
            <div class="grocery-price-bar-fill ${isCheapest ? 'cheapest' : 'expensive'}" style="width:${pct}%;background:${comp.color}"></div>
          </div>
          <span class="price-val ${isCheapest ? 'cheapest' : 'expensive'}">$${comp.price.toFixed(2)}</span>
        </div>`;
      }

      html += `</div>
        <div class="grocery-compare-footer">
          <span>${renderCampStars(food.campFriendly)} ${food.shelfStable ? '<i class="fa-solid fa-box" style="color:var(--green);margin-left:4px" title="Shelf stable"></i>' : ''}</span>
          <span>${food.caloriesPerDollar} cal/$</span>
          ${food.savings > 0 ? `<span class="savings">Save $${food.savings.toFixed(2)} at ${food.cheapestStoreName}</span>` : ''}
        </div>
      </div>`;
    }

    html += '</div>';
    el.innerHTML = html;
  }

  async function findNearbyStores() {
    const resultsEl = $('#grocery-stores-results');
    resultsEl.innerHTML = '<div class="transit-intro"><div class="transit-intro-icon"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div><p>Searching for nearby stores...</p></div>';

    const center = state.map.getCenter();
    try {
      const stores = await window.campAPI.groceryFindStores({ lat: center.lat, lon: center.lng, radiusMeters: 8000 });

      if (stores.error) {
        resultsEl.innerHTML = `<p style="color:#ef4444;">Error: ${stores.error}</p>`;
        return;
      }

      if (!stores.length) {
        resultsEl.innerHTML = '<div class="transit-intro"><p class="muted-text">No stores found within 5 miles. Try moving the map.</p></div>';
        return;
      }

      let html = '<div class="grocery-stores-list">';
      for (const store of stores) {
        html += `<div class="grocery-store-card" onclick="window.dispatchEvent(new CustomEvent('fly-to', {detail:{lat:${store.lat},lon:${store.lon}}}))">
          <div class="grocery-store-icon ${store.type}"><i class="fa-solid ${getStoreIcon(store.type)}"></i></div>
          <div class="grocery-store-info">
            <div class="store-name">${store.name}</div>
            <div class="store-address">${store.address || 'Address not available'}</div>
          </div>
          <div class="grocery-store-distance">${store.distance.toFixed(1)}<span class="unit"> mi</span></div>
        </div>`;
      }
      html += '</div>';
      resultsEl.innerHTML = html;

      // Add markers to map
      clearStoreMarkers();
      for (const store of stores) {
        const color = STORE_COLORS[store.type] || '#888';
        const m = L.circleMarker([store.lat, store.lon], {
          radius: 8, color: color, fillColor: color, fillOpacity: 0.8, weight: 2,
        }).bindTooltip(`<b>${store.name}</b><br>${store.distance.toFixed(1)} mi`, { className: 'custom-tooltip' })
          .addTo(state.map);
        storeMarkers.push(m);
      }
    } catch (err) {
      resultsEl.innerHTML = `<p style="color:#ef4444;">Error: ${err.message}</p>`;
    }
  }

  function getStoreIcon(type) {
    const icons = { walmart: 'fa-store', fredmeyer: 'fa-cart-shopping', safeway: 'fa-basket-shopping', dollartree: 'fa-dollar-sign', groceryoutlet: 'fa-tags' };
    return icons[type] || 'fa-store';
  }

  // ── Food Banks, Soup Kitchens, Community Fridges ──────────────────
  const FOOD_BANK_COLORS = {
    food_bank: '#ef4444', soup_kitchen: '#f97316', food_sharing: '#06b6d4', give_box: '#8b5cf6',
  };
  const FOOD_BANK_ICONS = {
    food_bank: 'fa-boxes-stacked', soup_kitchen: 'fa-bowl-food', food_sharing: 'fa-temperature-low', give_box: 'fa-box-open',
  };
  const FOOD_BANK_LABELS = {
    food_bank: 'Food Bank', soup_kitchen: 'Soup Kitchen', food_sharing: 'Community Fridge', give_box: 'Free Pantry',
  };
  let foodBankMarkers = [];
  function clearFoodBankMarkers() { foodBankMarkers.forEach(m => state.map.removeLayer(m)); foodBankMarkers = []; }

  async function findFoodBanks() {
    const resultsEl = $('#foodbank-results');
    const radiusMiles = parseInt($('#foodbank-radius').value) || 10;
    const radiusMeters = Math.round(radiusMiles * 1609.34);

    resultsEl.innerHTML = '<div class="transit-intro"><div class="transit-intro-icon"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div><p>Searching for food banks, soup kitchens & community fridges...</p></div>';

    const center = state.map.getCenter();
    try {
      const data = await window.campAPI.groceryFindFoodBanks({ lat: center.lat, lon: center.lng, radiusMeters });

      if (data.error) {
        resultsEl.innerHTML = `<div class="transit-intro"><p style="color:#ef4444;">Error: ${data.error}</p></div>`;
        return;
      }

      if (!data.results || data.results.length === 0) {
        resultsEl.innerHTML = `<div class="transit-intro"><p class="muted-text">No food banks found within ${radiusMiles} miles. Try a larger radius or move the map.</p></div>`;
        return;
      }

      renderFoodBankResults(data, resultsEl);

      // Add markers
      clearFoodBankMarkers();
      for (const fb of data.results) {
        const color = FOOD_BANK_COLORS[fb.type] || '#ef4444';
        const m = L.circleMarker([fb.lat, fb.lon], {
          radius: 9, color: color, fillColor: color, fillOpacity: 0.85, weight: 2,
        }).bindTooltip(`<b>${fb.name}</b><br>${fb.typeLabel} · ${fb.distance} mi`, { className: 'custom-tooltip' })
          .addTo(state.map);
        foodBankMarkers.push(m);
      }
      toast(`Found ${data.total} free food locations`, 'success');
    } catch (err) {
      resultsEl.innerHTML = `<div class="transit-intro"><p style="color:#ef4444;">Error: ${err.message}</p></div>`;
    }
  }

  function renderFoodBankResults(data, el) {
    let html = '';

    // Summary bar
    html += '<div class="foodbank-summary">';
    html += `<div class="foodbank-count-badge total">${data.total} locations found</div>`;
    if (data.counts.food_bank > 0) html += `<div class="foodbank-count-badge food_bank"><i class="fa-solid fa-boxes-stacked"></i> ${data.counts.food_bank} Food Banks</div>`;
    if (data.counts.soup_kitchen > 0) html += `<div class="foodbank-count-badge soup_kitchen"><i class="fa-solid fa-bowl-food"></i> ${data.counts.soup_kitchen} Soup Kitchens</div>`;
    if (data.counts.food_sharing > 0) html += `<div class="foodbank-count-badge food_sharing"><i class="fa-solid fa-temperature-low"></i> ${data.counts.food_sharing} Community Fridges</div>`;
    if (data.counts.give_box > 0) html += `<div class="foodbank-count-badge give_box"><i class="fa-solid fa-box-open"></i> ${data.counts.give_box} Free Pantries</div>`;
    html += '</div>';

    // Cards
    html += '<div class="foodbank-list">';
    for (const fb of data.results) {
      const typeColor = FOOD_BANK_COLORS[fb.type] || '#ef4444';
      const typeIcon = FOOD_BANK_ICONS[fb.type] || 'fa-utensils';

      html += `<div class="foodbank-card" onclick="window.dispatchEvent(new CustomEvent('fly-to', {detail:{lat:${fb.lat},lon:${fb.lon}}}))">
        <div class="foodbank-icon" style="background:${typeColor}"><i class="fa-solid ${typeIcon}"></i></div>
        <div class="foodbank-info">
          <div class="foodbank-name">${fb.name}</div>
          <div class="foodbank-type-label" style="color:${typeColor}">${fb.typeLabel}</div>
          <div class="foodbank-detail">`;

      if (fb.address) html += `<span><i class="fa-solid fa-location-dot"></i> ${fb.address}</span>`;
      if (fb.hours) html += `<span><i class="fa-solid fa-clock"></i> ${fb.hours}</span>`;
      if (fb.phone) html += `<span><i class="fa-solid fa-phone"></i> ${fb.phone}</span>`;
      if (fb.wheelchair) html += `<span><i class="fa-solid fa-wheelchair"></i> Accessible</span>`;

      html += '</div>';

      // Offers
      if (fb.offers && fb.offers.length) {
        html += '<div class="foodbank-offers">';
        for (const offer of fb.offers) {
          html += `<span class="foodbank-offer-tag">${offer}</span>`;
        }
        html += '</div>';
      }

      // Description
      if (fb.description && fb.description !== fb.typeLabel) {
        html += `<div class="foodbank-desc">${fb.description}</div>`;
      }

      // Links
      html += '<div class="foodbank-links">';
      if (fb.website) html += `<a href="${fb.website}" target="_blank" class="foodbank-link"><i class="fa-solid fa-globe"></i> Website</a>`;
      html += `<a href="${fb.osmUrl}" target="_blank" class="foodbank-link"><i class="fa-solid fa-map"></i> OpenStreetMap</a>`;
      html += '</div>';

      html += `</div>
        <div class="foodbank-distance">${fb.distance}<span class="unit"> mi</span></div>
      </div>`;
    }
    html += '</div>';

    el.innerHTML = html;
  }

  // Fly-to handler for store/resource cards
  window.addEventListener('fly-to', (e) => {
    if (state.map && e.detail) {
      state.map.flyTo([e.detail.lat, e.detail.lon], 16, { duration: 1 });
      hide($('#grocery-modal'));
      hide($('#bathrooms-modal'));
      hide($('#resources-modal'));
      hide($('#bridges-modal'));
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // BATHROOMS & RESTROOMS
  // ═══════════════════════════════════════════════════════════════════
  const BATHROOM_TYPE_META = {
    public: { icon: 'fa-restroom', color: '#3b82f6' },
    park: { icon: 'fa-tree', color: '#22c55e' },
    library: { icon: 'fa-book', color: '#8b5cf6' },
    gas_station: { icon: 'fa-gas-pump', color: '#f59e0b' },
    restaurant: { icon: 'fa-utensils', color: '#ef4444' },
    mall: { icon: 'fa-store', color: '#ec4899' },
    transit: { icon: 'fa-bus', color: '#06b6d4' },
    community: { icon: 'fa-building', color: '#6366f1' },
    shower: { icon: 'fa-shower', color: '#14b8a6' },
    gym_shower: { icon: 'fa-dumbbell', color: '#8b5cf6' },
    pool_shower: { icon: 'fa-person-swimming', color: '#0ea5e9' },
    hot_spring: { icon: 'fa-hot-tub-person', color: '#f97316' },
    water: { icon: 'fa-faucet-drip', color: '#0ea5e9' },
    unknown: { icon: 'fa-toilet', color: '#94a3b8' },
  };

  let bathroomMarkers = [];
  let lastBathroomData = null;

  function openBathroomsModal() {
    show($('#bathrooms-modal'));
  }

  function getBathroomFilters() {
    return {
      accessible: $('#br-filter-accessible')?.checked || false,
      free: $('#br-filter-free')?.checked || false,
      open24h: $('#br-filter-24h')?.checked || false,
      showers: $('#br-filter-showers')?.checked || false,
      water: $('#br-filter-water')?.checked || false,
      types: getActiveBrTypes(),
    };
  }

  function getActiveBrTypes() {
    const active = document.querySelector('.br-type-btn.active');
    if (!active || active.dataset.brtype === 'all') return [];
    return [active.dataset.brtype];
  }

  async function searchBathrooms() {
    const center = state.map ? state.map.getCenter() : { lat: 47.6062, lng: -122.3321 };
    const filters = getBathroomFilters();
    const resultsEl = $('#br-results');
    const summaryEl = $('#br-summary');

    resultsEl.innerHTML = '<div class="br-intro"><div class="br-intro-icon"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div><p>Searching Refuge Restrooms & OpenStreetMap...</p></div>';
    summaryEl.classList.add('hidden');

    try {
      const result = await window.campAPI.findBathrooms({
        lat: center.lat,
        lon: center.lng,
        radiusMeters: 8000,
        filters,
      });

      if (result.error) {
        resultsEl.innerHTML = `<div class="br-intro"><p style="color:#ef4444;">Error: ${result.error}</p></div>`;
        return;
      }

      lastBathroomData = result;
      renderBathroomSummary(result.summary, summaryEl);
      renderBathroomResults(result.bathrooms, resultsEl);
      addBathroomMarkers(result.bathrooms);
      toast(`Found ${result.summary.total} bathrooms nearby`, 'success');
    } catch (err) {
      resultsEl.innerHTML = `<div class="br-intro"><p style="color:#ef4444;">Error: ${err.message}</p></div>`;
    }
  }

  function renderBathroomSummary(summary, el) {
    el.innerHTML = `
      <div class="br-stat"><div class="br-stat-value">${summary.total}</div><div class="br-stat-label">Total</div></div>
      <div class="br-stat"><div class="br-stat-value">${summary.toilets}</div><div class="br-stat-label">Restrooms</div></div>
      <div class="br-stat"><div class="br-stat-value" style="color:#14b8a6">${summary.showers}</div><div class="br-stat-label">🚿 Showers</div></div>
      <div class="br-stat"><div class="br-stat-value" style="color:#8b5cf6">${summary.gyms || 0}</div><div class="br-stat-label">💪 Gyms</div></div>
      <div class="br-stat"><div class="br-stat-value" style="color:#0ea5e9">${summary.pools || 0}</div><div class="br-stat-label">🏊 Pools</div></div>
      <div class="br-stat"><div class="br-stat-value" style="color:#f97316">${summary.hotSprings || 0}</div><div class="br-stat-label">♨️ Hot Spr.</div></div>
      <div class="br-stat"><div class="br-stat-value">${summary.water}</div><div class="br-stat-label">Water</div></div>
      <div class="br-stat"><div class="br-stat-value">${summary.accessible}</div><div class="br-stat-label">Accessible</div></div>
      <div class="br-stat"><div class="br-stat-value">${summary.free}</div><div class="br-stat-label">Free</div></div>
      <div class="br-stat"><div class="br-stat-value">${summary.open24h}</div><div class="br-stat-label">24/7</div></div>
    `;
    el.classList.remove('hidden');
  }

  function renderBathroomResults(bathrooms, el) {
    if (!bathrooms.length) {
      el.innerHTML = '<div class="br-intro"><p class="muted-text">No bathrooms found matching your filters. Try expanding your search or removing filters.</p></div>';
      return;
    }

    let html = '';
    for (const b of bathrooms) {
      const meta = BATHROOM_TYPE_META[b.type] || BATHROOM_TYPE_META.unknown;
      const scoreColor = b.utilityScore >= 70 ? '#22c55e' : b.utilityScore >= 40 ? '#f59e0b' : '#ef4444';

      // Tags
      let tags = '';
      if (b.accessible) tags += '<span class="br-tag accessible"><i class="fa-solid fa-wheelchair"></i> Accessible</span>';
      if (b.fee === false || b.fee === null) tags += '<span class="br-tag free"><i class="fa-solid fa-hand-holding-heart"></i> Free</span>';
      if (b.hours === '24/7') tags += '<span class="br-tag open24"><i class="fa-solid fa-clock"></i> 24/7</span>';
      if (b.hasShower) tags += '<span class="br-tag shower"><i class="fa-solid fa-shower"></i> Shower</span>';
      if (b.hasDrinkingWater) tags += '<span class="br-tag water"><i class="fa-solid fa-faucet-drip"></i> Water</span>';
      if (b.unisex) tags += '<span class="br-tag unisex"><i class="fa-solid fa-restroom"></i> Unisex</span>';
      if (b.changingTable) tags += '<span class="br-tag changing"><i class="fa-solid fa-baby"></i> Changing</span>';

      // Source badge
      const srcCls = b.source === 'refuge' ? 'source-refuge' : b.source === 'osm' ? 'source-osm' : 'source-curated';
      const srcLabel = b.source === 'refuge' ? 'Refuge' : b.source === 'osm' ? 'OSM' : 'Curated';
      tags += ` <span class="br-tag ${srcCls}">${srcLabel}</span>`;

      // Detail section (directions, comments, hours)
      let detail = '';
      if (b.hours && b.hours !== '24/7') detail += `<div class="br-detail-row"><i class="fa-solid fa-clock"></i><span>${b.hours}</span></div>`;
      if (b.directions) detail += `<div class="br-detail-row"><i class="fa-solid fa-diamond-turn-right"></i><span>${b.directions}</span></div>`;
      if (b.comment) detail += `<div class="br-detail-row"><i class="fa-solid fa-comment"></i><span>${b.comment}</span></div>`;
      if (b.operator) detail += `<div class="br-detail-row"><i class="fa-solid fa-building"></i><span>Operated by: ${b.operator}</span></div>`;
      if (b.upvote > 0 || b.downvote > 0) detail += `<div class="br-detail-row"><i class="fa-solid fa-thumbs-up"></i><span>${b.upvote} upvotes / ${b.downvote} downvotes</span></div>`;
      detail += `<div class="br-detail-actions"><button class="br-action-btn" onclick="window.dispatchEvent(new CustomEvent('fly-to',{detail:{lat:${b.lat},lon:${b.lon}}}))"><i class="fa-solid fa-location-arrow"></i> Fly to Map</button></div>`;

      html += `
        <div class="br-card" data-brid="${b.id}" onclick="this.classList.toggle('expanded')">
          <div class="br-card-icon" style="background:${meta.color}22;color:${meta.color};">
            <i class="fa-solid ${meta.icon}"></i>
          </div>
          <div class="br-card-body">
            <div class="br-card-name">${b.name}</div>
            <div class="br-card-address">${b.address || b.street || ''}</div>
            <div class="br-card-tags">${tags}</div>
          </div>
          <div class="br-card-meta">
            <div class="br-card-distance">${b.distanceMiles < 0.1 ? (b.distanceMiles * 5280).toFixed(0) + ' ft' : b.distanceMiles.toFixed(1) + ' mi'}</div>
            <div class="br-card-walk"><i class="fa-solid fa-person-walking"></i> ${b.walkingMinutes} min</div>
            <div class="br-card-score">Score</div>
            <div class="br-score-bar"><div class="br-score-fill" style="width:${b.utilityScore}%;background:${scoreColor};"></div></div>
          </div>
          <div class="br-card-detail">${detail}</div>
        </div>`;
    }

    el.innerHTML = html;
  }

  function addBathroomMarkers(bathrooms) {
    // Clear old markers
    bathroomMarkers.forEach(m => state.map.removeLayer(m));
    bathroomMarkers = [];

    for (const b of bathrooms) {
      const meta = BATHROOM_TYPE_META[b.type] || BATHROOM_TYPE_META.unknown;
      const marker = L.circleMarker([b.lat, b.lon], {
        radius: 7,
        color: meta.color,
        fillColor: meta.color,
        fillOpacity: 0.8,
        weight: 2,
      });

      const tooltipHtml = `<b>${b.name}</b><br><span style="color:${meta.color}">${(BATHROOM_TYPE_META[b.type] || {}).icon ? b.type.replace('_', ' ') : 'Restroom'}</span><br>${b.distanceMiles.toFixed(1)} mi`;
      marker.bindTooltip(tooltipHtml, { className: 'custom-tooltip' });
      marker.addTo(state.map);
      bathroomMarkers.push(marker);
    }
  }

  function refilterBathrooms() {
    if (!lastBathroomData) return;
    const filters = getBathroomFilters();
    let filtered = [...lastBathroomData.bathrooms];

    // Apply type filter
    if (filters.types.length) {
      filtered = filtered.filter(b => filters.types.includes(b.type));
    }
    // Apply checkbox filters
    if (filters.accessible) filtered = filtered.filter(b => b.accessible);
    if (filters.free) filtered = filtered.filter(b => b.fee === false || b.fee === null);
    if (filters.open24h) filtered = filtered.filter(b => b.hours === '24/7');
    if (filters.showers) filtered = filtered.filter(b => b.hasShower);
    if (filters.water) filtered = filtered.filter(b => b.hasDrinkingWater);

    renderBathroomResults(filtered, $('#br-results'));
    addBathroomMarkers(filtered);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SURVIVAL RESOURCES FINDER
  // ═══════════════════════════════════════════════════════════════════
  let resourceMarkers = [];
  let lastResourceData = null;

  const RESOURCE_COLORS = {
    library:   '#8b5cf6', shower:    '#06b6d4', laundry:   '#f59e0b',
    community: '#ec4899', water:     '#3b82f6', food_bank: '#ef4444',
    social:    '#10b981', wifi:      '#a855f7',
    phone_charging: '#f97316', rest_area: '#64748b',
    bottle_return:  '#22c55e', clinic:    '#dc2626',
    homeless_shelter: '#7c3aed', hospital: '#be123c',
    pharmacy: '#0891b2', post_office: '#4338ca', thrift_store: '#a16207',
    public_bookcase: '#92400e', water_point: '#0284c7',
  };
  const RESOURCE_ICONS = {
    library:   'fa-book',        shower: 'fa-shower',      laundry:   'fa-shirt',
    community: 'fa-people-roof', water:  'fa-faucet-drip', food_bank: 'fa-utensils',
    social:    'fa-hand-holding-heart', wifi: 'fa-wifi',
    phone_charging: 'fa-plug', rest_area: 'fa-square-parking',
    bottle_return:  'fa-recycle', clinic: 'fa-kit-medical',
    homeless_shelter: 'fa-house-chimney', hospital: 'fa-hospital',
    pharmacy: 'fa-prescription', post_office: 'fa-envelope', thrift_store: 'fa-shirt',
    public_bookcase: 'fa-book-open', water_point: 'fa-faucet',
  };

  function clearResourceMarkers() {
    resourceMarkers.forEach(m => state.map.removeLayer(m));
    resourceMarkers = [];
  }

  function openResourcesModal() {
    show($('#resources-modal'));
  }

  async function searchResources() {
    const center = state.map ? state.map.getCenter() : { lat: 47.6062, lng: -122.3321 };
    const radiusMiles = parseInt($('#rs-radius')?.value || '5');
    const resultsEl = $('#rs-results');
    const summaryEl = $('#rs-summary');

    resultsEl.innerHTML = '<div class="rs-intro"><div class="spinner"></div><p>Searching OpenStreetMap for survival resources...</p></div>';
    summaryEl.classList.add('hidden');

    try {
      const result = await window.campAPI.findResources({
        lat: center.lat,
        lon: center.lng,
        radiusMiles,
      });

      if (result.error) {
        resultsEl.innerHTML = `<div class="rs-intro"><p style="color:#ef4444;">Error: ${result.error}</p></div>`;
        return;
      }

      lastResourceData = result;
      renderResourceSummary(result.counts, summaryEl);
      renderResourceResults(result.resources);
      addResourceMarkers(result.resources);
      toast(`Found ${result.total} resources nearby`, 'success');
    } catch (err) {
      resultsEl.innerHTML = `<div class="rs-intro"><p style="color:#ef4444;">Error: ${err.message}</p></div>`;
    }
  }

  function renderResourceSummary(counts, el) {
    const types = [
      { key: 'water', label: 'Water', icon: 'fa-faucet-drip' },
      { key: 'shower', label: 'Showers', icon: 'fa-shower' },
      { key: 'library', label: 'Libraries', icon: 'fa-book' },
      { key: 'laundry', label: 'Laundry', icon: 'fa-shirt' },
      { key: 'food_bank', label: 'Food Banks', icon: 'fa-utensils' },
      { key: 'community', label: 'Community', icon: 'fa-people-roof' },
      { key: 'wifi', label: 'Free WiFi', icon: 'fa-wifi' },
      { key: 'phone_charging', label: 'Charging', icon: 'fa-plug' },
      { key: 'rest_area', label: 'Rest Areas', icon: 'fa-square-parking' },
      { key: 'bottle_return', label: 'Bottle Return', icon: 'fa-recycle' },
      { key: 'clinic', label: 'Free Clinics', icon: 'fa-kit-medical' },
      { key: 'homeless_shelter', label: 'Shelters', icon: 'fa-house-chimney' },
      { key: 'hospital', label: 'Hospitals', icon: 'fa-hospital' },
      { key: 'pharmacy', label: 'Pharmacies', icon: 'fa-prescription' },
      { key: 'post_office', label: 'Post Offices', icon: 'fa-envelope' },
      { key: 'thrift_store', label: 'Thrift/Free', icon: 'fa-shirt' },
      { key: 'public_bookcase', label: 'Free Books', icon: 'fa-book-open' },
      { key: 'water_point', label: 'Water Points', icon: 'fa-faucet' },
    ];
    el.innerHTML = types.map(t => `
      <div class="rs-summary-card">
        <div class="rs-summary-count" style="color:${RESOURCE_COLORS[t.key] || '#94a3b8'}">${counts[t.key] || 0}</div>
        <div class="rs-summary-label"><i class="fa-solid ${t.icon}"></i> ${t.label}</div>
      </div>
    `).join('');
    el.classList.remove('hidden');
  }

  function renderResourceResults(resources) {
    const el = $('#rs-results');
    const activeType = document.querySelector('.rs-type-btn.active');
    const filter = (activeType && activeType.dataset.rstype !== 'all') ? activeType.dataset.rstype : null;

    const filtered = filter ? resources.filter(r => r.resourceType === filter) : resources;

    if (!filtered.length) {
      el.innerHTML = '<div class="rs-intro"><p class="muted-text">No resources found matching your filters. Try expanding the search radius.</p></div>';
      return;
    }

    let html = '';
    for (const r of filtered) {
      const color = RESOURCE_COLORS[r.resourceType] || '#94a3b8';
      const icon = RESOURCE_ICONS[r.resourceType] || 'fa-circle';

      let tags = `<span class="rs-tag" style="background:${color}22;color:${color}"><i class="fa-solid ${icon}"></i> ${r.typeLabel}</span>`;
      if (r.fee === false) tags += '<span class="rs-tag"><i class="fa-solid fa-hand-holding-heart"></i> Free</span>';
      if (r.fee === true) tags += '<span class="rs-tag"><i class="fa-solid fa-dollar-sign"></i> Fee</span>';
      if (r.wheelchair) tags += '<span class="rs-tag"><i class="fa-solid fa-wheelchair"></i> Accessible</span>';
      if (r.hours) tags += `<span class="rs-tag"><i class="fa-solid fa-clock"></i> ${r.hours.length > 30 ? r.hours.slice(0, 30) + '...' : r.hours}</span>`;
      for (const a of r.amenities.slice(0, 4)) {
        tags += `<span class="rs-tag"><i class="fa-solid fa-check"></i> ${a}</span>`;
      }

      const desc = r.description.length > 150 ? r.description.slice(0, 150) + '...' : r.description;

      html += `
        <div class="rs-card" data-rsid="${r.id}" onclick="window.dispatchEvent(new CustomEvent('fly-to',{detail:{lat:${r.lat},lon:${r.lon}}}))">
          <div class="rs-card-icon" style="background:${color}22;color:${color};">
            <i class="fa-solid ${icon}"></i>
          </div>
          <div>
            <div class="rs-card-name">${r.name}</div>
            <div class="rs-card-sub">${tags}</div>
            <div class="rs-card-desc">${desc}</div>
          </div>
          <div class="rs-card-dist">${r.distanceMiles.toFixed(1)} mi</div>
        </div>`;
    }

    el.innerHTML = html;
  }

  function addResourceMarkers(resources) {
    clearResourceMarkers();
    for (const r of resources) {
      const color = RESOURCE_COLORS[r.resourceType] || '#94a3b8';
      const icon = RESOURCE_ICONS[r.resourceType] || 'fa-circle';
      const marker = L.marker([r.lat, r.lon], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"><i class="fa-solid ${icon}"></i></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(state.map);
      marker.bindPopup(`<b>${r.name}</b><br>${r.typeLabel}<br>${r.distanceMiles.toFixed(1)} mi`);
      resourceMarkers.push(marker);
    }
  }

  function refilterResources() {
    if (!lastResourceData) return;
    renderResourceResults(lastResourceData.resources);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BRIDGE SHELTER FINDER
  // ═══════════════════════════════════════════════════════════════════
  const BRIDGE_CAT_META = {
    water:    { icon: 'fa-water',          color: '#3b82f6', label: 'Over Water' },
    road:     { icon: 'fa-road',           color: '#6366f1', label: 'Over Road' },
    railroad: { icon: 'fa-train',          color: '#f59e0b', label: 'Over Railroad' },
    path:     { icon: 'fa-person-walking', color: '#22c55e', label: 'Over Path' },
    other:    { icon: 'fa-bridge',         color: '#94a3b8', label: 'Other' },
  };

  let bridgeMarkers = [];
  let lastBridgeData = null;

  function openBridgesModal() {
    show($('#bridges-modal'));
  }

  function getBridgeFilters() {
    const activeType = document.querySelector('.bg-type-btn.active');
    const category = (activeType && activeType.dataset.bgtype !== 'all') ? activeType.dataset.bgtype : 'all';
    const sortBy = $('#bg-sort')?.value || 'distance';
    const minScore = parseInt($('#bg-min-score')?.value || '0');
    return { category, sortBy, minScore };
  }

  async function searchBridges() {
    const center = state.map ? state.map.getCenter() : { lat: 47.6062, lng: -122.3321 };
    const radiusMiles = parseInt($('#bg-radius')?.value || '5');
    const filters = getBridgeFilters();
    const resultsEl = $('#bg-results');
    const summaryEl = $('#bg-summary');

    resultsEl.innerHTML = '<div class="bg-loading"><div class="spinner"></div><p>Scanning FHWA Bridge Inventory & OpenStreetMap...</p></div>';
    summaryEl.classList.add('hidden');

    try {
      const result = await window.campAPI.findBridges({
        lat: center.lat,
        lon: center.lng,
        radiusMiles,
        filters,
      });

      if (result.error) {
        resultsEl.innerHTML = `<div class="bg-intro"><p style="color:#ef4444;">Error: ${result.error}</p></div>`;
        return;
      }

      lastBridgeData = result;
      renderBridgeSummary(result.summary, summaryEl);
      renderBridgeResults(result.bridges, resultsEl);
      addBridgeMarkers(result.bridges);
      toast(`Found ${result.summary.total} bridges nearby`, 'success');
    } catch (err) {
      resultsEl.innerHTML = `<div class="bg-intro"><p style="color:#ef4444;">Error: ${err.message}</p></div>`;
    }
  }

  function renderBridgeSummary(summary, el) {
    el.innerHTML = `
      <div class="bg-summary-card"><div class="bg-count">${summary.total}</div><div class="bg-label">Total</div></div>
      <div class="bg-summary-card"><div class="bg-count" style="color:#3b82f6">${summary.overWater}</div><div class="bg-label">Over Water</div></div>
      <div class="bg-summary-card"><div class="bg-count" style="color:#6366f1">${summary.overRoad}</div><div class="bg-label">Over Road</div></div>
      <div class="bg-summary-card"><div class="bg-count" style="color:#f59e0b">${summary.overRail}</div><div class="bg-label">Over Rail</div></div>
      <div class="bg-summary-card"><div class="bg-count" style="color:#22c55e">${summary.highScore}</div><div class="bg-label">High Score</div></div>
    `;
    el.classList.remove('hidden');
  }

  function renderBridgeResults(bridges, el) {
    if (!bridges.length) {
      el.innerHTML = '<div class="bg-intro"><p class="muted-text">No bridges found matching your filters. Try expanding the search radius or removing filters.</p></div>';
      return;
    }

    let html = '';
    for (const b of bridges) {
      const catMeta = BRIDGE_CAT_META[b.underCategory] || BRIDGE_CAT_META.other;
      const scoreColor = b.shelterScore >= 70 ? '#22c55e' : b.shelterScore >= 40 ? '#f59e0b' : '#ef4444';
      const scoreClass = b.shelterScore >= 70 ? 'score-high' : b.shelterScore >= 40 ? 'score-mid' : 'score-low';

      // Tags
      let tags = `<span class="bg-tag ${b.underCategory === 'water' ? 'water' : b.underCategory === 'road' ? 'road' : b.underCategory === 'railroad' ? 'rail' : b.underCategory === 'path' ? 'path' : ''}"><i class="fa-solid ${catMeta.icon}"></i> ${b.serviceUnder}</span>`;
      if (b.lengthMeters > 0) tags += `<span class="bg-tag"><i class="fa-solid fa-ruler-horizontal"></i> ${b.lengthFeet} ft</span>`;
      if (b.widthMeters > 0) tags += `<span class="bg-tag"><i class="fa-solid fa-arrows-left-right"></i> ${b.widthFeet} ft wide</span>`;
      if (b.clearanceFeet) tags += `<span class="bg-tag"><i class="fa-solid fa-arrows-up-down"></i> ${b.clearanceFeet} ft clear</span>`;
      if (b.material) tags += `<span class="bg-tag"><i class="fa-solid fa-cubes"></i> ${b.material}</span>`;
      if (b.yearBuilt) tags += `<span class="bg-tag"><i class="fa-solid fa-calendar"></i> ${b.yearBuilt}</span>`;
      tags += `<span class="bg-tag ${scoreClass}"><i class="fa-solid fa-star"></i> Shelter: ${b.shelterScore}</span>`;

      // Detail section (expanded)
      let detail = '';
      if (b.featureCrossed) detail += `<div class="bg-detail-row"><i class="fa-solid fa-water"></i><span>Crosses: ${b.featureCrossed}</span></div>`;
      if (b.facilityCarried) detail += `<div class="bg-detail-row"><i class="fa-solid fa-road"></i><span>Carries: ${b.facilityCarried}</span></div>`;
      if (b.location) detail += `<div class="bg-detail-row"><i class="fa-solid fa-location-dot"></i><span>${b.location}</span></div>`;
      if (b.owner) detail += `<div class="bg-detail-row"><i class="fa-solid fa-building"></i><span>Owner: ${b.owner}</span></div>`;
      if (b.structureType && b.structureType !== 'Unknown') detail += `<div class="bg-detail-row"><i class="fa-solid fa-archway"></i><span>Type: ${b.structureType}</span></div>`;
      if (b.underDescription) detail += `<div class="bg-detail-row"><i class="fa-solid fa-circle-info"></i><span>${b.underDescription}</span></div>`;
      detail += `<div class="bg-detail-row"><i class="fa-solid fa-database"></i><span>Source: ${b.source === 'nbi' ? 'FHWA National Bridge Inventory' : 'OpenStreetMap'}${b.structureNumber ? ' (#' + b.structureNumber + ')' : ''}</span></div>`;
      detail += `<div class="bg-detail-actions"><button class="bg-action-btn" onclick="event.stopPropagation();window.dispatchEvent(new CustomEvent('fly-to',{detail:{lat:${b.lat},lon:${b.lon}}}))"><i class="fa-solid fa-location-arrow"></i> Fly to Map</button></div>`;

      html += `
        <div class="bg-card" data-bgid="${b.id}" onclick="this.classList.toggle('expanded')">
          <div class="bg-card-icon" style="background:${catMeta.color}22;color:${catMeta.color};">
            <i class="fa-solid ${catMeta.icon}"></i>
          </div>
          <div class="bg-card-body">
            <div class="bg-card-name">${b.name}</div>
            <div class="bg-card-sub">${tags}</div>
          </div>
          <div class="bg-card-score">
            <div class="bg-score-num" style="color:${scoreColor}">${b.shelterScore}</div>
            <div class="bg-score-label">Shelter</div>
            <div class="bg-score-bar"><div class="bg-score-fill" style="width:${b.shelterScore}%;background:${scoreColor};"></div></div>
            <div style="font-size:0.65rem;color:var(--text-secondary);margin-top:0.2rem;"><i class="fa-solid fa-person-walking"></i> ${b.walkingMinutes} min</div>
            <div style="font-size:0.65rem;color:var(--text-secondary);">${b.distanceMiles.toFixed(1)} mi</div>
          </div>
          <div class="bg-card-detail">${detail}</div>
        </div>`;
    }

    el.innerHTML = html;
  }

  function addBridgeMarkers(bridges) {
    bridgeMarkers.forEach(m => state.map.removeLayer(m));
    bridgeMarkers = [];

    for (const b of bridges) {
      const catMeta = BRIDGE_CAT_META[b.underCategory] || BRIDGE_CAT_META.other;
      const marker = L.circleMarker([b.lat, b.lon], {
        radius: 7 + Math.min(b.shelterScore / 20, 3),
        color: catMeta.color,
        fillColor: catMeta.color,
        fillOpacity: 0.75,
        weight: 2,
      });

      const tooltipHtml = `<b>${b.name}</b><br><span style="color:${catMeta.color}"><i class="fa-solid ${catMeta.icon}"></i> ${b.serviceUnder}</span><br>Shelter Score: ${b.shelterScore}<br>${b.distanceMiles.toFixed(1)} mi`;
      marker.bindTooltip(tooltipHtml, { className: 'custom-tooltip' });
      marker.addTo(state.map);
      bridgeMarkers.push(marker);
    }
  }

  function refilterBridges() {
    if (!lastBridgeData) return;
    const filters = getBridgeFilters();
    let filtered = [...lastBridgeData.bridges];

    // Apply category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(b => b.category === filters.category);
    }
    // Apply min score
    if (filters.minScore > 0) {
      filtered = filtered.filter(b => b.shelterScore >= filters.minScore);
    }
    // Apply sort
    if (filters.sortBy === 'score') {
      filtered.sort((a, b) => b.shelterScore - a.shelterScore);
    } else {
      filtered.sort((a, b) => a.distanceMiles - b.distanceMiles);
    }

    renderBridgeResults(filtered, $('#bg-results'));
    addBridgeMarkers(filtered);
  }

  // ═══════════════════════════════════════════════════════════════════
  // THEME
  // ═══════════════════════════════════════════════════════════════════
  function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);

    // Swap map tiles
    if (state.map) {
      if (state.satelliteOn) return; // satellite stays
      if (next === 'light') {
        state.map.removeLayer(state.darkTiles);
        state.map.addLayer(state.lightTiles);
      } else {
        state.map.removeLayer(state.lightTiles);
        state.map.addLayer(state.darkTiles);
      }
    }

    const icon = next === 'dark' ? 'fa-moon' : 'fa-sun';
    $('#btn-theme').innerHTML = `<i class="fa-solid ${icon}"></i>`;

    window.campAPI.saveUserData({ settings: { ...state.userData.settings, theme: next } });
    toast(`Switched to ${next} mode`, 'info');
  }

  // ═══════════════════════════════════════════════════════════════════
  // CUSTOM SPOT
  // ═══════════════════════════════════════════════════════════════════
  let pendingSpotPhotos = []; // Array of { src: base64DataUrl, filePath: string|null, buffer: Uint8Array|null, ext: string }

  function renderSpotPhotosGrid() {
    const grid = $('#spot-photos-grid');
    if (!grid) return;
    if (pendingSpotPhotos.length === 0) {
      grid.innerHTML = '';
      return;
    }
    grid.innerHTML = pendingSpotPhotos.map((p, i) => `
      <div class="spot-photo-thumb" data-photo-idx="${i}">
        <img src="${p.src}" alt="Photo ${i + 1}">
        <button type="button" class="spot-photo-remove" data-photo-idx="${i}" title="Remove photo"><i class="fa-solid fa-xmark"></i></button>
      </div>
    `).join('');
    grid.querySelectorAll('.spot-photo-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.photoIdx);
        pendingSpotPhotos.splice(idx, 1);
        renderSpotPhotosGrid();
      });
    });
  }

  async function attachSpotPhotos() {
    try {
      const result = await window.campAPI.pickPhotosDialog();
      if (result.canceled || !result.filePaths?.length) return;

      for (const fp of result.filePaths) {
        const photoData = await window.campAPI.readSpotPhoto(fp);
        if (photoData.success) {
          pendingSpotPhotos.push({ src: photoData.dataUrl, filePath: fp, buffer: null, ext: null });
        }
      }
      renderSpotPhotosGrid();
    } catch (e) {
      toast('Failed to attach photos: ' + e.message, 'error');
    }
  }

  async function takeSpotPhoto() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });

      // Create camera overlay
      const overlay = document.createElement('div');
      overlay.className = 'camera-overlay';
      overlay.innerHTML = `
        <div class="camera-container">
          <video id="camera-preview" autoplay playsinline></video>
          <div class="camera-controls">
            <button class="camera-btn cancel" id="camera-cancel"><i class="fa-solid fa-xmark"></i> Cancel</button>
            <button class="camera-btn capture" id="camera-capture"><i class="fa-solid fa-camera"></i></button>
            <button class="camera-btn switch" id="camera-switch"><i class="fa-solid fa-rotate"></i></button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const video = overlay.querySelector('#camera-preview');
      video.srcObject = stream;

      let currentFacing = 'environment';

      overlay.querySelector('#camera-cancel').addEventListener('click', () => {
        stream.getTracks().forEach(t => t.stop());
        overlay.remove();
      });

      overlay.querySelector('#camera-switch').addEventListener('click', async () => {
        stream.getTracks().forEach(t => t.stop());
        currentFacing = currentFacing === 'environment' ? 'user' : 'environment';
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacing, width: { ideal: 1920 }, height: { ideal: 1080 } } });
          video.srcObject = newStream;
          // Update reference for cleanup
          stream.getTracks().forEach(() => {}); // old tracks already stopped
          Object.assign(stream, { _tracks: newStream.getTracks() });
          overlay.querySelector('#camera-cancel').addEventListener('click', () => {
            newStream.getTracks().forEach(t => t.stop());
          }, { once: true });
          overlay.querySelector('#camera-capture').onclick = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            newStream.getTracks().forEach(t => t.stop());
            overlay.remove();
            // Convert to buffer for storage
            const base64 = dataUrl.split(',')[1];
            const binary = atob(base64);
            const buf = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
            pendingSpotPhotos.push({ src: dataUrl, filePath: null, buffer: Array.from(buf), ext: '.jpg' });
            renderSpotPhotosGrid();
            toast('Photo captured!', 'success');
          };
        } catch (e) {
          toast('Could not switch camera', 'error');
        }
      });

      overlay.querySelector('#camera-capture').addEventListener('click', async () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        stream.getTracks().forEach(t => t.stop());
        overlay.remove();
        // Convert to buffer for storage
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const buf = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
        pendingSpotPhotos.push({ src: dataUrl, filePath: null, buffer: Array.from(buf), ext: '.jpg' });
        renderSpotPhotosGrid();
        toast('Photo captured!', 'success');
      });
    } catch (e) {
      toast('Camera not available: ' + e.message, 'error');
    }
  }

  async function addCustomSpot(e) {
    e.preventDefault();
    const name = $('#spot-name').value.trim();
    const lat = parseFloat($('#spot-lat').value);
    const lon = parseFloat($('#spot-lon').value);
    const desc = $('#spot-desc').value.trim();
    const type = $('#spot-type').value;
    const stealth = parseInt($('#spot-stealth').value);

    if (!name || isNaN(lat) || isNaN(lon)) {
      toast('Please fill in name and valid coordinates', 'error');
      return;
    }

    // Save attached photos to disk
    const savedPhotoPaths = [];
    for (const photo of pendingSpotPhotos) {
      if (photo.filePath) {
        // File from disk — copy to app storage
        const result = await window.campAPI.saveSpotPhotos({ filePaths: [photo.filePath] });
        if (result.success) savedPhotoPaths.push(...result.photos);
      } else if (photo.buffer) {
        // Camera capture — save buffer
        const result = await window.campAPI.saveSpotPhotoBuffer({ buffer: photo.buffer, ext: photo.ext });
        if (result.success) savedPhotoPaths.push(result.photo);
      }
    }

    const loc = { name, lat, lon, description: desc, type, stealthRating: stealth, photos: savedPhotoPaths };
    const result = await window.campAPI.addCustomLocation(loc);

    if (result.success) {
      toast(`Custom spot "${name}" added!`, 'info');
      hide($('#add-spot-modal'));
      $('#add-spot-form').reset();
      pendingSpotPhotos = [];
      renderSpotPhotosGrid();
      try { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); } catch (e) {}
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHOTO VIEWER (Detail Panel + Lightbox)
  // ═══════════════════════════════════════════════════════════════════
  async function loadDetailPhotos(photoPaths) {
    const grid = $('#detail-photos-grid');
    if (!grid) return;

    const thumbs = [];
    for (const fp of photoPaths) {
      const result = await window.campAPI.readSpotPhoto(fp);
      if (result.success) {
        thumbs.push(result.dataUrl);
      }
    }

    if (thumbs.length === 0) {
      grid.innerHTML = '<p class="muted-text">Photos unavailable</p>';
      return;
    }

    grid.innerHTML = thumbs.map((src, i) => `
      <div class="detail-photo-thumb" data-lightbox-idx="${i}">
        <img src="${src}" alt="Photo ${i + 1}" loading="lazy">
      </div>
    `).join('');

    // Click to open lightbox
    grid.querySelectorAll('.detail-photo-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const idx = parseInt(thumb.dataset.lightboxIdx);
        openPhotoLightbox(thumbs, idx);
      });
    });
  }

  function openPhotoLightbox(photos, startIdx) {
    let currentIdx = startIdx;

    const overlay = document.createElement('div');
    overlay.className = 'photo-lightbox-overlay';
    overlay.innerHTML = `
      <div class="photo-lightbox">
        <button class="lightbox-close" title="Close"><i class="fa-solid fa-xmark"></i></button>
        <button class="lightbox-prev" title="Previous"><i class="fa-solid fa-chevron-left"></i></button>
        <div class="lightbox-img-wrap">
          <img class="lightbox-img" src="${photos[currentIdx]}" alt="Photo">
          <div class="lightbox-counter">${currentIdx + 1} / ${photos.length}</div>
        </div>
        <button class="lightbox-next" title="Next"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
    `;
    document.body.appendChild(overlay);

    const img = overlay.querySelector('.lightbox-img');
    const counter = overlay.querySelector('.lightbox-counter');
    const prevBtn = overlay.querySelector('.lightbox-prev');
    const nextBtn = overlay.querySelector('.lightbox-next');

    function updateLightbox() {
      img.src = photos[currentIdx];
      counter.textContent = `${currentIdx + 1} / ${photos.length}`;
      prevBtn.style.display = photos.length > 1 ? '' : 'none';
      nextBtn.style.display = photos.length > 1 ? '' : 'none';
    }

    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentIdx = (currentIdx - 1 + photos.length) % photos.length;
      updateLightbox();
    });

    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentIdx = (currentIdx + 1) % photos.length;
      updateLightbox();
    });

    overlay.querySelector('.lightbox-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Keyboard navigation
    const keyHandler = (e) => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', keyHandler); }
      if (e.key === 'ArrowLeft') { currentIdx = (currentIdx - 1 + photos.length) % photos.length; updateLightbox(); }
      if (e.key === 'ArrowRight') { currentIdx = (currentIdx + 1) % photos.length; updateLightbox(); }
    };
    document.addEventListener('keydown', keyHandler);

    updateLightbox();
  }

  // ═══════════════════════════════════════════════════════════════════
  // WEATHER MODAL
  // ═══════════════════════════════════════════════════════════════════
  async function showWeatherModal() {
    show($('#weather-modal'));
    if (!state.searchCenter) {
      $('#weather-modal-body').innerHTML = '<p class="muted-text"><i class="fa-solid fa-info-circle"></i> Search for a location first to see detailed weather data.</p>';
      return;
    }

    $('#weather-modal-body').innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p class="loading-text">Loading weather...</p></div>';

    try {
      const w = await window.campAPI.getWeather({ lat: state.searchCenter.lat, lon: state.searchCenter.lon });
      if (w.error) throw new Error(w.error);

      let html = `<h3 style="margin-bottom:12px"><i class="fa-solid fa-location-dot" style="color:var(--green)"></i> Weather near ${state.searchCenter.name || 'Search Area'}</h3>`;

      // Current conditions
      if (w.current) {
        html += `
          <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
            <div class="stat-card"><i class="fa-solid fa-${w.current.icon || 'temperature-half'}" style="color:var(--green)"></i><span class="stat-value" style="font-size:22px">${w.current.temperature}°F</span><span class="stat-label">${w.current.description}</span></div>
            <div class="stat-card"><i class="fa-solid fa-temperature-arrow-down"></i><span class="stat-value" style="font-size:16px">Feels ${w.current.feelsLike}°F</span><span class="stat-label">Feels Like</span></div>
            <div class="stat-card"><i class="fa-solid fa-wind"></i><span class="stat-value" style="font-size:16px">${w.current.windSpeed} mph</span><span class="stat-label">Wind${w.current.windGusts ? ` (gusts ${w.current.windGusts})` : ''}</span></div>
            <div class="stat-card"><i class="fa-solid fa-droplet"></i><span class="stat-value" style="font-size:16px">${w.current.humidity}%</span><span class="stat-label">Humidity</span></div>
          </div>`;
      }

      // Sun & Moon
      html += `<div class="detail-section" style="margin-bottom:16px">
        <h3><i class="fa-solid fa-sun" style="color:var(--amber)"></i> Sun & Moon</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">`;
      if (w.sun) {
        html += `
          <div class="detail-info-row"><span class="label"><i class="fa-solid fa-sun" style="color:#f59e0b"></i> Sunrise</span><span class="value">${w.sun.sunrise ? formatTime(w.sun.sunrise) : 'N/A'}</span></div>
          <div class="detail-info-row"><span class="label"><i class="fa-solid fa-moon" style="color:#6366f1"></i> Sunset</span><span class="value">${w.sun.sunset ? formatTime(w.sun.sunset) : 'N/A'}</span></div>`;
        if (w.sun.uvIndex != null) html += `<div class="detail-info-row"><span class="label"><i class="fa-solid fa-sun" style="color:#ef4444"></i> UV Index</span><span class="value">${w.sun.uvIndex}</span></div>`;
      }
      if (w.moon) {
        html += `
          <div class="detail-info-row"><span class="label">Moon</span><span class="value">${w.moon.emoji || ''} ${w.moon.name || ''}</span></div>
          <div class="detail-info-row"><span class="label">Illumination</span><span class="value">${w.moon.illumination != null ? Math.round(w.moon.illumination * 100) + '%' : 'N/A'}</span></div>
          <div class="detail-info-row"><span class="label">Stealth Rating</span><span class="value">${w.moon.stealthRating || ''}</span></div>`;
      }
      html += `</div></div>`;

      // Alerts
      if (w.alerts?.length) {
        html += `<div class="detail-section" style="margin-bottom:16px"><h3><i class="fa-solid fa-triangle-exclamation" style="color:var(--red)"></i> Active Alerts (${w.alerts.length})</h3>`;
        w.alerts.forEach(a => {
          html += `<div class="reddit-post" style="border-color:rgba(239,68,68,0.3)"><div class="reddit-post-title" style="color:var(--red)">${a.headline || a.event}</div><div class="reddit-post-body">${truncate(a.description, 300)}</div></div>`;
        });
        html += `</div>`;
      }

      // 7-Day Forecast
      if (w.daily?.length) {
        html += `<div class="detail-section" style="margin-bottom:16px"><h3><i class="fa-solid fa-calendar-week" style="color:var(--green)"></i> 7-Day Forecast</h3>`;
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;">`;
        w.daily.forEach((day, i) => {
          const dateStr = day.date ? dayjs(day.date).format('ddd M/D') : `Day ${i + 1}`;
          html += `
            <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center;">
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600;">${dateStr}</div>
              <div style="font-size:20px;margin:4px 0;"><i class="fa-solid ${day.icon}" style="color:var(--green)"></i></div>
              <div style="font-size:10px;color:var(--text-secondary);margin-bottom:4px;">${day.description}</div>
              <div style="font-weight:700;color:var(--text-primary);font-size:14px;">${day.tempHigh}° <span style="color:var(--text-muted);font-weight:400;font-size:12px;">/ ${day.tempLow}°</span></div>
              <div style="font-size:9px;color:var(--text-muted);margin-top:4px;">
                ${day.precipChance > 0 ? `<i class="fa-solid fa-droplet"></i> ${day.precipChance}%` : ''}
                <i class="fa-solid fa-wind"></i> ${day.windMax}mph
              </div>
            </div>`;
        });
        html += `</div></div>`;
      }

      // 24h Hourly mini-chart (temperature line)
      if (w.hourly?.length >= 12) {
        html += `<div class="detail-section"><h3><i class="fa-solid fa-clock" style="color:var(--cyan)"></i> Hourly (Next 24h)</h3>`;
        html += `<div style="display:flex;gap:2px;overflow-x:auto;padding:8px 0;">`;
        w.hourly.slice(0, 24).forEach((hr, i) => {
          if (i % 3 !== 0) return; // show every 3 hours
          const t = hr.time ? dayjs(hr.time).format('ha') : '';
          const barH = Math.max(4, Math.min(60, (hr.temp - 30) * 1.5));
          html += `
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px;min-width:38px;">
              <span style="font-size:10px;color:var(--text-primary);font-weight:600;">${hr.temp}°</span>
              <div style="width:20px;height:${barH}px;background:var(--green);border-radius:3px;opacity:0.7;"></div>
              <i class="fa-solid ${hr.icon}" style="font-size:10px;color:var(--text-muted)"></i>
              <span style="font-size:9px;color:var(--text-muted)">${t}</span>
              ${hr.precipChance > 0 ? `<span style="font-size:8px;color:var(--blue)">${hr.precipChance}%</span>` : ''}
            </div>`;
        });
        html += `</div></div>`;
      }

      // Detailed forecast text
      if (w.forecast?.detailedForecast) {
        html += `<div class="detail-section"><h3><i class="fa-solid fa-align-left"></i> Summary</h3><p style="font-size:12px;color:var(--text-secondary);line-height:1.6;">${w.forecast.detailedForecast}</p></div>`;
      }

      $('#weather-modal-body').innerHTML = html;
    } catch (e) {
      $('#weather-modal-body').innerHTML = `<div class="muted-text"><i class="fa-solid fa-triangle-exclamation"></i> ${e.message}</div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════
  function setFooterStatus(html) {
    $('#footer-status').innerHTML = html;
  }

  // Zoom indicator
  let zoomIndicatorTimer;
  function showZoomIndicator(level) {
    let el = $('.zoom-indicator');
    if (!el) {
      el = document.createElement('div');
      el.className = 'zoom-indicator';
      document.body.appendChild(el);
    }
    const pct = Math.round((level || 0) * 50 + 100);
    el.textContent = `Zoom: ${pct}%`;
    el.classList.add('visible');
    clearTimeout(zoomIndicatorTimer);
    zoomIndicatorTimer = setTimeout(() => el.classList.remove('visible'), 1500);
  }

  // Maximize icon toggle (square vs restore)
  async function updateMaximizeIcon() {
    try {
      const isMax = await window.campAPI.windowIsMaximized();
      const btn = $('#btn-win-maximize');
      if (btn) {
        btn.querySelector('i').className = isMax ? 'fa-regular fa-clone' : 'fa-regular fa-square';
        btn.title = isMax ? 'Restore' : 'Maximize';
      }
    } catch (e) {}
  }
  // Update on window resize (covers system maximize/unmaximize)
  window.addEventListener('resize', () => { clearTimeout(window._maxTimer); window._maxTimer = setTimeout(updateMaximizeIcon, 100); });

  // ═══════════════════════════════════════════════════════════════════
  // TRIP PLANNER
  // ═══════════════════════════════════════════════════════════════════
  let tripData = { startDate: null, nights: [] };

  async function openTripModal() {
    show($('#trip-modal'));
    try {
      const saved = await window.campAPI.getTripData();
      if (saved && saved.nights?.length) {
        tripData = saved;
        if (tripData.startDate) $('#trip-start-date').value = tripData.startDate;
        if (tripData.nights.length) $('#trip-num-nights').value = tripData.nights.length;
        renderTripTimeline();
      }
    } catch (e) { console.warn('Trip load error:', e); }
  }

  function generateTrip() {
    const startDate = $('#trip-start-date').value;
    const numNights = parseInt($('#trip-num-nights').value) || 3;

    if (!startDate) {
      toast('Please select a start date', 'warn');
      return;
    }

    tripData.startDate = startDate;
    tripData.nights = [];
    for (let i = 0; i < numNights; i++) {
      const date = dayjs(startDate).add(i, 'day').format('YYYY-MM-DD');
      // Keep existing locations if regenerating
      tripData.nights.push({
        nightNum: i + 1,
        date,
        location: null,
        weather: null,
      });
    }
    renderTripTimeline();
    saveTripData();
  }

  function renderTripTimeline() {
    const timeline = $('#trip-timeline');
    if (!tripData.nights?.length) {
      timeline.innerHTML = `<div class="trip-intro">
        <div class="trip-intro-icon"><i class="fa-solid fa-route fa-2x"></i></div>
        <h3>Plan Your Trip</h3>
        <p>Set your start date and number of nights, then assign camp spots to each night. See weather forecasts, moon phase, and travel info for each stop.</p>
      </div>`;
      return;
    }

    let html = '';
    tripData.nights.forEach((night, idx) => {
      const dateStr = night.date ? dayjs(night.date).format('ddd, MMM D') : '';
      const dayName = night.date ? dayjs(night.date).format('ddd') : '';

      // Location display
      let locationHtml;
      if (night.location) {
        locationHtml = `
          <div class="trip-location-slot">
            <button class="trip-assign-btn assigned" data-night="${idx}" title="Click to change">
              <i class="fa-solid fa-campground" style="color:var(--green);margin-right:4px;"></i>
              <strong>${night.location.name}</strong>
              ${night.location.type ? `<span style="color:var(--text-muted);margin-left:6px;">(${night.location.type})</span>` : ''}
            </button>
            <button class="trip-clear-btn" data-night="${idx}" title="Remove location"><i class="fa-solid fa-xmark"></i></button>
          </div>`;
      } else {
        locationHtml = `
          <div class="trip-location-slot">
            <button class="trip-assign-btn" data-night="${idx}" title="Click to assign a camp spot">
              <i class="fa-solid fa-plus" style="margin-right:4px;"></i> Assign a camp spot...
            </button>
          </div>`;
      }

      // Weather display
      let weatherHtml = '';
      if (night.weather && !night.weather.error) {
        const w = night.weather;
        const daily = w.daily?.find(d => d.date === night.date) || w.daily?.[0];
        if (daily) {
          weatherHtml = `
            <div class="trip-night-weather">
              <i class="fa-solid ${daily.icon}"></i>
              <span class="trip-weather-temp">${daily.tempHigh}°/${daily.tempLow}°</span>
              <span class="trip-weather-desc">${daily.description}</span>
              ${daily.precipChance > 0 ? `<span class="trip-weather-detail"><i class="fa-solid fa-droplet" style="color:var(--blue)"></i> ${daily.precipChance}%</span>` : ''}
              <span class="trip-weather-detail"><i class="fa-solid fa-wind"></i> ${daily.windMax}mph</span>
            </div>`;
        } else if (w.current) {
          weatherHtml = `
            <div class="trip-night-weather">
              <i class="fa-solid ${w.current.icon}"></i>
              <span class="trip-weather-temp">${w.current.temperature}°F</span>
              <span class="trip-weather-desc">${w.current.description}</span>
            </div>`;
        }
        // Moon info
        if (w.moon) {
          weatherHtml += `<div class="trip-night-moon">${w.moon.emoji} ${w.moon.name} — ${w.moon.stealthRating}</div>`;
        }
      } else if (night.location) {
        weatherHtml = `<div class="trip-weather-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading weather...</div>`;
      } else {
        weatherHtml = `<div class="trip-weather-loading">Assign a location to see weather</div>`;
      }

      html += `
        <div class="trip-night-card" data-night="${idx}">
          <div class="trip-night-badge">
            <span class="trip-night-num">${night.nightNum}</span>
            <span class="trip-night-day">${dayName}</span>
            <span class="trip-night-date">${night.date ? dayjs(night.date).format('M/D') : ''}</span>
          </div>
          <div class="trip-night-body">
            ${locationHtml}
            ${weatherHtml}
          </div>
        </div>`;
    });

    timeline.innerHTML = html;

    // Bind assign buttons
    timeline.querySelectorAll('.trip-assign-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openTripPicker(parseInt(btn.dataset.night));
      });
    });

    // Bind clear buttons
    timeline.querySelectorAll('.trip-clear-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.night);
        tripData.nights[idx].location = null;
        tripData.nights[idx].weather = null;
        renderTripTimeline();
        saveTripData();
      });
    });

    // Fetch weather for nights that have locations but no weather
    tripData.nights.forEach((night, idx) => {
      if (night.location && !night.weather) {
        fetchTripNightWeather(idx);
      }
    });
  }

  function openTripPicker(nightIdx) {
    // Close any existing pickers
    $$('.trip-picker').forEach(p => p.remove());

    // Build a list of locations from: favorites, search results, custom spots
    const candidates = [];

    // Add favorites
    state.locations.filter(l => state.favorites.includes(makeId(l))).forEach(l => {
      candidates.push({ ...l, _source: 'Favorite' });
    });

    // Add search results (non-duplicates)
    state.locations.forEach(l => {
      if (!candidates.some(c => c.name === l.name && c.lat === l.lat)) {
        candidates.push({ ...l, _source: 'Search' });
      }
    });

    if (!candidates.length) {
      toast('Search for locations or add favorites first!', 'warn');
      return;
    }

    const card = $(`.trip-night-card[data-night="${nightIdx}"]`);
    if (!card) return;

    const picker = document.createElement('div');
    picker.className = 'trip-picker';

    candidates.slice(0, 20).forEach(loc => {
      const item = document.createElement('div');
      item.className = 'trip-picker-item';
      const tc = typeClass(loc);
      item.innerHTML = `<i class="fa-solid ${typeIcon(tc)}"></i> <span>${loc.name}</span> <span style="color:var(--text-muted);font-size:10px;margin-left:auto;">${loc._source}</span>`;
      item.addEventListener('click', () => {
        tripData.nights[nightIdx].location = {
          name: loc.name,
          type: loc.type,
          lat: loc.lat,
          lon: loc.lon,
        };
        tripData.nights[nightIdx].weather = null;
        picker.remove();
        renderTripTimeline();
        saveTripData();
      });
      picker.appendChild(item);
    });

    // Position the picker
    const slotEl = card.querySelector('.trip-location-slot');
    if (slotEl) {
      slotEl.style.position = 'relative';
      slotEl.appendChild(picker);
    }

    // Close picker on outside click
    const closeHandler = (e) => {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', closeHandler, true);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler, true), 50);
  }

  async function fetchTripNightWeather(nightIdx) {
    const night = tripData.nights[nightIdx];
    if (!night?.location) return;

    try {
      const w = await window.campAPI.getWeather({
        lat: night.location.lat,
        lon: night.location.lon,
      });
      tripData.nights[nightIdx].weather = w;
      renderTripTimeline();
    } catch (e) {
      tripData.nights[nightIdx].weather = { error: e.message };
      renderTripTimeline();
    }
  }

  async function saveTripData() {
    try {
      // Strip weather from save (it's transient)
      const toSave = {
        startDate: tripData.startDate,
        nights: tripData.nights.map(n => ({
          nightNum: n.nightNum,
          date: n.date,
          location: n.location,
        })),
      };
      await window.campAPI.saveTripData(toSave);
    } catch (e) { console.warn('Trip save error:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════
  function bindEvents() {
    // Search
    $('#btn-search').addEventListener('click', () => { hide($('#recent-searches-dropdown')); performSearch($('#search-input').value); });
    $('#search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { hide($('#recent-searches-dropdown')); performSearch($('#search-input').value); }
    });
    $('#search-input').addEventListener('focus', () => showRecentSearches());
    $('#results-list').addEventListener('click', (e) => {
      const loadMoreBtn = e.target.closest('#btn-results-load-more');
      if (loadMoreBtn) {
        state.renderedResultsLimit += state.resultsRenderStep;
        renderResults();
        updateResultsSummary();
        return;
      }

      const favBtn = e.target.closest('.result-fav-btn');
      if (favBtn) {
        e.stopPropagation();
        toggleFavorite(favBtn.dataset.favId);
        return;
      }

      const card = e.target.closest('.result-card');
      if (card) {
        const idx = parseInt(card.dataset.idx, 10);
        if (Number.isFinite(idx) && state.filtered[idx]) selectLocation(state.filtered[idx]);
      }
    });
    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const dropdown = $('#recent-searches-dropdown');
      if (dropdown && !dropdown.contains(e.target) && e.target.id !== 'search-input') {
        hide(dropdown);
      }
    });

    // Quick searches
    $$('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.dataset.query;
        $('#search-input').value = query;
        performSearch(query);
      });
    });

    // GPS
    $('#btn-my-location').addEventListener('click', () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            $('#search-input').value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            performSearch(`${latitude}, ${longitude}`);
          },
          (err) => toast('Geolocation failed: ' + err.message, 'error')
        );
      } else {
        toast('Geolocation not available', 'error');
      }
    });

    // Filter chips
    $$('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.activeFilter = chip.dataset.filter;
        applyFilters();
        updateMap();
      });
    });

    // Sort
    $('#sort-by').addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      applyFilters();
    });

    // Heatmap toggle
    $('#btn-heatmap').addEventListener('click', () => {
      state.heatmapOn = !state.heatmapOn;
      $('#btn-heatmap').classList.toggle('active', state.heatmapOn);
      updateHeatLayer();
      toast(state.heatmapOn ? 'Heatmap enabled' : 'Heatmap disabled', 'info');
    });

    // Forest/Woods heatmap toggle
    const forestHeatmapBtn = $('#btn-forest-heatmap');
    if (forestHeatmapBtn) {
      forestHeatmapBtn.addEventListener('click', () => {
        state.forestHeatmapOn = !state.forestHeatmapOn;
        forestHeatmapBtn.classList.toggle('active', state.forestHeatmapOn);
        updateForestHeatLayer();
        toast(state.forestHeatmapOn ? 'Forest & woods cover heatmap ON' : 'Forest cover heatmap OFF', 'info');
      });
    }

    // Crime heatmap toggle
    $('#btn-crime-heatmap').addEventListener('click', () => {
      state.crimeHeatmapOn = !state.crimeHeatmapOn;
      $('#btn-crime-heatmap').classList.toggle('active', state.crimeHeatmapOn);
      updateCrimeHeatLayer();
      toast(state.crimeHeatmapOn ? 'Crime heatmap ON — sketch zones visible' : 'Crime heatmap OFF', 'info');
    });

    // Satellite toggle — shared handler for both buttons
    const satelliteBtn = $('#btn-satellite');
    const mapSatelliteBtn = $('#btn-map-satellite');
    function toggleSatellite() {
      state.satelliteOn = !state.satelliteOn;
      if (satelliteBtn) satelliteBtn.classList.toggle('active', state.satelliteOn);
      if (mapSatelliteBtn) mapSatelliteBtn.classList.toggle('active', state.satelliteOn);
      if (state.satelliteOn) {
        state.map.removeLayer(state.darkTiles);
        state.map.removeLayer(state.lightTiles);
        state.map.addLayer(state.satelliteTiles);
      } else {
        state.map.removeLayer(state.satelliteTiles);
        const theme = document.documentElement.getAttribute('data-theme');
        state.map.addLayer(theme === 'light' ? state.lightTiles : state.darkTiles);
      }
      toast(state.satelliteOn ? 'Satellite view' : 'Map view', 'info');
    }
    if (satelliteBtn) satelliteBtn.addEventListener('click', toggleSatellite);
    if (mapSatelliteBtn) mapSatelliteBtn.addEventListener('click', toggleSatellite);

    // Theme toggle
    $('#btn-theme').addEventListener('click', toggleTheme);

    // Custom title bar window controls
    $('#btn-win-minimize').addEventListener('click', () => window.campAPI.windowMinimize());
    $('#btn-win-maximize').addEventListener('click', async () => {
      await window.campAPI.windowMaximize();
      updateMaximizeIcon();
    });
    $('#btn-win-close').addEventListener('click', () => window.campAPI.windowClose());

    // Detail panel close
    $('#btn-close-detail').addEventListener('click', () => {
      hide($('#detail-panel'));
      state.selectedLocation = null;
      $$('.result-card').forEach(c => c.classList.remove('active'));
    });

    // Detail favorite
    $('#btn-favorite-detail').addEventListener('click', () => {
      if (state.selectedLocation) toggleFavorite(state.selectedLocation._id);
    });

    // Legend toggle (expand/collapse)
    $('#legend-toggle').addEventListener('click', () => {
      const legend = $('#map-legend');
      legend.classList.toggle('collapsed');
    });

    // Legend hide (fully hide the panel)
    $('#legend-hide').addEventListener('click', () => {
      $('#map-legend').classList.add('legend-hidden');
      show($('#legend-show-btn'));
    });

    // Legend show (bring it back)
    $('#legend-show-btn').addEventListener('click', () => {
      $('#map-legend').classList.remove('legend-hidden');
      hide($('#legend-show-btn'));
    });

    // Legend item click → filter by type
    document.querySelectorAll('.legend-item[data-type]').forEach(item => {
      item.addEventListener('click', () => {
        item.classList.toggle('legend-disabled');
        applyLegendFilters();
      });
    });

    function applyLegendFilters() {
      const disabled = new Set();
      document.querySelectorAll('.legend-item.legend-disabled').forEach(el => {
        disabled.add(el.dataset.type);
      });
      state.legendDisabled = disabled;
      applyFilters();
    }

    // Weather widget close
    $('#close-weather-widget').addEventListener('click', () => hide($('#weather-widget')));

    // Brand logo click => reset
    $('#brand-logo').addEventListener('click', () => {
      state.map.flyTo(WA_CENTER, 8);
      toast('Reset to Washington State overview', 'info');
    });

    // ─── Modal buttons ───
    $('#btn-info').addEventListener('click', () => {
      show($('#info-modal'));
      showGuideTab('stealth');
    });
    $('#close-info-modal').addEventListener('click', () => hide($('#info-modal')));

    $('#btn-stats').addEventListener('click', () => {
      updateStats();
      show($('#stats-modal'));
    });
    $('#close-stats-modal').addEventListener('click', () => hide($('#stats-modal')));

    // ─── Settings Modal ───
    $('#btn-settings').addEventListener('click', openSettingsModal);
    $('#close-settings-modal').addEventListener('click', () => hide($('#settings-modal')));
    $('#btn-save-settings').addEventListener('click', saveSettingsFromModal);
    $('#btn-reset-settings').addEventListener('click', resetSettings);

    $('#btn-weather').addEventListener('click', showWeatherModal);
    $('#close-weather-modal').addEventListener('click', () => hide($('#weather-modal')));

    $('#btn-reddit').addEventListener('click', () => show($('#reddit-modal')));
    $('#close-reddit-modal').addEventListener('click', () => hide($('#reddit-modal')));
    $('#btn-reddit-search').addEventListener('click', () => searchReddit($('#reddit-search-input').value));
    $('#reddit-search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchReddit($('#reddit-search-input').value);
    });

    $('#btn-add-spot').addEventListener('click', () => {
      pendingSpotPhotos = [];
      renderSpotPhotosGrid();
      show($('#add-spot-modal'));
    });
    $('#close-add-spot-modal').addEventListener('click', () => {
      pendingSpotPhotos = [];
      renderSpotPhotosGrid();
      hide($('#add-spot-modal'));
    });
    $('#add-spot-form').addEventListener('submit', addCustomSpot);
    $('#btn-attach-photo').addEventListener('click', attachSpotPhotos);
    $('#btn-take-photo').addEventListener('click', takeSpotPhoto);

    $('#btn-favorites').addEventListener('click', () => {
      renderFavoritesModal();
      show($('#favorites-modal'));
    });
    $('#close-favorites-modal').addEventListener('click', () => hide($('#favorites-modal')));
    $('#btn-export-favs').addEventListener('click', async () => {
      const favLocs = state.locations.filter(l => state.favorites.includes(l._id));
      // Also include saved favorites
      try {
        const savedFavLocations = await window.campAPI.getFavoriteLocations();
        for (const favId of state.favorites) {
          if (!favLocs.find(l => l._id === favId) && savedFavLocations[favId]) {
            favLocs.push({ ...savedFavLocations[favId], _id: favId });
          }
        }
      } catch (e) {}
      if (!favLocs.length) { toast('No favorites to export', 'warn'); return; }
      const result = await window.campAPI.exportGpx({ locations: favLocs, filename: 'hobocamp-favorites.gpx' });
      if (result.success) toast(`Exported ${favLocs.length} spots to GPX!`, 'success');
      else if (result.error) toast(`Export failed: ${result.error}`, 'error');
    });

    // Transit modal
    $('#btn-transit').addEventListener('click', () => openTransitModal(state.selectedLocation));
    $('#close-transit-modal').addEventListener('click', () => { hide($('#transit-modal')); clearTransitRoute(); });
    $('#btn-get-directions').addEventListener('click', () => getTransitDirections());
    $('#transit-from').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') getTransitDirections();
    });
    $('#btn-transit-my-loc').addEventListener('click', () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            $('#transit-from').value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            toast('GPS location set as origin', 'info');
          },
          (err) => toast('Geolocation failed: ' + err.message, 'error')
        );
      } else {
        toast('Geolocation not available', 'error');
      }
    });

    // Grocery modal
    $('#btn-grocery').addEventListener('click', () => openGroceryModal());
    $('#close-grocery-modal').addEventListener('click', () => { hide($('#grocery-modal')); clearStoreMarkers(); clearFoodBankMarkers(); });

    // Bathrooms modal
    $('#btn-bathrooms').addEventListener('click', () => openBathroomsModal());
    $('#close-bathrooms-modal').addEventListener('click', () => { hide($('#bathrooms-modal')); bathroomMarkers.forEach(m => state.map.removeLayer(m)); bathroomMarkers = []; });
    $('#btn-find-bathrooms').addEventListener('click', () => searchBathrooms());

    // Bathroom filters
    const brFilterEls = ['br-filter-accessible', 'br-filter-free', 'br-filter-24h', 'br-filter-showers', 'br-filter-water'];
    brFilterEls.forEach(id => {
      const el = $(`#${id}`);
      if (el) el.addEventListener('change', () => refilterBathrooms());
    });

    // Bathroom type filter buttons
    $$('.br-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.br-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        refilterBathrooms();
      });
    });

    // Resources modal
    $('#btn-resources').addEventListener('click', () => openResourcesModal());
    $('#close-resources-modal').addEventListener('click', () => { hide($('#resources-modal')); clearResourceMarkers(); });
    $('#btn-find-resources').addEventListener('click', () => searchResources());

    // Resources type filter buttons
    $$('.rs-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.rs-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        refilterResources();
      });
    });

    // Bridges modal
    $('#btn-bridges').addEventListener('click', () => openBridgesModal());
    $('#close-bridges-modal').addEventListener('click', () => { hide($('#bridges-modal')); bridgeMarkers.forEach(m => state.map.removeLayer(m)); bridgeMarkers = []; });
    $('#btn-find-bridges').addEventListener('click', () => searchBridges());

    // Bridge type filter buttons
    $$('.bg-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.bg-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        refilterBridges();
      });
    });

    // Bridge sort + radius + min score
    const bgSort = $('#bg-sort');
    if (bgSort) bgSort.addEventListener('change', () => refilterBridges());
    const bgRadius = $('#bg-radius');
    if (bgRadius) bgRadius.addEventListener('change', () => { if (lastBridgeData) searchBridges(); });
    const bgMinScore = $('#bg-min-score');
    if (bgMinScore) {
      bgMinScore.addEventListener('input', () => {
        const val = bgMinScore.value;
        const valEl = $('#bg-min-score-val');
        if (valEl) valEl.textContent = val;
      });
      bgMinScore.addEventListener('change', () => refilterBridges());
    }

    // Trip Planner
    $('#btn-trip').addEventListener('click', () => openTripModal());
    $('#close-trip-modal').addEventListener('click', () => hide($('#trip-modal')));
    $('#btn-generate-trip').addEventListener('click', () => generateTrip());

    $$('.grocery-tab').forEach(tab => {
      tab.addEventListener('click', () => switchGroceryTab(tab.dataset.gtab));
    });
    $('#btn-optimize-meals').addEventListener('click', () => runOptimizer(false));
    $('#btn-optimize-random').addEventListener('click', () => runOptimizer(true));
    $('#btn-find-stores').addEventListener('click', () => findNearbyStores());
    $('#btn-quick-random-plan').addEventListener('click', () => runQuickMealPlan());
    $('#btn-shuffle-plan').addEventListener('click', () => shuffleMealPlan());
    $('#btn-quick-meal').addEventListener('click', () => runQuickMealPlan());
    $('#btn-find-foodbanks').addEventListener('click', () => findFoodBanks());

    // Grocery group filter buttons
    $$('.grocery-group-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.grocery-group-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const group = btn.dataset.ggroup;
        const search = $('#grocery-search').value.trim();
        loadCompareTab({ group: group === 'all' ? null : group, search: search || null });
      });
    });

    // Grocery search
    let grocerySearchTimer;
    const grocerySearchEl = $('#grocery-search');
    if (grocerySearchEl) {
      grocerySearchEl.addEventListener('input', () => {
        clearTimeout(grocerySearchTimer);
        grocerySearchTimer = setTimeout(() => {
          const activeGroup = document.querySelector('.grocery-group-btn.active')?.dataset.ggroup;
          loadCompareTab({ group: activeGroup === 'all' ? null : activeGroup, search: grocerySearchEl.value.trim() || null });
        }, 300);
      });
    }

    // Guide tabs
    $$('.guide-tab').forEach(tab => {
      tab.addEventListener('click', () => showGuideTab(tab.dataset.tab));
    });

    // Close modals on overlay click (with marker cleanup)
    $$('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          hide(overlay);
          cleanupModalMarkers(overlay);
        }
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $$('.modal-overlay').forEach(m => { hide(m); cleanupModalMarkers(m); });
        hide($('#detail-panel'));
        // Close any open trip pickers
        $$('.trip-picker').forEach(p => p.remove());
      }
      if (e.key === '/' && !e.target.matches('input, textarea, select')) {
        e.preventDefault();
        $('#search-input').focus();
      }
      // Zoom: Ctrl+Plus / Ctrl+Minus / Ctrl+0
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        window.campAPI.zoomIn().then(showZoomIndicator);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        window.campAPI.zoomOut().then(showZoomIndicator);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        window.campAPI.zoomReset().then(showZoomIndicator);
      }
    });

    // Day.js relative time plugin
    try { dayjs.extend(dayjs_plugin_relativeTime); } catch (e) {}
  }

  function showGuideTab(tab) {
    $$('.guide-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    const content = $('#guide-content');
    content.innerHTML = guideContent[tab] || '<p class="muted-text">Coming soon...</p>';
  }

  // ═══════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    initSplash();
    initTooltips();

    // Dynamic source count
    const srcCount = Object.keys(SOURCE_META).length;
    const welcomeEl = $('#welcome-source-count');
    const footerEl = $('#footer-source-count');
    if (welcomeEl) welcomeEl.textContent = srcCount + ' Sources';
    if (footerEl) footerEl.textContent = srcCount;

    // ── Responsive placeholder shortening ──
    const searchInput = $('#search-input');
    if (searchInput) {
      const placeholders = [
        { maxWidth: 480,  text: 'Search...' },
        { maxWidth: 640,  text: 'Address or city...' },
        { maxWidth: 860,  text: 'Enter address or city...' },
        { maxWidth: 9999, text: 'Enter address, city, or coordinates...' },
      ];
      const updatePlaceholder = () => {
        const w = window.innerWidth;
        for (const p of placeholders) {
          if (w <= p.maxWidth) { searchInput.placeholder = p.text; break; }
        }
      };
      updatePlaceholder();
      window.addEventListener('resize', updatePlaceholder);
    }
  });

})();
