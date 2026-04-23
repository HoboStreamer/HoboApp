# HoboApp Monorepo Setup

This repository is the Hobo Network service monorepo. It contains shared infrastructure and multiple service folders, including the central `hobo-tools` service.

> This is not the standalone HoboStreamer service. The HoboStreamer livestream server lives in the sibling repository `HoboStreamer.com/`.

## Repository shape

Key folders in this repo:

- `hobo-tools/` — central SSO provider, internal API hub, admin routes, notifications, and service registry.
- `packages/hobo-shared/` — shared client/server helpers and UI components.
- `hobo-audio/`, `hobo-docs/`, `hobo-food/`, `hobo-img/`, `hobo-maps/`, `hobo-quest/`, `hobo-text/`, `hobo-yt/` — service application folders.
- `deploy/` — deployment examples and config snippets.
- `scripts/` — migration and maintenance scripts.

The root `package.json` contains metadata only and does not expose runnable scripts for the repo as a whole.

## Primary local target: `hobo-tools`

The active local bootstrap path for this repo is `HoboApp/hobo-tools`.

### Start here

```bash
cd HoboApp/hobo-tools
npm install
```

### Generate JWT keys

`hobo-tools` signs JWTs with RS256 keys. Generate them once:

```bash
mkdir -p data/keys
openssl genrsa -out data/keys/private.pem 2048
openssl rsa -in data/keys/private.pem -pubout -out data/keys/public.pem
```

The private key stays on `hobotools`; the public key is used by downstream services such as HoboStreamer and HoboQuest.

### Configure environment

Copy the template:

```bash
cp .env.example .env
```

At minimum, configure:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `INTERNAL_API_KEY`
- `BASE_URL`
- `HOBO_TOOLS_URL`
- `HOBO_TOOLS_INTERNAL_URL`
- `JWT_PRIVATE_KEY`
- `JWT_PUBLIC_KEY`

For local development, `BASE_URL` and `HOBO_TOOLS_URL` typically should both be `http://localhost:3100`.

### Recommended local dev values

```env
PORT=3100
NODE_ENV=development
BASE_URL=http://localhost:3100
HOBO_TOOLS_URL=http://localhost:3100
HOBO_TOOLS_INTERNAL_URL=http://127.0.0.1:3100
INTERNAL_API_KEY=change-me-to-a-random-secret
SETUP_TOKEN=change-me-to-a-second-random-secret
BOOTSTRAP_PROFILE=local-dev
JWT_PRIVATE_KEY=data/keys/private.pem
JWT_PUBLIC_KEY=data/keys/public.pem
HOBOSTREAMER_INTERNAL_URL=http://127.0.0.1:3000
HOBOQUEST_INTERNAL_URL=http://127.0.0.1:3200
```

### Start the service

```bash
npm start
```

For development mode:

```bash
npm run dev
```

## Service startup order

1. Start `hobo-tools` first.
2. Verify `hobo-tools` is reachable at `HOBO_TOOLS_INTERNAL_URL`.
3. Start dependent services such as `HoboStreamer.com` or `HoboApp/hobo-quest` afterwards.

Dependent services must share the same `INTERNAL_API_KEY` and typically also use `HOBO_TOOLS_URL` and the hobo.tools public key.

## `hobo-tools` configuration details

`HoboApp/hobo-tools/server/config.js` uses these environment values:

- `PORT` / `HOST`
- `BASE_URL` — public URL for hobo.tools pages and redirects.
- `HOBO_TOOLS_URL` — issuer/login URL for tokens and OAuth.
- `LOGIN_URL` — explicit login redirect URL override.
- `HOBO_TOOLS_INTERNAL_URL` / `INTERNAL_URL` — internal service endpoint.
- `INTERNAL_API_KEY` — shared internal API key.
- `SETUP_TOKEN` — optional bootstrap protection.
- `BOOTSTRAP_PROFILE` — controls registry seeding behavior.
- `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` — JWT key file paths.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- `DB_PATH`
- `HOBOSTREAMER_INTERNAL_URL`
- `HOBOQUEST_INTERNAL_URL`

### Important note

`hobo-tools` reads `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` from the environment. `RSA_PRIVATE_KEY_PATH` and `RSA_PUBLIC_KEY_PATH` are not used in the current code.

## Local testing flow

1. `cd HoboApp/hobo-tools`
2. `npm install`
3. `cp .env.example .env`
4. generate `data/keys/private.pem` and `data/keys/public.pem`
5. start `npm run dev`
6. confirm `/api/health` returns `{status: 'ok'}`

For HoboStreamer integration, start `HoboStreamer.com` after `hobo-tools` is available.

## Local OAuth details

When `BOOTSTRAP_PROFILE=local-dev`, `hobotools` seeds local OAuth redirect URIs for its first-party clients.

This includes at least:

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/api/auth/callback`
- `http://localhost:3200/auth/callback`
- `http://localhost:3200/api/auth/callback`

That is required for local login flows from HoboStreamer and HoboQuest.

## Required vs optional

### Required for a working local `hobo-tools`

- `INTERNAL_API_KEY`
- `JWT_PRIVATE_KEY`
- `JWT_PUBLIC_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `DB_PATH`

### Optional but useful

- `SETUP_TOKEN` — protects bootstrap endpoints.
- `BOOTSTRAP_PROFILE` — local-dev or production profiles.
- Email provider values for email notifications.
- `HOBOSTREAMER_INTERNAL_URL` and `HOBOQUEST_INTERNAL_URL` for internal proxy/webhook routes.

## Troubleshooting

### Common problems

- `npm start` fails because `data/keys` or key files are missing.
- `INTERNAL_API_KEY` mismatch between `hobo-tools` and downstream services.
- `HOBO_TOOLS_INTERNAL_URL` points to the wrong address.
- `HOBO_TOOLS_PUBLIC_KEY` is missing from dependent services.
- `BASE_URL` is not correct for local development.
- OAuth login fails with `invalid redirect_uri` if local HoboStreamer callback URIs are not seeded.

### Quick checks

- Confirm `hobotools` starts and serves `/api/health`.
- Confirm the admin user exists or is created from `.env`.
- Confirm `data/` directory is writable.
- Confirm local redirect URIs exist on the `hobostreamer` OAuth client when using `local-dev` mode.

## How this repo relates to HoboStreamer

- `HoboStreamer.com` is a separate repository and runtime.
- `hobo-tools` provides the central auth, OAuth server, and internal APIs used by HoboStreamer.
- `packages/hobo-shared/` contains shared code referenced by both repos.

## Existing docs

- `hobo-tools/README.md` — service-specific documentation for the `hobo.tools` server.
- `HoboApp/SETUP.md` — this file.

## Limitations

- There is no top-level `npm start` command for the repository root.
- This repo is not configured as a standalone Electron app in its current state.
