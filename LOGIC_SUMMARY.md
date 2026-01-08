# Polymarket Bot - Logic Summary

## Overview

This bot monitors Polymarket trades by listening to the **Polymarket Central Limit Order Book (CLOB)** via WebSocket. It utilizes an **Event-Driven Architecture** with **Redis** to ensure high throughput, reliability, and rate-limit protection for Discord notifications.

## Core Architecture

```mermaid
graph TD
    CLOB[Polymarket CLOB WebSocket] -->|Real-time Trade Data| Listener[CLOB Listener Producer]
    Listener -->|Add Job (Fast)| Redis[(Redis Queue)]
    Redis -->|Process Job (Rate Limited)| Worker[Trade Worker Consumer]
    Worker -->|Calculate Probabilities| LocalCalc[Local Math]
    Worker -->|Send Embed| Discord[Discord Webhook]
```

## Key Components

### 1. CLOB Listener (Producer) -- `src/clob/clobListener.js`
*   **Role**: Connects to Polymarket's WebSocket (`wss://ws-subscriptions-clob.polymarket.com/ws/market`).
*   **Function**: Subscribes to specific "Asset IDs" (Token IDs) for markets.
*   **Logic**:
    *   Listens for `last_trade_price` events.
    *   Filters trades below `MIN_AMOUNT_THRESHOLD` (Dynamic).
    *   **Action**: Pushes trade data to **Redis Queue** immediately (Fire-and-Forget).
*   **Robustness**: Implements **Auto-Reconnection** with exponential backoff if the WebSocket drops.

### 2. Redis Queue (BullMQ) -- `src/queue/tradeQueue.js`
*   **Role**: Buffers trade events to decouple ingestion from processing.
*   **Technology**: Redis + BullMQ.
*   **Configuration**:
    *   **Rate Limit**: Max 5 jobs per second (protects Discord API).
    *   **Persistence**: Jobs are saved to Redis, surviving bot restarts.

### 3. Trade Worker (Consumer) -- `src/queue/tradeQueue.js`
*   **Role**: Processes queued trades.
*   **Workflow**:
    1.  Pick up job from Redis.
    2.  **Calculate Prices**: Uses the trade price to imply outcomes (e.g., if YES trades at $0.60, YES=60%, NO=40%). **No external API calls required.**
    3.  Format Rich Embed (Green for Buy, Red for Sell).
    4.  Send to Discord.

### 4. Market Registry -- `src/database/marketRegistry.js`
*   **Role**: Persistent storage for tracked markets and bot settings.
*   **Storage**: SQLite (`data/markets.db`).
*   **Features**:
    *   Stores `clob_token_ids` for subscriptions.
    *   Stores `event_slug` to allow bulk deletion of markets by event.
    *   Persists `minAmountThreshold` so dynamic changes survive restarts.

---

## Data Flow

1.  **Market Add**: User adds an event via `!add` or API (`POST /api/events/:slug`).
2.  **Lookup**: Bot fetches Token IDs from Gamma API (one-time) and stores them in SQLite.
3.  **Subscription**: `clobListener` batches the new markets and restarts the WebSocket to subscribe.
4.  **Trade Event**:
    *   Websocket emits `last_trade_price`.
    *   `clobListener` checks `current_threshold` vs trade value.
    *   Pushes to `trade-notification-queue`.
5.  **Notification**:
    *   Worker pops the job.
    *   Worker calculates probabilities.
    *   Worker posts to Discord.

## Scalability Features

*   **Incremental Subscriptions**: Adding/removing markets sends dynamic subscription messages to the CLOB WebSocket without disconnecting or restarting.
*   **In-Memory Thresholds**: Updating event thresholds is instant and requires no database reads or restarts.
*   **Load Leveling**: Redis absorbs spikes in trading activity.

## Key Files

- `src/clob/clobListener.js`: WebSocket handling (Incremental updates supported).
- `src/queue/tradeQueue.js`: Redis Queue definition & Worker logic.
- `src/utils/gammaClient.js`: Centralized Gamma API interaction.
- `src/utils/number.js`: Shared number parsing/formatting logic.
- `src/database/marketRegistry.js`: SQLite storage for markets and settings.
- `src/discord/notifier.js`: Main Discord client entry point.
- `src/discord/commands/*.js`: Individual command logic (`add`, `remove`, `setThreshold`, etc.).
- `src/discord/formatters.js`: Pure functions for creating Discord Embeds.
