# Polymarket Monitor Bot

Monitor Polymarket smart contracts for large transactions and get Discord notifications.

## Quick Start

1. Install Bun:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Configure `.env`:
   ```env
   PORT=3000
   RPC_URL=https://polygon-rpc.com
   RPC_WS_URL=wss://polygon-rpc.com
   MIN_AMOUNT_THRESHOLD=100000
   DISCORD_TOKEN=your_bot_token
   DISCORD_CHANNEL_ID=your_channel_id
   ```
   
   **Important:** `RPC_WS_URL` is **required** for real-time event subscriptions. Use a WebSocket provider:
   - Alchemy: `wss://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
   - Infura: `wss://polygon-mainnet.infura.io/ws/v3/YOUR_PROJECT_ID`
   - Public: `wss://polygon-rpc.com`

4. Run:
   ```bash
   bun start
   ```

## Discord Setup

1. Create a bot at https://discord.com/developers/applications
2. Enable "Message Content Intent"
3. Copy bot token to `.env`
4. Enable Developer Mode in Discord, right-click channel → Copy Channel ID

## API

**Add a contract:**
```bash
curl -X POST http://localhost:3000/api/contracts \
  -H "Content-Type: application/json" \
  -d '{"address": "0x..."}'
```

**List contracts:**
```bash
curl http://localhost:3000/api/contracts
```

**Remove a contract:**
```bash
curl -X DELETE http://localhost:3000/api/contracts/0x...
```

**Status:**
- `GET /health` - Health check
- `GET /status` - Server status

## How It Works

1. Contracts stored in SQLite (`data/contracts.db`)
2. WebSocket listeners monitor events in real-time
3. Large transactions trigger Discord notifications

## Environment Variables

- `PORT` - Server port (default: 3000)
- `RPC_URL` - Polygon RPC endpoint (HTTP, for initial connection)
- `RPC_WS_URL` - **Required** - Polygon WebSocket RPC endpoint for real-time subscriptions
- `MIN_AMOUNT_THRESHOLD` - Minimum token amount to notify (default: 10000)
- `DISCORD_TOKEN` - Discord bot token
- `DISCORD_CHANNEL_ID` - Discord channel ID
