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
   
   # RPC Configuration (Polygon)
   RPC_URL=https://polygon-rpc.com
   # Optional: Only needed if you want to use a specific WS endpoint. Defaults to RPC_URL with ws://
   # RPC_WS_URL=wss://polygon-rpc.com

   # Polymarket CLOB Configuration
   CLOB_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
   
   # Trading Threshold (USD)
   MIN_AMOUNT_THRESHOLD=1000

   # Discord Configuration
   DISCORD_TOKEN=your_bot_token
   DISCORD_CHANNEL_ID=your_channel_id
   
   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   
   # Admin Security
   ADMIN_API_KEY=changeme
   ```

4. Run:
   ```bash
   bun start
   ```

## Discord Commands

Manage the bot directly from Discord:

*   **`!add <event_slug>`**: Add all markets for a specific Polymarket event.
    *   *Example*: `!add presidential-election-2024`
*   **`!remove <event_slug>`**: Remove all monitored markets for an event.
    *   *Example*: `!remove presidential-election-2024`
*   **`!setthreshold <amount>`**: Dynamically update the minimum trade amount ($) for notifications.
    *   *Example*: `!setthreshold 5000`

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

1. **Market Monitoring**: connect to Polymarket's **CLOB (Central Limit Order Book)** via WebSocket for real-time trade data.
2. **Filtering**: Trades are filtered by the `MIN_AMOUNT_THRESHOLD`.
3. **Queueing**: Valid trades are pushed to a **Redis Queue** for reliable processing.
4. **Processing**: Workers pick up trades, calculate implied probabilities locally (YES + NO = 100%), and format Discord embeds.
5. **Notification**: Alerts are sent to the configured Discord channel.
