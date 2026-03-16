# The Hobo Network — Unified Platform Architecture

> **One Account. All of Hobo.**

This document defines the multi-domain architecture that connects all Hobo services under a single identity, theme, and configuration system.

---

## Domain Map

| Domain | Purpose | Port | Repo Path |
|--------|---------|------|-----------|
| `hobo.tools` | Central hub — landing page, account dashboard, SSO provider | 3100 | `hobo-tools/` |
| `login.hobo.tools` | SSO login/register UI + OAuth2 authorization server | 3100 (same app, vhost routing) | `hobo-tools/` |
| `my.hobo.tools` | Account management — profile, sessions, notifications, linked services | 3100 (same app, vhost routing) | `hobo-tools/` |
| `maps.hobo.tools` | Interactive camp/shelter locator (web port of HoboApp) | 3100 (subpath or vhost) | `hobo-tools/` |
| `dl.hobo.tools` | YouTube downloader, media tools | 3100 | `hobo-tools/` |
| `hobostreamer.com` | Live streaming platform | 3000 | `hobostreamer/` |
| `hobo.quest` | Games hub | 3200 | `hobo-quest/` |
| `hobo.quest/game` | HoboGame MMORPG | 3200 | `hobo-quest/` |
| `hobo.quest/canvas` | Community canvas (r/place) | 3200 | `hobo-quest/` |

All services run on the same OVH server behind Nginx, TLS terminated at Cloudflare.

---

## Monorepo Layout

```
hobo/
├── ARCHITECTURE.md              ← this file
├── packages/
│   └── hobo-shared/             ← shared auth client, theme engine, brand config, notifications
│       ├── package.json
│       ├── auth-client.js       ← OAuth2 client helpers (token exchange, refresh, verify)
│       ├── theme-sync.js        ← cross-domain theme engine (CSS vars, storage, API sync)
│       ├── brand.js             ← shared brand constants (colors, URLs, names)
│       ├── middleware.js         ← Express middleware (requireHoboAuth, optionalHoboAuth)
│       ├── notifications.js     ← notification types, priorities, categories (isomorphic)
│       ├── notification-ui.js   ← client-side toast/bell/badge/sound system
│       ├── navbar.js            ← universal navbar component (service links, bell mount)
│       ├── account-switcher.js  ← Google-style multi-account management UI
│       └── user-card.js         ← right-click context menu + profile card with name effects
├── hobo-tools/                  ← Central hub + SSO provider
│   ├── package.json
│   ├── server/
│   │   ├── index.js
│   │   ├── config.js
│   │   ├── db/                  ← Central accounts database + notification tables
│   │   ├── auth/                ← OAuth2/OIDC provider, anon sessions, multi-account
│   │   ├── notifications/       ← Notification service, REST API, SES email
│   │   ├── admin/               ← Admin panel API (SES config, users, broadcast, health)
│   │   ├── tools/               ← YouTube downloader, converters, utilities
│   │   ├── maps/                ← Web port of HoboApp data + map UI
│   │   └── dashboard/           ← Account settings, connected services, theme picker
│   ├── public/
│   │   ├── index.html           ← Dashboard SPA
│   │   ├── login.html           ← Animated login/register page
│   │   └── my.html              ← Account management (profile, sessions, notifications)
│   └── deploy/
├── hobo-quest/                  ← Games platform
│   ├── package.json
│   ├── server/
│   │   ├── index.js
│   │   ├── config.js
│   │   ├── game/                ← Migrated from hobostreamer/server/game/
│   │   └── canvas/              ← Migrated from hobostreamer/server/game/canvas-*
│   ├── public/
│   └── deploy/
├── hobostreamer/                ← Streaming platform (existing)
│   └── ... (existing structure, auth becomes OAuth2 client)
└── src/                         ← HoboApp Electron (legacy, being absorbed into hobo-tools)
```

---

## SSO Architecture

### Design Principles

1. **Central authority**: `hobo.tools` owns the user database and is the single source of truth for identity
2. **OAuth2 Authorization Code flow**: All other services are OAuth2 clients that redirect to `login.hobo.tools`
3. **JWT access tokens**: Signed by hobo.tools, verified by all services using a shared public key
4. **Refresh tokens**: Long-lived (30 days), stored server-side, enable seamless re-auth
5. **Cookie domains**: `.hobo.tools` subdomains share auth cookies; `hobostreamer.com` and `hobo.quest` use OAuth2 redirects
6. **Backward compatible**: Existing hobostreamer.com accounts are migrated, existing JWTs honored during transition

