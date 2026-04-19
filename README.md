# HoboApp Monorepo

This repository is the Hobo Network service monorepo. It contains the shared infrastructure and backend services used by the Hobo Network, including the central `hobo-tools` identity provider.

> The classic HoboApp Electron client is not present as a standalone runnable app in this repository. The main active service in this repo is `HoboApp/hobo-tools`.

---

## What this repo contains

- `hobo-tools/` — central SSO provider, internal API hub, admin panel, notifications, and service registry.
- `hobo-audio/`, `hobo-docs/`, `hobo-food/`, `hobo-img/`, `hobo-maps/`, `hobo-quest/`, `hobo-text/`, `hobo-yt/` — sibling Hobo services.
- `packages/hobo-shared/` — shared client/server helpers and auth UI components used by Hobo services.
- `deploy/` — deployment examples, Nginx configs, and systemd snippets.
- `scripts/` — migration and maintenance utilities.
- `README.md` — this repo-level overview.

---

## Repository role

This repository is the broader Hobo Network backend monorepo. It is not the standalone HoboStreamer livestream server.

- `hobo-tools` is the central identity provider, auth issuer, and internal API hub.
- `packages/hobo-shared` provides shared helper code and browser auth/UI integration.
- HoboStreamer’s runtime lives in the sibling repository `HoboStreamer.com/`.

---

## Relationship to HoboStreamer

- `HoboStreamer.com` depends on `hobo.tools` for OAuth2 authentication, JWT token issuance, and token verification.
- `HoboStreamer.com` also depends on the local `packages/hobo-shared` package, typically available from this monorepo.
- The HoboStreamer service is intentionally separate from this repo; use `HoboStreamer.com/` for streaming server work.

---

## Local setup overview

There is no runnable top-level script in the root `package.json`. Run services from their individual project folders.

### Typical local entry points

- `cd hobo-tools && npm install && npm start` — start the central `hobo-tools` service.
- `cd hobo-tools && npm run dev` — run `hobo-tools` in development mode.

To run the streaming backend, open the sibling `HoboStreamer.com/` repository and follow its own setup.

---

## HoboTools service

`HoboApp/hobo-tools` is the main local bootstrap service for this repo.

- `server/index.js` initializes the SQLite DB, loads URL registry values, creates admin accounts, and starts Express.
- `server/config.js` reads `.env`, applies defaults, and resolves runtime service URLs.
- `server/db/database.js` seeds OAuth2 clients for `hobostreamer` and `hoboquest` and supports local callback URIs in `local-dev` mode.
- `hobo-tools/.env.example` documents the configuration values you should set.
- `packages/hobo-shared` is the local shared package used by `hobo-tools` and other services.

See [hobo-tools/README.md](hobo-tools/README.md) and [SETUP.md](SETUP.md) for service-specific setup details.

---

## When to use this repo

Use this repository when you need:

- the central `hobo.tools` identity provider and OAuth2 server.
- shared auth and UI helper code for Hobo services.
- backend service registry configuration and admin tooling.
- local development of `hobo-tools`, including URL registry and OAuth client setup.

Do not use this repo alone expecting the livestream platform. That service is in `HoboStreamer.com/`.

---

## Important notes

- `HoboApp/package.json` contains metadata only and does not expose runnable service scripts.
- `HoboApp/hobo-tools` can auto-create its database, admin user, and default OAuth clients on first startup.
- `hobotools`, `HoboStreamer.com`, and `HoboApp/hobo-quest` must share the same `INTERNAL_API_KEY` for internal API calls.
- `HOBO_TOOLS_URL` is used as the issuer/login URL by `hobotools`; `HOBO_TOOLS_INTERNAL_URL` is the internal API endpoint.
- `BOOTSTRAP_PROFILE=local-dev` seeds local dev URL registry values and local redirect URIs such as `http://localhost:3000/api/auth/callback`.
- `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` are required; `RSA_PRIVATE_KEY_PATH` / `RSA_PUBLIC_KEY_PATH` are no longer used.

---

## License

See [LICENSE](LICENSE).
