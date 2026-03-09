/**
 * HoboApp Preload – Secure context bridge.
 * Exposes campAPI to the renderer with all IPC channels.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('campAPI', {
  // Core
  geocodeAddress: (address) => ipcRenderer.invoke('geocode-address', address),
  searchLocations: (params) => ipcRenderer.invoke('search-locations', params),
  getLocationDetail: (loc) => ipcRenderer.invoke('get-location-detail', loc),

  // Weather & Terrain
  getWeather: (params) => ipcRenderer.invoke('get-weather', params),
  analyzeTerrain: (params) => ipcRenderer.invoke('analyze-terrain', params),
  getElevation: (params) => ipcRenderer.invoke('get-elevation', params),

  // Reddit
  searchReddit: (params) => ipcRenderer.invoke('search-reddit', params),

  // User Data / Persistence
  getUserData: () => ipcRenderer.invoke('get-user-data'),
  saveUserData: (data) => ipcRenderer.invoke('save-user-data', data),
  toggleFavorite: (id, data) => ipcRenderer.invoke('toggle-favorite', id, data),
  saveNote: (params) => ipcRenderer.invoke('save-note', params),
  addCustomLocation: (loc) => ipcRenderer.invoke('add-custom-location', loc),
  getCustomLocations: () => ipcRenderer.invoke('get-custom-locations'),
  deleteCustomLocation: (id) => ipcRenderer.invoke('delete-custom-location', id),
  
  // Photo management for custom spots
  pickPhotosDialog: () => ipcRenderer.invoke('pick-photos-dialog'),
  saveSpotPhotos: (params) => ipcRenderer.invoke('save-spot-photos', params),
  saveSpotPhotoBuffer: (params) => ipcRenderer.invoke('save-spot-photo-buffer', params),
  readSpotPhoto: (filePath) => ipcRenderer.invoke('read-spot-photo', filePath),
  deleteSpotPhotos: (filePaths) => ipcRenderer.invoke('delete-spot-photos', filePaths),

  getRecentSearches: () => ipcRenderer.invoke('get-recent-searches'),
  getFavoriteLocations: () => ipcRenderer.invoke('get-favorite-locations'),

  // Transit & Directions
  getTransitDirections: (params) => ipcRenderer.invoke('get-transit-directions', params),
  getTransitAgencies: (params) => ipcRenderer.invoke('get-transit-agencies', params),

  // Grocery & Nutrition
  groceryFindStores: (params) => ipcRenderer.invoke('grocery-find-stores', params),
  groceryGetFoods: (filters) => ipcRenderer.invoke('grocery-get-foods', filters),
  groceryOptimize: (params) => ipcRenderer.invoke('grocery-optimize', params),
  groceryQuickPlan: (params) => ipcRenderer.invoke('grocery-quick-plan', params),
  groceryFindFoodBanks: (params) => ipcRenderer.invoke('grocery-find-food-banks', params),
  groceryNutrition: (params) => ipcRenderer.invoke('grocery-nutrition', params),
  groceryScrapeWalmart: (params) => ipcRenderer.invoke('grocery-scrape-walmart', params),
  groceryGetStoreInfo: () => ipcRenderer.invoke('grocery-get-store-info'),

  // Bathrooms & Restrooms
  findBathrooms: (params) => ipcRenderer.invoke('find-bathrooms', params),
  getBathroomTypes: () => ipcRenderer.invoke('get-bathroom-types'),

  // Bridges & Shelter
  findBridges: (params) => ipcRenderer.invoke('find-bridges', params),
  getBridgeTypes: () => ipcRenderer.invoke('get-bridge-types'),

  // Survival Resources (libraries, showers, laundry, water, food banks)
  findResources: (params) => ipcRenderer.invoke('find-resources', params),
  getResourceTypes: () => ipcRenderer.invoke('get-resource-types'),

  // Window Controls (custom title bar)
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Window Zoom
  zoomIn: () => ipcRenderer.invoke('zoom-in'),
  zoomOut: () => ipcRenderer.invoke('zoom-out'),
  zoomReset: () => ipcRenderer.invoke('zoom-reset'),
  getZoomLevel: () => ipcRenderer.invoke('get-zoom-level'),

  // Trip Planner
  getTripData: () => ipcRenderer.invoke('get-trip-data'),
  saveTripData: (data) => ipcRenderer.invoke('save-trip-data', data),
  getMultiDayWeather: (params) => ipcRenderer.invoke('get-multi-day-weather', params),

  // Export
  exportGpx: (params) => ipcRenderer.invoke('export-gpx', params),

  // Search progress events (main → renderer)
  onSearchProgress: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('search-progress', handler);
    return () => ipcRenderer.removeListener('search-progress', handler);
  },

  // Partial results events (main → renderer) — progressive loading
  onSearchPartialResults: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('search-partial-results', handler);
    return () => ipcRenderer.removeListener('search-partial-results', handler);
  },

  // Crime heatmap data events (main → renderer)
  onCrimeHeatmapData: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('crime-heatmap-data', handler);
    return () => ipcRenderer.removeListener('crime-heatmap-data', handler);
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
});