### Token Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    hobo.tools (Auth Server)                  │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ User DB     │  │ OAuth2       │  │ Token Signing     │  │
│  │ (central)   │  │ Client       │  │ (RS256 keypair)   │  │
│  │             │  │ Registry     │  │                   │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
   ┌──────────┐   ┌───────────┐   ┌──────────┐
   │hobo      │   │hobo       │   │hobo      │
   │streamer  │   │.quest     │   │.tools/*  │
   │.com      │   │           │   │subdomains│
   │          │   │           │   │          │
   │OAuth2    │   │OAuth2     │   │Cookie    │
   │Client    │   │Client     │   │(shared   │
   │(redirect)│   │(redirect) │   │ domain)  │
   └──────────┘   └───────────┘   └──────────┘
```

### Login Flow (cross-domain)

```
User visits hobostreamer.com → clicks Login
  → redirect to login.hobo.tools/authorize?
      client_id=hobostreamer&
      redirect_uri=https://hobostreamer.com/auth/callback&
      response_type=code&
      scope=profile+theme&
      state=<random>
  → user logs in (or is already logged in via .hobo.tools cookie)
  → redirect back to hobostreamer.com/auth/callback?code=<authcode>&state=<random>
  → hobostreamer.com server exchanges code → access_token + refresh_token
  → hobostreamer.com sets its own session/token cookie
  → user is logged in
```

### Login Flow (same-domain — hobo.tools subdomains)

```
User visits maps.hobo.tools → clicks Login
  → redirect to login.hobo.tools/authorize (same parent domain)
  → cookie already set on .hobo.tools → auto-approve
  → redirect back with code
  → instant login (feels seamless)
```

### Token Format (JWT)

```json
{
  "iss": "https://hobo.tools",
  "sub": "12345",
  "aud": ["hobostreamer.com", "hobo.quest", "hobo.tools"],
  "username": "goosely",
  "display_name": "Goosely",
  "role": "admin",
  "avatar_url": "/data/avatars/goosely.webp",
  "profile_color": "#c0965c",
  "theme_id": "campfire",
  "iat": 1710500000,
  "exp": 1710586400
}
```

Signed with RS256 (asymmetric). hobo.tools holds the private key; all services verify with the public key (no shared secret).

### OAuth2 Client Registry

Stored in hobo.tools database:

| client_id | client_secret | redirect_uris | name |
|-----------|---------------|---------------|------|
| `hobostreamer` | `<secret>` | `https://hobostreamer.com/auth/callback` | HoboStreamer |
| `hoboquest` | `<secret>` | `https://hobo.quest/auth/callback` | HoboQuest |
| `hobotools-maps` | (first-party) | `https://maps.hobo.tools/auth/callback` | HoboTools Maps |

First-party hobo.tools subdomains use cookie-based auth (no OAuth2 redirect needed for subdomains on `.hobo.tools`).

---

## Account Migration Strategy

### Phase 1: Parallel Auth (backward compatible)

1. Deploy hobo.tools with the central user database
2. **Copy** all existing hobostreamer.com users → hobo.tools database (preserving IDs, password hashes, everything)
3. hobostreamer.com continues accepting its own JWT tokens as before
4. hobostreamer.com ALSO accepts hobo.tools JWT tokens (dual verification)
5. New registrations go to hobo.tools only (hobostreamer.com registration redirects to login.hobo.tools)

### Phase 2: SSO Switch

1. hobostreamer.com login button redirects to login.hobo.tools
2. hobostreamer.com stops issuing its own tokens
3. All auth flows go through hobo.tools
4. hobostreamer.com keeps a local `linked_accounts` table mapping `hobo_user_id → local_user_id`

### Phase 3: Full Migration

1. hobostreamer.com user table becomes read-only (synced from hobo.tools)
2. Profile changes (avatar, display name, theme) propagate from hobo.tools → all services
3. hobo.quest launched with SSO from day one (no legacy migration needed)

### Migration Script Pseudocode

```javascript
// scripts/migrate-to-hobo-tools.js
// Run once to copy hobostreamer.com users → hobo.tools central DB

for (const user of hobostreamerDb.all('SELECT * FROM users')) {
    centralDb.run(`INSERT INTO users (
        id, username, email, password_hash, display_name, avatar_url, bio,
        role, profile_color, created_at, updated_at, last_seen,
        legacy_source, legacy_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'hobostreamer', ?)`, [
        user.id, user.username, user.email, user.password_hash,
        user.display_name, user.avatar_url, user.bio,
        user.role, user.profile_color, user.created_at,
        user.updated_at, user.last_seen, user.id
    ]);
}
```

---

## Theme Sync

Themes are a first-class cross-platform feature. The theme engine and CSS variable system are shared across all domains.

### How It Works

1. **Shared theme engine** (`packages/hobo-shared/theme-sync.js`):
   - Same 21 CSS variables used by all sites
   - Identical theme catalog available everywhere
   - `loadTheme()`, `applyTheme()`, `syncThemeToServer()` — domain-agnostic

2. **Server-side preference**:
   - User's active theme stored in hobo.tools central DB (`user_preferences.theme_id`, `user_preferences.custom_variables`)
   - When user changes theme on ANY site → API call to hobo.tools → updates central preference
   - JWT token includes `theme_id` claim for instant theme application on page load

3. **Local caching**:
   - `localStorage.hobo_theme` used for instant paint (no flash)
   - Synced on login and on theme change

4. **Same catalog everywhere**:
   - Built-in themes defined in `packages/hobo-shared/themes.js`
   - Community themes stored in hobo.tools DB, accessible via `GET https://hobo.tools/api/themes`
   - All sites fetch from the same endpoint

### CSS Variable Namespace

All Hobo sites use the same variable names:

```css
:root {
  --bg-primary: #1e1e24;
  --bg-secondary: #252530;
  --accent: #c0965c;
  --text-primary: #e0e0e0;
  /* ... 21 total variables */
}
```

This means a user who picks "Neon Tokyo" on hobostreamer.com sees the same colors on hobo.quest and hobo.tools.

---

## Service Communication

### Internal API (Server-to-Server)

Services on the same box communicate via localhost HTTP with a shared internal API key:

```
hobostreamer.com (port 3000)  ←→  hobo.tools (port 3100)
hobo.quest (port 3200)        ←→  hobo.tools (port 3100)
```

Internal endpoints (not exposed via Nginx):

| Endpoint | Purpose |
|----------|---------|
| `POST hobo.tools:3100/internal/verify-token` | Verify a JWT and get user data |
| `POST hobo.tools:3100/internal/user/:id/sync` | Get latest user profile |
| `POST hobo.tools:3100/internal/theme/:id` | Get theme data by ID |
| `POST hobo.tools:3100/internal/notifications/push` | Push notification to a user |
| `POST hobo.tools:3100/internal/notifications/push-bulk` | Push notification to many users |
| `GET  hobo.tools:3100/internal/notifications/unread/:userId` | Unread count for a user |
| `POST hobo.tools:3100/internal/notifications/resolve-users` | Resolve usernames to IDs |

Protected by `X-Internal-Key` header (shared secret, localhost-only via Nginx).

### Webhook Events

hobo.tools emits webhooks to registered services on key events:

| Event | Payload | Purpose |
|-------|---------|---------|
| `user.updated` | `{user_id, fields_changed}` | Profile/theme change → sync to all services |
| `user.banned` | `{user_id, reason}` | Ban propagation across all platforms |
| `user.deleted` | `{user_id}` | Account deletion cascade |
| `theme.published` | `{theme_id}` | New community theme available |

---

## Notification System

### Architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ HoboStreamer │  │  HoboQuest   │  │  HoboTools   │
│   (3000)     │  │   (3200)     │  │   (3100)     │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │   POST /internal/notifications/push
       └────────────────►│◄────────────────┘
                         │
              ┌──────────▼──────────┐
              │  Notification       │
              │  Service (SQLite)   │
              │  ┌───────────────┐  │
              │  │ notifications │  │
              │  │ preferences   │  │
              │  └───────────────┘  │
              └──────────┬──────────┘
                    │         │
           ┌────────┘         └────────┐
           ▼                           ▼
    ┌─────────────┐            ┌─────────────┐
    │  Client UI  │            │  Amazon SES  │
    │  (polling)  │            │  (CRITICAL   │
    │  15s cycle  │            │   only)      │
    └─────────────┘            └─────────────┘
```

