import { marketRegistry } from '../database/marketRegistry.js';
import { config } from '../config.js';
import { TradeAggregator } from './TradeAggregator.js';
import { broadcast } from '../utils/broadcast.js';

const WS_URL = config.clobWsUrl;

class TradeProcessor {
    constructor(broadcaster, aggregator, subscribedAssets) {
        this.broadcaster = broadcaster;
        this.aggregator = aggregator;
        this.subscribedAssets = subscribedAssets;

        // Layer 1: Hash duplication detection (Primary Defense)
        // Checks if EXACT same message ID appears within 5 seconds
        this.recentHashes = new Map(); // hash -> timestamp
        this.HASH_TTL = 5000; // 5 seconds

        // Layer 2: Signature duplication detection (Ultra-Short Debounce)
        // Checks if IDENTICAL trade details appear within 500ms
        // Catches server retransmits/bugs without blocking legitimate rapid trades
        this.recentSignatures = new Map(); // signature -> timestamp
        this.SIG_TTL = 500; // 500ms (Critical: Short window)

        // Layer 3: History Tracking (for analysis/debugging)
        this.tradeHistory = [];
        this.MAX_HISTORY = 100;
    }

    processMessage(msg) {
        // Heartbeat / Debug
        if (msg.type !== 'pong' && !Array.isArray(msg)) {
            // console.log('[CLOB] Received msg:', JSON.stringify(msg).substring(0, 100)); 
        }

        if (Array.isArray(msg)) {
            for (const update of msg) this.processUpdate(update);
        } else {
            this.processUpdate(msg);
        }
    }

    processUpdate(update) {
        if (!update) return;
        if (update.type === "pong") return;

        // 1. Recursive handling for "price_change" (orderbook updates)
        if (update.price_changes && Array.isArray(update.price_changes)) {
            for (const change of update.price_changes) {
                // Determine asset_id from change or parent
                const subUpdate = {
                    ...change,
                    timestamp: update.timestamp,
                    event_type: update.event_type,
                    hash: update.hash // Propagate hash if available on parent
                };
                this.processUpdate(subUpdate);
            }
            return;
        }

        // 2. Resolve Asset ID
        if (!update.asset_id && update.token_id) update.asset_id = update.token_id;
        if (!update.asset_id) return;

        const assetInfo = this.subscribedAssets.get(update.asset_id);
        if (!assetInfo) return; // Ignore unknown

        // 3. STRICT TRADE DETECTION
        // Criteria:
        // A. Must be 'last_trade_price' event
        // B. Must have valid dimensions (price, size > 0, side)
        // C. Must not be a duplicate (check hash & signature)

        const isTradeEvent = update.event_type === 'last_trade_price';
        const sizeNum = parseFloat(update.size || 0);
        const hasValidData = update.price && sizeNum > 0 && update.side;

        if (isTradeEvent && hasValidData) {
            const now = Date.now();
            const tradeTs = update.timestamp ? parseInt(update.timestamp) : now;

            // LAYER 1: Hash-Based De-duplication (Primary)
            if (update.hash) {
                const lastSeen = this.recentHashes.get(update.hash);
                // If seen recently, block it
                if (lastSeen && (now - lastSeen) < this.HASH_TTL) {
                    // console.log(`[CLOB] Skipping duplicate trade hash (Recent): ${update.hash}`);
                    return;
                }
                // Update timestamp (refresh or new)
                this.recentHashes.set(update.hash, now);
                this.pruneOldEntries(this.recentHashes, this.HASH_TTL);
            }

            // LAYER 2: Pattern-Based De-duplication (Signature - Ultra Short)
            const signature = `${update.asset_id}|${update.price}|${update.size}|${update.side}`;
            const lastSigSeen = this.recentSignatures.get(signature);

            // If identical trade details seen within 500ms, debounce it
            if (lastSigSeen && (now - lastSigSeen) < this.SIG_TTL) {
                console.log(`[CLOB] ⚠️  Debouncing duplicate within ${now - lastSigSeen}ms (Sig: ${signature})`);
                return;
            }

            // Update signature timestamp AFTER check passes
            this.recentSignatures.set(signature, now);
            this.pruneOldEntries(this.recentSignatures, this.SIG_TTL);

            console.log(`[CLOB] 💰 TRADE DETECTED: ${update.asset_id} Price: ${update.price} Size: ${update.size}`);

            // Update local price cache
            assetInfo.lastPrice = parseFloat(update.price);

            // History Tracking
            this.tradeHistory.push({
                signature,
                timestamp: tradeTs,
                hash: update.hash
            });
            if (this.tradeHistory.length > this.MAX_HISTORY) {
                this.tradeHistory.shift();
            }

            // Prepare validated trade data
            const tradeData = {
                asset_id: update.asset_id,
                price: update.price,
                size: update.size,
                side: update.side,
                timestamp: tradeTs,
                outcome: assetInfo.outcome,
                market_question: assetInfo.question,
                market_slug: assetInfo.slug,
                market_condition_id: assetInfo.conditionId,
                hash: update.hash
            };

            this.broadcaster('TRADE', tradeData);

            this.aggregator.processTrade({
                price: parseFloat(update.price),
                size: parseFloat(update.size),
                side: update.side,
                timestamp: tradeTs,
                assetInfo
            });
        }
    }

