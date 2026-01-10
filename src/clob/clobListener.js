import { marketRegistry } from '../database/marketRegistry.js';
import { config } from '../config.js';
import { TradeAggregator } from './TradeAggregator.js';

const WS_URL = config.clobWsUrl;

class ClobListener {
    constructor() {
        this.ws = null;
        this.pingInterval = null;
        this.subscribedAssets = new Map();
        this.reconnectAttempts = 0;
        this.shouldReconnect = true;
        this.reconnectTimeout = null;

        this.aggregator = new TradeAggregator();
    }

    async start(specifiedConditionId = null) {
        if (!this.reconnectTimeout) {
            this.shouldReconnect = true;
        }

        console.log('Starting CLOB Listener...');

        // Only clear if fully restarting
        if (!this.ws) {
            this.subscribedAssets.clear();
        }

        // Sync global threshold from registry to aggregator
        const storedThreshold = await marketRegistry.getSetting('minAmountThreshold');
        if (storedThreshold) {
            this.aggregator.setGlobalThreshold(storedThreshold);
            console.log(`Loaded stored threshold: ${storedThreshold}`);
        }

        let marketsToLoad = [];
        if (specifiedConditionId) {
            const market = await marketRegistry.getMarket(specifiedConditionId);
            if (market) marketsToLoad.push(market);
        } else {
            // Only load all active if we are starting fresh or don't have them
            if (this.subscribedAssets.size === 0) {
                // We use getWatchedMarkets now because we only want to subscribe to markets the user explicitly watches.
                // The DB might contain thousands of "active" markets (fetched from API), but we don't want to track all of them.
                marketsToLoad = await marketRegistry.getWatchedMarkets();
            }
        }

        // Register them to the map
        const newAssetIds = this.registerMarkets(marketsToLoad);

        // If we're just starting, we need to collect ALL assets from the map, 
        // because we might have skipped loading usage if map wasn't empty? 
        // Actually, let's keep it simple: Start loads everything from DB if fresh.

        let allAssets = [];
        if (this.subscribedAssets.size === 0 && marketsToLoad.length > 0) {
            // We just registered them
            allAssets = newAssetIds;
        } else {
            // We might be reconnecting, gather all
            allAssets = Array.from(this.subscribedAssets.keys());
        }

        // If we are already connected, we shouldn't be calling start() unless it's a full restart.
        // But if we are, we proceed to connect.

        if (allAssets.length === 0 && this.subscribedAssets.size === 0) {
            console.log('No active markets to track.');
            return;
        }

        console.log(`Prepared to track ${this.subscribedAssets.size} assets.`);

        if (this.ws) {
            console.warn('WS already open, skipping new connection code in start(). use addMarket instead.');
            return;
        }

        this.connect(allAssets);
    }

