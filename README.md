# HoboApp

HoboApp is an Electron desktop app for stealth-camping research, trip planning, and survival-resource discovery across Washington State.

It combines curated location data, map-based search, public datasets, weather and terrain analysis, transit and grocery research, and local-only planning tools into one desktop workflow.

> Research tool only. It does not guarantee safety, legality, access, or suitability.

**Community:** [Join the Discord](https://discord.gg/M6MuRUaeJj)

---

## What the current codebase does

The current codebase centers around:

- an Electron main process in [src/main.js](src/main.js)
- a secure preload bridge in [src/preload.js](src/preload.js)
- a large renderer/UI layer in [src/renderer.js](src/renderer.js)
- modular data adapters under [src/modules](src/modules)
- local persistence for favorites, notes, recent searches, trip plans, custom spots, and spot photos

The app is desktop-first and local-first. It is built for research and planning, not for cloud sync or social networking.

---

## Core features

### Interactive map research

- address, city, and coordinate lookup
- rich map overlays and source-aware search progress
- clustered results and detail panels
- photo viewing for custom spots
- dark desktop-oriented UI with animated shell behavior

### Location and survival discovery

The app aggregates public and curated sources to surface:

- stealth-camping candidates
- campgrounds and public land sites
- bridge and overpass shelter options
- bathrooms and hygiene resources
- showers, laundry, Wi‑Fi, food, water, libraries, clinics, and related services
- grocery stores and meal-planning inputs
- waterways, wooded cover, rain cover, and terrain/elevation context
- transit options and agency/fare context
- custom user-added spots with notes and photos

### Planning tools

- favorites
- saved notes
- recent searches
- custom locations
- trip-planning workflows
- GPX export
- optional custom photo attachments for saved spots

### Local-only persistence and safer file handling

The main process stores user data locally and includes guardrails around:

- text sanitization
- coordinate normalization
- safer external URL opening
- safer custom-photo path handling

---

## Data sources and adapters

The main process currently wires together modules including:

- RIDB / Recreation.gov
- Overpass / OpenStreetMap
- FreeCampsites
- iOverlander
- geocoding helpers
- weather
- Reddit lookup
- terrain and elevation analysis
- transit
- grocery helpers
- bathrooms
- bridge data
- survival-resource search
- USFS
- woods / waterways
- National Park Service
- OpenChargeMap
- cover / rain-cover research
- crime-data helpers
- built-in curated static data

See [src/main.js](src/main.js) and [src/modules](src/modules).

---

## Architecture summary

### Main process

[src/main.js](src/main.js) owns:

- Electron window lifecycle
- IPC routing
- local JSON persistence
- photo storage helpers
- source orchestration and normalization entry points

### Preload bridge

[src/preload.js](src/preload.js) exposes renderer-facing APIs for:

- search and geocoding
- weather / terrain / elevation
- Reddit search
- user-data persistence
- favorites and notes
- custom locations
- spot photo management

### Renderer

[src/renderer.js](src/renderer.js) drives:

- search flows
- detail panels
- weather modal
- photo viewer/lightbox
- custom-spot workflows
- trip planning and research interactions

---

## Installation

### Requirements

- Node.js 18+
- npm
- Linux, macOS, or Windows capable of running Electron

### Run locally

```bash
npm install
npm start
```

### Development mode

```bash
npm run dev
```

---

## Repository layout

- [package.json](package.json) — Electron app metadata and scripts
- [src/main.js](src/main.js) — main process, persistence, IPC, source orchestration
- [src/preload.js](src/preload.js) — secure renderer bridge
- [src/renderer.js](src/renderer.js) — UI logic
- [src/index.html](src/index.html) — app shell
- [src/styles.css](src/styles.css) — styling and animations
- [src/modules](src/modules) — source adapters and utilities

Representative modules:

- [src/modules/freecampsites.js](src/modules/freecampsites.js)
- [src/modules/ioverlander.js](src/modules/ioverlander.js)
- [src/modules/bathrooms.js](src/modules/bathrooms.js)
- [src/modules/bridges.js](src/modules/bridges.js)
- [src/modules/grocery.js](src/modules/grocery.js)
- [src/modules/geocoder.js](src/modules/geocoder.js)
- [src/modules/harmreduction.js](src/modules/harmreduction.js)

---

## Tech stack

The checked-in package metadata currently uses:

- Electron
- Node.js
- Axios
- Cheerio
- NodeCache

The app also relies heavily on custom renderer logic and internal source modules rather than a large frontend framework.

---

## Privacy

HoboApp stores user data locally, including:

- favorites
- notes
- recent searches
- custom locations
- trip plans
- settings
- optional API keys
- custom spot photos

There is no hosted sync service in this repository for that personal data.

---

## Safety and legal notice

This project is for informational and educational use only.

Outdoor sleeping, stealth camping, trespassing, and remote travel carry real risk, including injury, arrest, property loss, and death. Data can be stale, incomplete, unsafe, inaccurate, or legally unusable. Always verify land ownership, weather, access restrictions, and local law yourself.

Use HoboApp at your own risk.

---

## Project status

- package version is currently `2.0.0`
- some internal storage names still reference older names such as `hobocamp`
- the current app is Washington-focused and desktop-first

---

## Contributing

Useful contribution areas:

- source quality improvements and deduplication
- better result scoring and filtering
- renderer performance and UI polish
- broader geography support beyond Washington State
- offline caching improvements
- release packaging and distribution
- documentation and screenshot refreshes

---

## License

See [LICENSE](LICENSE).
