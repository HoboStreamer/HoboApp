# HoboTools

Central hub and SSO provider for the Hobo Network. Manages user accounts, OAuth2 authorization, theme preferences, notifications, email alerts, anonymous identities, and internal APIs that connect all Hobo services together.

**Part of the [Hobo Network](../ARCHITECTURE.md)** — `https://hobo.tools`

---

## What it does

- **SSO Identity Provider** — "One Account. All of Hobo." Central registration and login, OAuth2 Authorization Code flow for HoboStreamer and HoboQuest.
- **Unified Notification System** — Cross-service notifications with priority levels, category filtering, toast popups, bell badge, sounds, and rich content (buttons, inputs, media). All services push notifications to the central API; clients poll every 15 seconds.
- **Amazon SES Email Alerts** — Critical notifications (moderation actions, system alerts) trigger email via Amazon SES. Configurable through the admin panel or `.env`.
- **Anonymous Users** — Browse and interact without an account. Anon users receive a unique number, can accumulate stats, and optionally link to a registered account later.
- **Multi-Account Switching** — Google-style account management. Users can add multiple accounts and switch instantly, including an anonymous mode.
- **Theme Catalog** — Shared theme system with ~30 built-in themes and community submissions. Theme preferences sync across all services.
- **Admin Panel** — SES configuration, user management (role changes, bans), broadcast notifications, system health dashboard, and audit log.
- **Internal API** — Server-to-server endpoints for token verification, user lookup, notification push, account linking, and audit logging. Protected by `X-Internal-Key`.
- **Subdomain Services** — `login.hobo.tools` (SSO), `my.hobo.tools` (account management), `maps.hobo.tools` (camp locator), `dl.hobo.tools` (media tools).

---

## Architecture

```
hobo.tools (port 3100)
├── server/
│   ├── index.js              # Express app, CORS, service init, periodic tasks
│   ├── config.js             # Port, JWT, DB, OAuth, connected services
│   ├── auth/
│   │   ├── routes.js         # Register, login, profile, anon sessions, multi-account, follows
│   │   └── oauth-routes.js   # OAuth2 authorize, token, OIDC discovery
│   ├── notifications/
│   │   ├── notification-service.js  # CRUD, preferences, email queue, cleanup
│   │   ├── routes.js                # REST API for notification UI
│   │   └── ses-service.js           # Amazon SES email with HTML templates
│   ├── admin/
│   │   └── routes.js         # Admin panel API (SES, settings, users, broadcast, health)
│   ├── themes/
│   │   └── routes.js         # Theme CRUD, user preferences
│   ├── internal/
│   │   └── routes.js         # Server-to-server API (verify-token, user sync, notif push)
│   └── db/
│       └── database.js       # SQLite schema, migrations, seeding
├── public/
│   ├── index.html            # Dashboard SPA (themes, settings, integrations)
│   ├── login.html            # Animated login/register page
│   └── my.html               # Account management (profile, sessions, notifications)
├── deploy/
│   ├── nginx/                # hobo.tools.conf (wildcard *.hobo.tools)
│   └── systemd/              # hobo-tools.service
└── .env.example
```

---

## Setup

```bash
# 1. Install dependencies
cd hobo-tools && npm install

# 2. Generate RSA keys for JWT signing
mkdir -p data/keys
openssl genrsa -out data/keys/private.pem 2048
openssl rsa -in data/keys/private.pem -pubout -out data/keys/public.pem

# 3. Configure environment
cp .env.example .env
# Edit .env — set INTERNAL_API_KEY, ADMIN_PASSWORD, and optionally SES credentials

# 4. Run
npm start
```

The server auto-creates the SQLite database and seeds OAuth2 clients on first run. Client secrets are logged to console — copy them to `hobo-quest/.env` and `hobostreamer/.env`.

---

## Notification System

### How it works

1. **Any service** pushes notifications to hobo.tools via `POST /internal/notifications/push`
2. **hobo.tools** stores them in SQLite with priority, category, and optional rich content
3. **Clients** poll `GET /api/notifications` every 15 seconds, rendering toasts and updating the bell badge
4. **Critical notifications** are queued for email delivery via Amazon SES (if configured)

### Priorities

| Priority | Behavior |
|----------|----------|
| `low` | Silent — badge only, no toast or sound |
| `normal` | Standard toast with subtle notification sound |
| `high` | Persistent toast with attention sound, auto-dismiss 8s |
| `critical` | Sticky toast (must dismiss), urgent sound, **triggers email** |

### Categories

`social`, `chat`, `game`, `stream`, `economy`, `achievement`, `moderation`, `system`, `service`, `admin`

Users can toggle each category's enabled/sound/toast/email preferences at `my.hobo.tools` → Notifications tab.

### Cross-Service Push

Other services push notifications to hobo.tools via the internal API:

```bash
curl -X POST http://127.0.0.1:3100/internal/notifications/push \
  -H "X-Internal-Key: $INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": 42, "type": "new_follower", "data": {"actorName": "someone"}}'
```

---

## Amazon SES Setup

SES is optional — the notification system works without it. Email is only sent for **CRITICAL** priority notifications.

