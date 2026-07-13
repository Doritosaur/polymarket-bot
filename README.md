# Polymarket Monitor Bot

Monitor Polymarket smart contracts for large transactions and get Discord notifications.

## Quick Start


1. **Docker Compose (Recommended)**
   ```bash
   # .env is optional; use it to override defaults or enable Discord
   docker-compose up -d --build
   ```

2. **Manual Setup**
   
   Prerequisites:
   - [Bun](https://bun.sh)
   - Redis (running on default port 6379)
   - PostgreSQL (running on default port 5432)

   Install dependencies:
   ```bash
   bun install
   ```

   Optionally configure `.env`:
   ```env
   PORT=3000
   
   # Polymarket CLOB Configuration
   CLOB_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
   
   # Trading Threshold (USD)
   MIN_AMOUNT_THRESHOLD=1000

   # Optional Discord integration (omit all three to run without Discord)
   DISCORD_TOKEN=your_bot_token
   DISCORD_CLIENT_ID=your_application_id
   DISCORD_GUILD_ID=your_test_guild_id
   
   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   
   # Postgres Configuration
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_USER=admin
   POSTGRES_PASSWORD=adminpassword
   POSTGRES_DB=polymarket
   
   # Admin Security
   ADMIN_API_KEY=changeme
   ```

   Run the services (in separate terminals):
   ```bash
   # Terminal 1: Ingestion Service (Monitors markets)
   bun run start:ingest
   
   # Terminal 2: API/gateway (also sends notifications when Discord is enabled)
   bun start
   ```

   The API, signal engine, ingestion service, and web app work without Discord
   credentials. To enable Discord, set `DISCORD_TOKEN`, then register slash
   commands separately with `bun run deploy` (requires `DISCORD_CLIENT_ID`).

## Deploy a Free PoC on Render

The included `render.yaml` deploys the project as four free resources:

- `polymarket-service`: the API and ingestion service in one supervised container
- `polymarket-dashboard`: the static React dashboard
- `polymarket-redis`: a non-persistent Render Key Value instance
- `polymarket-db`: a Render Postgres database

Push the repository to GitHub or GitLab, choose **New → Blueprint** in Render,
connect the repository, and apply the Blueprint. No Discord variables are
required. To enable Discord later, add `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and
optionally `DISCORD_GUILD_ID` to `polymarket-service`, then run `bun run deploy`
from a trusted local environment with the same credentials.

This configuration is intended only for a proof of concept. The web service
sleeps after Render's free-tier idle period, Redis data can be lost on restart,
and the free Render Postgres database expires after 30 days.

## Discord Commands

Manage the bot directly from Discord:

*   **`!add <event_slug>`**: Add all markets for a specific Polymarket event.
    *   *Example*: `!add presidential-election-2024`
*   **`!remove <market_slug_fragment>`**: Remove single market by partial slug match.
    *   *Example*: `!remove trump`
*   **`!setthreshold <amount>`**: Dynamically update the global minimum trade amount ($).
    *   *Example*: `!setthreshold 5000`
*   **`!setevent <event_slug_or_fragment> <amount>`**: Set a custom threshold for a specific event (overrides global).
    *   *Example*: `!setevent israel-strikes 100`
*   **`!event <event_slug>`**: View real-time stats (prices, volume) for an event.
    *   *Example*: `!event presidential-election-2024`

## API

**Add an event (and its markets):**
```bash
curl -X POST http://localhost:3000/api/events/presidential-election-2024 \
  -H "x-api-key: changeme"
```

**Remove an event:**
```bash
curl -X DELETE http://localhost:3000/api/events/presidential-election-2024 \
  -H "x-api-key: changeme"
```

**Status:**
- `GET /health` - Health check
- `GET /status` - Server status & market count

## How It Works

1. **Ingestion Service**: Connects to Polymarket's **CLOB (Central Limit Order Book)** via WebSocket for real-time trade data. It filters trades by `MIN_AMOUNT_THRESHOLD` and pushes valid trades to a **Redis Queue**.
2.  **Signal Engine**: Analyzes every single trade in real-time to detect whales ($20k+), volume anomalies, price velocity, and regional surges.
    *   [📖 Read Signal Engine Docs](SIGNAL_ENGINE.md)
3.  **Map Engine**: A high-performance visualization system that processes thousands of markets in a WebWorker and renders them using MapLibre GL.
    *   [📖 Read Map Engine Docs](MAP_ENGINE.md)
4.  **Bot Service**: Consumes trades from Redis, calculates implied probabilities locally (YES + NO = 100%), and formats Discord embeds.

## Documentation

- [**Signal Engine**](SIGNAL_ENGINE.md): Deep dive into detection algorithms (Whale, Velocity, Anomaly).
- [**Map Engine**](MAP_ENGINE.md): How the WebGL map handles real-time data and geocoding.
- [**Logic Summary**](LOGIC_SUMMARY.md): Overview of the microservices architecture.