### Priority Levels

| Priority | Toast | Sound | Email | Use Case |
|----------|-------|-------|-------|----------|
| `low` | No | No | No | Log-only, badge count |
| `normal` | 5s auto-dismiss | Subtle chime | No | New followers, game events |
| `high` | 8s auto-dismiss | Attention tone | No | Direct messages, mentions |
| `critical` | Sticky (manual) | Urgent alert | **Yes** | Bans, system failures |

### Categories

10 categories: `social`, `chat`, `game`, `stream`, `economy`, `achievement`, `moderation`, `system`, `service`, `admin`

Users configure per-category preferences (enabled/sound/toast/email) at `my.hobo.tools`.

### Client Integration

All services load shared JS from `https://hobo.tools/shared/`:

```html
<script src="https://hobo.tools/shared/navbar.js"></script>
<script src="https://hobo.tools/shared/notification-ui.js"></script>
<script src="https://hobo.tools/shared/account-switcher.js"></script>
<script src="https://hobo.tools/shared/user-card.js"></script>
```

The notification UI polls `GET /api/notifications` every 15 seconds, renders toasts, updates the bell badge, and plays sounds based on priority.

### Email Delivery

Amazon SES sends HTML emails for CRITICAL notifications only. SES credentials are configured through `.env` or the admin panel. Emails use dark-themed branded templates. A background job processes the email queue every 2 minutes.

