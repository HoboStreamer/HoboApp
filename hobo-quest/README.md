# HoboQuest

Community MMORPG and collaborative pixel canvas for the Hobo Network.

**Part of the [Hobo Network](../ARCHITECTURE.md)** — `https://hobo.quest`

---

## What it does

- **MMORPG** — 512×512 tile world with combat, fishing, mining, woodcutting, crafting, building, and dungeons. Level up, equip gear, explore, and trade.
- **Canvas** — 512×512 collaborative pixel canvas (r/place style). Place pixels, claim territory, create art together.
- **Leaderboards** — Rankings for level, gold, skills, dungeons, and achievements.
- **Daily Quests** — Rotating objectives with rewards.
- **Achievements** — 30+ milestones to unlock.

---

## Architecture

```
hobo.quest (port 3200)
├── server/
│   ├── index.js          # Express app, JWT verification, auth middleware
│   ├── config.js         # Port, OAuth2 client, game/canvas config
│   ├── auth/
│   │   └── routes.js     # OAuth2 callback, login redirect, logout
│   ├── api/
│   │   ├── game-routes.js    # Character, inventory, leaderboards, buildings
│   │   └── canvas-routes.js  # Pixel state, place pixel, cooldowns, stats
│   └── db/
│       └── database.js   # Game schema (characters, skills, canvas, etc.)
├── public/
│   └── index.html        # Landing page
├── deploy/
│   ├── nginx/            # hobo.quest.conf
│   └── systemd/          # hobo-quest.service
└── .env.example
```

---

## Authentication

HoboQuest is an **OAuth2 client** of `hobo.tools`. It does not manage its own user accounts.

1. User clicks "Sign in to Play" → redirects to `hobo.tools/authorize`
2. After authorization, user returns to `/auth/callback` with an auth code
3. Server exchanges code for RS256 JWT tokens
4. Character is auto-created on first login
5. JWT is verified locally using `hobo.tools` public key (RS256)

---

## Setup

```bash
# 1. Install dependencies
cd hobo-quest && npm install

# 2. Copy RSA public key from hobo.tools
mkdir -p data/keys
cp ../hobo-tools/data/keys/public.pem data/keys/

# 3. Configure environment
cp .env.example .env
# Set OAUTH_CLIENT_SECRET (from hobo-tools console output)
# Set INTERNAL_API_KEY (must match hobo-tools)

# 4. Run
npm start
```

---

## Game Migration

The MMORPG and canvas currently live in `hobostreamer/server/game/` (~5,900 lines). The migration plan:

1. **Phase 1** (current): Stub API + schema scaffolded
2. **Phase 2**: Port game engine, items, canvas service from hobostreamer
3. **Phase 3**: Wire WebSocket game server for real-time multiplayer
4. **Phase 4**: Legacy data migration from hobostreamer's game tables

See [ARCHITECTURE.md](../ARCHITECTURE.md) for the full migration strategy.

---

## License

Same as the parent [Hobo Network](../LICENSE) project.