    pruneOldEntries(map, ttl) {
        const now = Date.now();
        for (const [key, timestamp] of map.entries()) {
            if (now - timestamp > ttl) {
                map.delete(key);
            }
        }
    }
}

class ClobListener {
    constructor() {
        this.ws = null;
        this.pingInterval = null;
        this.subscribedAssets = new Map();
        this.reconnectAttempts = 0;
        this.shouldReconnect = true;
        this.reconnectTimeout = null;

        this.aggregator = new TradeAggregator();
        this.processor = new TradeProcessor(broadcast, this.aggregator, this.subscribedAssets);
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
                // switch back to ALL active markets for Whale Feed to work globally
                marketsToLoad = await marketRegistry.getActiveMarkets();
                console.log(`[CLOB] Startup: Loaded ${marketsToLoad.length} ACTIVE markets (Global Mode).`);
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
                // Batch subscriptions to avoid frame limit issues
                const BATCH_SIZE = 500;
                let batchCount = 0;

                for (let i = 0; i < assetIds.length; i += BATCH_SIZE) {
                    const batch = assetIds.slice(i, i + BATCH_SIZE);
                    const subscribeMsg = {
                        type: "market",
                        assets_ids: batch
                    };
                    console.log(`[CLOB] Sending Subscribe Payload:`, JSON.stringify(subscribeMsg).substring(0, 200) + '...');
                    this.ws.send(JSON.stringify(subscribeMsg));

                    // Also subscribe to TRADES
                    this.ws.send(JSON.stringify({
                        type: "last_trade_price",
                        assets_ids: batch
                    }));
                    batchCount++;
                }
                console.log(`Sent subscription request for ${assetIds.length} assets in ${batchCount} batches.`);
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
                this.processor.processMessage(msg);
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
                        if (Array.isArray(tokenIds) && tokenIds.length >= 2 && tokenIds[0] && tokenIds[1]) {
                            yes = tokenIds[0].toString();
                            no = tokenIds[1].toString();
                        } else {
                            console.warn(`[CLOB] Market ${market.condition_id} has invalid token format:`, market.clob_token_ids);
                        }
                    } catch (e) {
                        // Only log error if not a simple string parsing issue of already parsed object
                        console.warn(`[CLOB] Failed to parse tokens for ${market.condition_id}:`, e.message);
                    }
                } else {
                    console.warn(`[CLOB] Market ${market.condition_id} has NO clob_token_ids.`);
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
        // extract condition IDs (handle both string IDs and objects)
        const conditionIds = markets.map(m => m.conditionId || m.condition_id || m);
        console.log(`[CLOB] addMarkets called with ${conditionIds.length} IDs.`);

        if (conditionIds.length === 0) return;

        // 1. Bulk Fetch full details from DB
        const fullMarkets = await marketRegistry.getMarketsByConditionIds(conditionIds);
        console.log(`[CLOB] Fetched ${fullMarkets.length} full market details from DB.`);

        // 2. Register
        const newIds = this.registerMarkets(fullMarkets);
        console.log(`[CLOB] Registered ${newIds.length} NEW asset IDs.`);

        // 3. Subscribe if connected
        if (this.ws && this.ws.readyState === WebSocket.OPEN && newIds.length > 0) {
            // Batch subscriptions
            const BATCH_SIZE = 500;
            let batchCount = 0;
            for (let i = 0; i < newIds.length; i += BATCH_SIZE) {
                const batch = newIds.slice(i, i + BATCH_SIZE);
                // Subscribe to Orderbook (Price Changes)
                this.ws.send(JSON.stringify({
                    type: "market",
                    assets_ids: batch
                }));
                // Subscribe to Trades (Executions)
                this.ws.send(JSON.stringify({
                    type: "last_trade_price",
                    assets_ids: batch
                }));
                batchCount++;
            }
            console.log(`[CLOB] Sent incremental subscription for ${newIds.length} assets in ${batchCount} batches.`);
        } else if (!this.ws && newIds.length > 0) {
            // If valid markets were added but we aren't connected, START.
            console.log(`[CLOB] Not connected, starting listener with ${newIds.length} accumulated assets.`);
            await this.start();
        }
    }

    async removeMarket(conditionId) {
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

    getAssets() {
        return Array.from(this.subscribedAssets.values());
    }
}

export const clobListener = new ClobListener();