---

## Anonymous Users & Multi-Account

### Anonymous Users

Users can browse and interact without creating an account:

- Each anonymous user gets a unique incrementing number (e.g., "Anonymous #42")
- Session token stored client-side, fingerprint for reconnection
- Stats and preferences tracked in the `anon_users` table
- Can be linked to a registered account at any time (merges identity)

### Multi-Account Switching

Google-style account management (up to 5 accounts):

```
┌─────────────────────────────────┐
│  Account Switcher Panel         │
│  ┌───────────────────────────┐  │
│  │ ✓ Goosely (active)       │  │
│  │   goosely@email.com      │  │
│  ├───────────────────────────┤  │
│  │   AltAccount              │  │
│  │   alt@email.com           │  │
│  ├───────────────────────────┤  │
│  │ 👤 Anonymous #42          │  │
│  │   Continue without login  │  │
│  ├───────────────────────────┤  │
│  │ + Add another account     │  │
│  │ ⎋ Sign out of all         │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

Account list stored in `localStorage('hobo_accounts')`. Server tracks active sessions in `user_sessions` table. Switching accounts validates tokens and updates the active session.

---

## Nginx Architecture

All three services run behind a single Nginx instance on the OVH server:

```nginx
# hobostreamer.com → port 3000
server {
    listen 80;
    server_name hobostreamer.com www.hobostreamer.com;
    # ... existing config ...
}

# hobo.tools + login.hobo.tools + my.hobo.tools + maps.hobo.tools + dl.hobo.tools → port 3100
server {
    listen 80;
    server_name hobo.tools *.hobo.tools;
    location / {
        proxy_pass http://127.0.0.1:3100;
        # ... standard proxy headers ...
    }
}

# hobo.quest → port 3200
server {
    listen 80;
    server_name hobo.quest www.hobo.quest;
    location / {
        proxy_pass http://127.0.0.1:3200;
        # ... standard proxy headers + WebSocket upgrade for game/canvas ...
    }
}
```

Cloudflare handles TLS for all three domains. Each domain is added to Cloudflare with Full (strict) SSL and a Let's Encrypt origin cert covering all subdomains.

### Cloudflare DNS Records

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `hobostreamer.com` | `<OVH IP>` | Proxied |
| A | `hobo.tools` | `<OVH IP>` | Proxied |
| A | `*.hobo.tools` | `<OVH IP>` | Proxied |
| A | `hobo.quest` | `<OVH IP>` | Proxied |
| CNAME | `www.hobo.quest` | `hobo.quest` | Proxied |

---

## Database Architecture

### Central DB (hobo.tools)

The authoritative source for identity, preferences, and cross-platform data:

```
data/hobo-tools.db
├── users              ← canonical user records (migrated from hobostreamer)
├── oauth_clients      ← registered OAuth2 clients
├── oauth_codes        ← authorization codes (short-lived)
├── oauth_tokens       ← refresh tokens
├── user_preferences   ← theme, language, notification settings
├── themes             ← theme catalog (built-in + community)
├── user_themes        ← per-user custom overrides
├── sessions           ← server-side session tracking
├── audit_log          ← cross-platform security events
├── notifications      ← all user notifications (UUID PK, priority, category, rich content)
├── notification_preferences  ← per-user per-category settings (enabled/sound/toast/email)
├── anon_users         ← anonymous user identities (unique number, session token)
├── user_sessions      ← multi-account active session tracking
├── user_effects       ← equipped name/particle effects
├── follows            ← user follow relationships
└── site_settings      ← admin-configurable settings (SES, notifications, etc.)
```

### Per-Service DBs

Each service keeps its own domain-specific data:

```
hobostreamer/data/hobostreamer.db
├── streams, vods, clips, chat_messages, channels, ...
├── linked_accounts (hobo_user_id → local_user_id)
└── ... (all existing tables, minus auth after Phase 3)

