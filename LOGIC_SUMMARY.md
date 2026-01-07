# Polymarket Bot - Logic Summary

## Overview

This bot monitors Polymarket trades by listening to the **Polymarket Central Limit Order Book (CLOB)** via WebSocket. It utilizes an **Event-Driven Architecture** with **Redis** to ensure high throughput, reliability, and rate-limit protection for Discord notifications.

## Core Architecture

```mermaid
graph TD
    CLOB[Polymarket CLOB WebSocket] -->|Real-time Trade Data| Listener[CLOB Listener Producer]
    Listener -->|Add Job (Fast)| Redis[(Redis Queue)]
    Redis -->|Process Job (Rate Limited)| Worker[Trade Worker Consumer]
    Worker -->|Fetch Prices (Cached)| GammaAPI[Polymarket Gamma API]
    Worker -->|Send Embed| Discord[Discord Webhook]
```

## Key Components

### 1. CLOB Listener (Producer) -- `src/clob/clobListener.js`
*   **Role**: Connects to Polymarket's WebSocket (`wss://ws-subscriptions-clob.polymarket.com/ws/market`).
*   **Function**: Subscribes to specific "Asset IDs" (Token IDs) for markets.
*   **Logic**:
    *   Listens for `last_trade_price` events.
    *   Filters trades below `MIN_AMOUNT_THRESHOLD`.
    *   **Action**: Pushes trade data to **Redis Queue** immediately (Fire-and-Forget).
*   **Robustness**: Implements **Auto-Reconnection** with exponential backoff if the WebSocket drops.

### 2. Redis Queue (BullMQ) -- `src/queue/tradeQueue.js`
*   **Role**: Buffers trade events to decouple ingestion from processing.
*   **Technology**: Redis + BullMQ.
*   **Configuration**:
    *   **Rate Limit**: Max 5 jobs per second (protects Discord/Gamma API).
    *   **Persistence**: Jobs are saved to Redis, surviving bot restarts.

### 3. Trade Worker (Consumer) -- `src/queue/tradeQueue.js`
*   **Role**: Processes queued trades.
*   **Workflow**:
    1.  Pick up job from Redis.
    2.  Fetch current market outcome prices (e.g., Yes: 60%, No: 40%).
    3.  Format Rich Embed (Green for Buy, Red for Sell).
    4.  Send to Discord.

### 4. Price API & Caching -- `src/server.js`
*   **Role**: Fetches current prices for the "Current Prices" field in the notification.
*   **Optimization**: Implements an **In-Memory Cache (TTL: 5 seconds)**.
*   **Benefit**: Prevents 429 Rate Limit errors from Polymarket's API during high-frequency trading bursts.

---

## Data Flow

1.  **Market Add**: User adds a market via API via `POST /api/events/:slug`.
2.  **Lookup**: Bot fetches Token IDs from Gamma API and stores them in SQLite.
3.  **Subscription**: `clobListener` batches the new markets and restarts the WebSocket **once** to subscribe to them.
4.  **Trade Event**:
    *   Websocket emits `last_trade_price`.
    *   `clobListener` pushes to `trade-notification-queue`.
5.  **Notification**:
    *   Worker pops the job.
    *   Worker calls `fetchMarketOutcomePrices(slug)`.
        *   *Cache Hit*: Returns data instantly.
        *   *Cache Miss*: ISO Fetch -> Gamma API -> Save to Cache.
    *   Worker constructs embed and posts to Discord.

## Scalability Features

1.  **Decoupling**: The WebSocket listener never waits for HTTP requests. It can handle thousands of messages per second.
2.  **Load Leveling**: If 100 trades happen in 1 second, the Queue accepts them all, but the Worker processes them at a safe 5/sec pace.
3.  **Batching**: Market subscriptions are batched to prevent "Death by Restart" loops.
4.  **Reliability**: Auto-reconnect ensures the bot recovers from network failures automatically.

## Key Files

- `src/clob/clobListener.js`: WebSocket handling & Producer logic.
- `src/queue/tradeQueue.js`: Redis Queue definition & Worker logic.
- `src/server.js`: API endpoints & Price Caching.
- `src/database/marketRegistry.js`: SQLite storage for market metadata.
- `src/discord/notifier.js`: Embed styling.
