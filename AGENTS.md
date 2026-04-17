# AGENTS.md — Hobo Network Services (HoboApp Monorepo)

## Project Overview

Monorepo for the **Hobo Network** — a suite of web services under `hobo.tools` with centralized SSO. See [ARCHITECTURE.md](ARCHITECTURE.md) for full system design and domain map.

## Commands

```bash
# Per-service (run from each service directory):
npm start                 # Production: node server/index.js
npm run dev               # Dev: NODE_ENV=development or node --watch

# No global build, test runner, or linter configured.
# Syntax check individual files:
node --check <file.js>
```

**Ports:** hobo-tools=3100, hobo-quest=3200, hobo-maps=3300, hobo-food=3301, hobo-docs=3400, hobo-img=3400, hobo-yt=3401, hobo-audio=3500, hobo-text=3600

## Architecture at a Glance

- **hobo-tools** — SSO provider, account dashboard, OAuth2 authorization server, admin panel, notifications hub. All other services authenticate against it.
- **hobo-quest** — Community MMORPG + collaborative pixel canvas.
- **hobo-audio/img/docs/yt/text/food/maps** — Stateless utility services behind `*.hobo.tools` subdomains.
- **packages/hobo-shared** — Shared auth, themes, notifications, branding. Linked via `file:` dep.

### Service Structure (consistent across all services)

```
service/
├── server/
│   ├── index.js          # Express app, middleware stack, route mounting
│   ├── config.js         # Reads .env via dotenv
│   ├── db/database.js    # SQLite schema + queries (better-sqlite3)
│   ├── auth/             # OAuth2 callback, token exchange
│   └── api/              # Domain-specific routes
├── public/               # Static frontend (vanilla JS, no build)
├── deploy/               # systemd unit, nginx config
└── data/                 # Runtime data (db, keys, uploads) — gitignored
```

## Conventions

- **CommonJS + strict mode:** Every file starts with `'use strict';` and uses `require()`/`module.exports`.
- **Style:** 4-space indent, single quotes, semicolons.
- **Naming:** `camelCase` in JS, `snake_case` in SQL tables/columns.
- **Middleware stack order:** helmet → cors → cookieParser → express.json → rateLimit → analytics → optionalAuth → routes.
- **Auth middleware:** `requireHoboAuth` (must be logged in) vs `optionalHoboAuth` (sets `req.user` if token present). From `hobo-shared/middleware.js`.
- **Internal APIs:** Localhost-only, protected by `X-Internal-Key` header. Used for cross-service calls (push notifications, token verification).
- **Config:** `.env` files with `dotenv`. Defaults in `config.js` allow running without `.env` in dev.
- **DB migrations:** Inline `ALTER TABLE` in `ensureTables()` wrapped in `try/catch` — no migration framework.
- **Error handling:** Graceful degradation — services start with reduced features if optional deps (RSA keys, SES, etc.) are missing.
- **Trust proxy:** Set to `2` (Cloudflare → Nginx → Node).

## hobo-shared Package

Location: [packages/hobo-shared/](packages/hobo-shared/)

| Module | Exports |
|--------|---------|
| `middleware.js` | `extractToken`, `requireHoboAuth`, `optionalHoboAuth`, `internalApiAuth` |
| `auth-client.js` | `HoboAuthClient` (OAuth2 flow: getAuthUrl, exchangeCode, verifyToken, refreshToken) |
| `theme-sync.js` | Theme engine — applies CSS variables, syncs across domains via localStorage + API |
| `builtin-themes.js` | ~30 built-in themes with 21 standardized CSS variables |
| `notifications.js` | Types, priorities, categories, email eligibility rules |
| `notification-ui.js` | Client-side toast/bell/badge system (15s polling) |
| `brand.js` | Brand constants: URLs, colors, OAuth client IDs, services list |
| `navbar.js` | Universal navbar (service links, notification bell) |
| `account-switcher.js` | Multi-account management UI |

**Important:** Changes to hobo-shared affect all services — verify across projects.

## Key Pitfalls

- **RSA keys required:** Generate before first run — `openssl genrsa -out data/keys/private.pem 2048`. Copy public key to all client services.
- **OAuth client secrets:** Logged to console on hobo-tools startup — copy to other services' `.env` files.
- **No build step:** Frontend JS served directly. No bundler, transpiler, or minifier.
- **System deps:** hobo-audio/img/yt require `ffmpeg` and `yt-dlp` installed on the system.
- **File retention:** Utility services auto-delete uploaded files (1h anon, 24h authed).
- **Port conflicts:** hobo-docs and hobo-img both default to 3400 — override via `.env` when running simultaneously.
- **SSO migration completed:** HoboStreamer.com now uses hobo.tools OAuth2 SSO. Legacy migration scripts remain for historical reference only.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Full network architecture, domain map, data flows
- [packages/hobo-shared/](packages/hobo-shared/) — Shared package source (read the JSDoc comments)
- Service READMEs: [hobo-tools](hobo-tools/README.md), [hobo-quest](hobo-quest/README.md), [hobo-audio](hobo-audio/README.md), [hobo-img](hobo-img/README.md), [hobo-yt](hobo-yt/README.md)