hobo-quest/data/hobo-quest.db
├── game_players, game_inventory, game_structures, ...
├── canvas_tiles, canvas_actions, canvas_snapshots, ...
└── linked_accounts (hobo_user_id → local_game_player_id)
```

---

## Game Migration Plan (hobostreamer → hobo.quest)

The HoboGame and Canvas systems will be extracted from hobostreamer into hobo-quest:

### What Moves

| From (hobostreamer) | To (hobo-quest) |
|---------------------|-----------------|
| `server/game/game-engine.js` | `server/game/game-engine.js` |
| `server/game/game-server.js` | `server/game/game-server.js` |
| `server/game/items.js` | `server/game/items.js` |
| `server/game/routes.js` | `server/game/routes.js` |
| `server/game/schema.sql` | `server/game/schema.sql` |
| `server/game/tags.js` | `server/game/tags.js` |
| `server/game/canvas-service.js` | `server/canvas/canvas-service.js` |
| `server/game/canvas-server.js` | `server/canvas/canvas-server.js` |
| `server/game/canvas-routes.js` | `server/canvas/canvas-routes.js` |
| `public/js/game*.js` | `public/js/game*.js` |
| `public/obs/game-overlay*` | `public/game-overlay*` |

### What Stays (on hobostreamer)

- Game auth bridge (redirect to hobo.quest)
- Game cosmetics/coins that affect chat display (synced from hobo.tools)
- Game embed iframe/link on the hobostreamer dashboard

### Transition Period

1. hobostreamer.com `/game` and `/canvas` redirect to `hobo.quest/game` and `hobo.quest/canvas`
2. Game WebSocket endpoints remain on hobostreamer.com during transition (proxied)
3. Once hobo.quest is stable, WebSocket moves to `hobo.quest/ws/game` and `hobo.quest/ws/canvas`
4. Game database migrated to hobo-quest DB

---

## HoboApp → hobo.tools Migration

The HoboApp Electron desktop app (`src/`) is being absorbed into hobo.tools as a web service:

| HoboApp Component | hobo.tools Destination |
|-------------------|----------------------|
| Map UI + data modules | `maps.hobo.tools` — full interactive web map |
| 18 data sources | `server/maps/sources/` — server-side aggregation |
| Location database | Central DB `locations` table |
| Photo storage | `data/map-photos/` |
| GPX export | `maps.hobo.tools/export` API endpoint |

New web-only tools not in HoboApp:

| Tool | URL | Description |
|------|-----|-------------|
| YouTube Downloader | `dl.hobo.tools` | yt-dlp powered video/audio download |
| Audio Converter | `hobo.tools/convert/audio` | MP3/FLAC/WAV/OGG conversion |
| Image Tools | `hobo.tools/convert/image` | Resize, compress, format convert |
| File Converter | `hobo.tools/convert/file` | PDF, document conversions |
| Network Tools | `hobo.tools/network` | IP lookup, speed test, DNS tools |

---

## Shared Package: `packages/hobo-shared`

A local npm package (`file:../packages/hobo-shared`) consumed by all three services:

### Exports

```javascript
// Auth client (for OAuth2 client services)
const { HoboAuthClient, requireHoboAuth, optionalHoboAuth } = require('hobo-shared/auth-client');

// Theme engine (isomorphic — works in browser and Node)
const { ThemeEngine, BUILTIN_THEMES, CSS_VARIABLES } = require('hobo-shared/theme-sync');