    connect(assetIds) {
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
            console.log('Connected to Polymarket CLOB WebSocket');
            this.reconnectAttempts = 0;

            if (assetIds.length > 0) {
                const subscribeMsg = {
                    type: "market",
                    assets_ids: assetIds
                };
                this.ws.send(JSON.stringify(subscribeMsg));
                console.log(`Sent subscription request for ${assetIds.length} assets`);
            }

            this.pingInterval = setInterval(() => {
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: "ping" }));
                }
            }, 30000);
        };

        this.ws.onmessage = (event) => {
            try {
                if (typeof event.data === 'string' && !event.data.trim().startsWith('{') && !event.data.trim().startsWith('[')) {
                    return;
                }
                const msg = JSON.parse(event.data);
                this.handleMessage(msg);
            } catch (error) {
                console.error('Error handling WebSocket message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket Connection Closed');
            clearInterval(this.pingInterval);
            this.ws = null;

            if (this.shouldReconnect) {
                this.attemptReconnect();
            }
        };
    }

    // Helper to parse markets and update local map. Returns array of NEW asset IDs.
    registerMarkets(markets) {
        const newAssetIds = [];
        for (const market of markets) {
            try {
                let yes, no;
                if (market.clob_token_ids) {
                    try {
                        const tokenIds = JSON.parse(market.clob_token_ids);
                        if (Array.isArray(tokenIds) && tokenIds.length >= 2) {
                            yes = tokenIds[0].toString();
                            no = tokenIds[1].toString();
                        }
                    } catch (e) { /* ignore */ }
                }

                if (!yes || !no) continue;

                // Add to map
                const addAsset = (id, outcome) => {
                    this.subscribedAssets.set(id, {
                        conditionId: market.condition_id,
                        slug: market.slug,
                        question: market.description,
                        endDate: market.end_date,
                        image: market.image,
                        outcome,
                        threshold: market.threshold
                    });
                    newAssetIds.push(id);
                };

                addAsset(yes, 'YES');
                addAsset(no, 'NO');

            } catch (error) {
                console.error(`Failed to register market ${market.condition_id}:`, error);
            }
        }
        return newAssetIds;
    }

    attemptReconnect() {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000);
        console.log(`Reconnecting in ${delay / 1000}s...`);
        this.reconnectTimeout = setTimeout(() => {
            this.start();
        }, delay);
    }

    setThreshold(val) {
        this.aggregator.setGlobalThreshold(val);
    }

    handleMessage(msg) {
        if (Array.isArray(msg)) {
            for (const update of msg) this.processUpdate(update);
        } else {
            this.processUpdate(msg);
        }
    }

    async processUpdate(update) {
        if (!update || !update.asset_id) return;
        if (update.type === "pong") return;

        const assetInfo = this.subscribedAssets.get(update.asset_id);
        if (!assetInfo) return; // Ignore if not tracked (e.g. removed market)

        if (update.event_type === "last_trade_price") {
            this.aggregator.processTrade({
                price: parseFloat(update.price),
                size: parseFloat(update.size),
                side: update.side,
                timestamp: update.timestamp,
                assetInfo
            });
        }
    }

    stop(clearPending = true) {
        this.shouldReconnect = false;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (clearPending) this.aggregator.clearPending();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        clearInterval(this.pingInterval);
    }

    async initialize() {
        return this.start();
    }

    async restart() {
        this.stop(false);
        return this.start();
    }

    async cleanup() {
        return this.stop(true);
    }

    // --- Optimization: Incremental Updates ---

    async addMarket(conditionId, slug, description, clobTokenIds = null) {
        console.log(`[CLOB] Adding market ${slug} incrementally...`);
        // 1. Fetch full details from DB (to get everything)
        const market = await marketRegistry.getMarket(conditionId);
        if (!market) return;

        // 2. Register (Update Map)
        const newIds = this.registerMarkets([market]);

        // 3. Send Subscribe Message if connected
        if (this.ws && this.ws.readyState === WebSocket.OPEN && newIds.length > 0) {
            this.ws.send(JSON.stringify({
                type: "market",
                assets_ids: newIds
            }));
            console.log(`[CLOB] Sent incremental subscription for ${newIds.length} assets.`);
        } else if (!this.ws) {
            // If not connected, start() will pick it up from DB/Map
            await this.start();
        }
    }

    async addMarkets(markets) {
        console.log(`[CLOB] Adding batch of ${markets.length} markets incrementally...`);

        // extract condition IDs (handle both string IDs and objects)
        const conditionIds = markets.map(m => m.condition_id || m);

        if (conditionIds.length === 0) return;

        // 1. Bulk Fetch full details from DB
        const fullMarkets = await marketRegistry.getMarketsByConditionIds(conditionIds);

        // 2. Register
        const newIds = this.registerMarkets(fullMarkets);

        // 3. Subscribe if connected
        if (this.ws && this.ws.readyState === WebSocket.OPEN && newIds.length > 0) {
            this.ws.send(JSON.stringify({
                type: "market",
                assets_ids: newIds
            }));
            console.log(`[CLOB] Sent incremental batch subscription for ${newIds.length} assets.`);
        }
    }

    async removeMarket(conditionId) {
        console.log(`[CLOB] Removing market ${conditionId} locally (Lazy Unsubscribe)...`);
        // We don't send an Unsubscribe message (Polymarket doesn't strictly document "unsubscribe" for public data stream easily, 
        // or we just rely on filtering).
        // Simply removing from 'subscribedAssets' map ensures 'processUpdate' ignores future messages.

        // We need to find the asset IDs for this conditionId to remove them.
        for (const [assetId, info] of this.subscribedAssets.entries()) {
            if (info.conditionId === conditionId) {
                this.subscribedAssets.delete(assetId);
            }
        }
    }

    async removeMarkets(conditionIds) {
        console.log(`[CLOB] Removing ${conditionIds.length} markets locally...`);
        const idsToRemove = new Set(conditionIds);
        for (const [assetId, info] of this.subscribedAssets.entries()) {
            if (idsToRemove.has(info.conditionId)) {
                this.subscribedAssets.delete(assetId);
            }
        }
    }

    // Update thresholds in-memory for an event (optimization to avoid restart)
    async updateEventThreshold(eventSlug, newThreshold) {
        let count = 0;
        for (const [assetId, info] of this.subscribedAssets.entries()) {
            if (info.slug === eventSlug || info.eventSlug === eventSlug || (marketRegistry.getMarketsByEventSlug(eventSlug).some(m => m.condition_id === info.conditionId))) {
                // The mapping in subscribedAssets uses info.slug which refers to the MARKET slug? 
                // Let's check registerMarkets: slug: market.slug. 
                // We don't store event_slug in subscribedAssets info! We need to fix that first or look it up.
                // Actually registerMarkets stores: slug: market.slug.
                // We should probably check if we can easily match.
            }
        }
        // Okay, simpler: iterate and check if the market belongs to the event. 
        // Or better: pass the list of conditionIds that were updated?
        // setEvent.js calls marketRegistry.setEventThreshold(eventSlug, amount).
        // That updates DB.
        // To be safe and fast:
        // 1. Get all markets for the event from registry.
        // 2. For each market, update its assets in the map.

        const markets = await marketRegistry.getMarketsByEventSlug(eventSlug);
        const conditionIds = new Set(markets.map(m => m.condition_id));

        for (const [assetId, info] of this.subscribedAssets.entries()) {
            if (conditionIds.has(info.conditionId)) {
                info.threshold = newThreshold;
                count++;
            }
        }
        console.log(`[CLOB] Updated threshold for ${count} assets in memory.`);
    }
}

export const clobListener = new ClobListener();