### Quick setup

1. In AWS Console → SES → Verify your domain (`hobo.tools`)
2. In AWS Console → IAM → Create a user with `AmazonSESFullAccess` policy
3. Copy the access key ID and secret to `.env` or configure via the admin panel
4. Add DNS records in Cloudflare for DKIM verification (SES provides the CNAME records)

### Admin panel configuration

Instead of `.env`, you can configure SES at runtime:
- `GET /api/admin/ses` — view current config
- `PUT /api/admin/ses` — update region, credentials, from address
- `POST /api/admin/ses/test` — send a test email

---

## Anonymous Users

Anonymous users can browse and interact without creating an account:

- Each anon user gets a unique number (e.g., "Anonymous #42")
- Stats and preferences are tracked via a session token
- Fingerprint matching reconnects returning anonymous visitors
- Anon identities can be linked to a registered account at any time, merging stats
- Multi-account switcher includes a "Continue as Anonymous" option

### API

- `POST /api/auth/anon-session` — create anonymous session
- `GET /api/auth/anon/:token` — get anon user info
- `PUT /api/auth/anon/:token/preferences` — update anon preferences
- `POST /api/auth/anon/:token/link` — link anon identity to registered account

---

## Multi-Account Switching

Google-style account management supporting up to 5 accounts:

- Accounts stored client-side in `localStorage` (`hobo_accounts`)
- Server tracks active sessions via `user_sessions` table
- Switch accounts instantly without re-authentication
- Includes anonymous mode as a switchable identity
- Shared `account-switcher.js` component renders the switcher UI on all services

### API

- `GET /api/auth/sessions` — list active sessions
- `POST /api/auth/sessions` — create session record
- `DELETE /api/auth/sessions/:id` — revoke single session
- `DELETE /api/auth/sessions` — revoke all sessions

---

## OAuth2 Flow

1. Service redirects user to `https://hobo.tools/authorize?client_id=...&redirect_uri=...`
2. If user has `hobo_token` cookie → issue authorization code → redirect to service
3. If no cookie → redirect to `login.hobo.tools` → user signs in → cookie set → resume flow
4. Service exchanges code for access + refresh tokens via `POST /token`
5. Access tokens are RS256 JWT (24h) verified by any service with the public key
6. Refresh tokens rotate on use (30d)

---

## Shared Client Libraries

The `packages/hobo-shared/` directory provides drop-in vanilla JS components served at `/shared/`:

| File | Purpose |
|------|---------|
| `navbar.js` | Universal top bar with service links, notification bell mount, user dropdown |
| `notification-ui.js` | Toast popups, bell badge, notification panel with category tabs |
| `account-switcher.js` | Multi-account switcher panel with anonymous mode |
| `user-card.js` | Right-click context menu + user profile card with name effects |
| `notifications.js` | Shared constants (priorities, categories, types) — also used server-side |

Include them in any service page:
```html
<script src="https://hobo.tools/shared/navbar.js"></script>
<script src="https://hobo.tools/shared/notification-ui.js"></script>
<script src="https://hobo.tools/shared/account-switcher.js"></script>
<script src="https://hobo.tools/shared/user-card.js"></script>
```

---

## Admin Panel

Accessible to users with `role = 'admin'`. All endpoints under `/api/admin/`.

| Endpoint | Description |
|----------|-------------|
| `GET /api/admin/ses` | SES configuration status |
| `PUT /api/admin/ses` | Update SES credentials and settings |
| `POST /api/admin/ses/test` | Send test email |
| `GET /api/admin/settings` | All site settings (secrets masked) |
| `PUT /api/admin/settings` | Update site settings |
| `GET /api/admin/users` | User list with search |
| `PUT /api/admin/users/:id/role` | Change user role |
| `PUT /api/admin/users/:id/ban` | Ban/unban user (sends notification) |
| `POST /api/admin/broadcast` | Send notification to all non-banned users |
| `GET /api/admin/health` | System health (counts, memory, uptime, SES status) |
| `GET /api/admin/audit` | Audit log |

---

## Connected Services

| Service | Port | OAuth Client ID |
|---------|------|-----------------|
| HoboStreamer | 3000 | `hobostreamer` |
| HoboQuest | 3200 | `hoboquest` |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Accounts (username, email, password hash, role, bio, effects) |
| `oauth_clients` | Registered OAuth2 applications |
| `oauth_codes` | Authorization codes (5-min TTL) |
| `refresh_tokens` | Rotating refresh tokens (30-day) |
| `linked_accounts` | Connected external service accounts |
| `themes` | Theme catalog entries |
| `user_theme_prefs` | Per-user theme selections |
| `site_settings` | Key-value admin settings (SES config, etc.) |
| `audit_log` | Admin action audit trail |
| `notifications` | All user notifications (UUID PK) |
| `notification_preferences` | Per-user category preferences |
| `anon_users` | Anonymous user identities |
| `user_sessions` | Active session tracking for multi-account |
| `user_effects` | Equipped name/particle effects |
| `follows` | User follow relationships |

---

## License

Same as the parent [Hobo Network](../LICENSE) project.