// Brand constants
const { BRAND } = require('hobo-shared/brand');
// BRAND.colors.accent = '#c0965c'
// BRAND.urls.tools = 'https://hobo.tools'
// BRAND.urls.quest = 'https://hobo.quest'
// BRAND.urls.streamer = 'https://hobostreamer.com'
// BRAND.name = 'Hobo Network'

// Express middleware
const { requireHoboAuth, optionalHoboAuth, internalApiAuth } = require('hobo-shared/middleware');

// Notification constants (isomorphic — used by server and client)
const {
    PRIORITY, CATEGORY, NOTIFICATION_TYPES, SOUNDS,
    EMAIL_ELIGIBLE_CATEGORIES, createNotification, DEFAULT_NOTIFICATION_PREFS
} = require('hobo-shared/notifications');

// Client-only (loaded via <script> tags from https://hobo.tools/shared/):
// navbar.js          — Universal navbar with service links, notification bell, user dropdown
// notification-ui.js — Toast popups, bell badge, notification panel with category tabs
// account-switcher.js — Multi-account switcher panel with anonymous mode
// user-card.js       — Right-click context menu + user profile card with name effects
```

### Theme Engine (Isomorphic)

The theme engine in `theme-sync.js` works both server-side (for SSR/email templates) and client-side (browser):

```javascript
// Browser usage (all sites include this)
const theme = HoboTheme.load();        // from localStorage or JWT claim
HoboTheme.apply(theme);               // sets CSS variables on :root
HoboTheme.onChange((newTheme) => {     // user picks new theme
    HoboTheme.apply(newTheme);
    HoboTheme.save(newTheme);          // localStorage
    HoboTheme.sync(newTheme);          // POST to hobo.tools/api/themes/me
});
```

---

## Implementation Priority

### Phase 0: Foundation (now)
- [ ] Create `packages/hobo-shared/` with brand constants, theme engine, auth client stubs
- [ ] Create `hobo-tools/` project scaffold (Express app, DB schema, config)
- [ ] Create `hobo-quest/` project scaffold (Express app, placeholder routes)
- [ ] Add Nginx configs for all three domains
- [ ] Add systemd service files for hobo-tools and hobo-quest
- [ ] Update deploy script to handle all three services
- [ ] Update SETUP.md with multi-domain instructions

### Phase 1: SSO Provider
- [ ] Implement OAuth2 authorization server in hobo-tools
- [ ] Migrate hobostreamer.com users to central DB
- [ ] Add OAuth2 client to hobostreamer.com (dual auth during transition)
- [ ] Build login.hobo.tools UI (register, login, forgot password, profile)
- [ ] Build hobo.tools dashboard (account overview, connected services, theme picker)

### Phase 2: Game Migration
- [ ] Extract game + canvas code from hobostreamer into hobo-quest
- [ ] Set up hobo.quest with SSO auth from day one
- [ ] Migrate game database
- [ ] Update hobostreamer.com to redirect /game → hobo.quest/game
- [ ] Update hobostreamer.com to redirect /canvas → hobo.quest/canvas

### Phase 3: Tools Build-Out
- [ ] Build maps.hobo.tools (web port of HoboApp)
- [ ] Build dl.hobo.tools (YouTube downloader)
- [ ] Build conversion tools
- [ ] Full theme sync across all domains

### Phase 4: Cleanup
- [ ] Remove game code from hobostreamer.com
- [ ] Remove local auth from hobostreamer.com (SSO only)
- [ ] Deprecate HoboApp Electron in favor of maps.hobo.tools
- [ ] Unified monitoring/logging across all services

---

## Security Considerations

- **RS256 signing**: Asymmetric JWT signing means only hobo.tools holds the private key. Services verify with the public key — a compromised service can't forge tokens.
- **CSRF protection**: OAuth2 `state` parameter prevents CSRF on login redirects.
- **Token scope**: Access tokens include audience (`aud`) claim — tokens issued for hobostreamer.com can't be used on hobo.quest without explicit multi-audience.
- **Refresh token rotation**: Each refresh generates a new refresh token; old one is invalidated.
- **Ban propagation**: A ban on hobo.tools propagates to all services via webhook.
- **Rate limiting**: Each service has its own rate limits; hobo.tools auth endpoints are the most restricted.
- **Internal API**: Server-to-server calls use localhost + shared key, never exposed via Nginx.
