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
        this.subscribedAssets.clear();

        // Sync global threshold from registry to aggregator
        const storedThreshold = marketRegistry.getSetting('minAmountThreshold');
        if (storedThreshold) {
            this.aggregator.setGlobalThreshold(storedThreshold);
            console.log(`Loaded stored threshold: ${storedThreshold}`);
        }

        let MARKETS_TO_MONITOR = [];
        if (specifiedConditionId) {
            const market = marketRegistry.getMarket(specifiedConditionId);
            if (market) {
                MARKETS_TO_MONITOR.push(market);
            } else {
                console.error(`Market ${specifiedConditionId} not found in registry.`);
                return;
            }
        } else {
            MARKETS_TO_MONITOR = marketRegistry.getActiveMarkets();
        }

        if (MARKETS_TO_MONITOR.length === 0) {
            console.log('No active markets to track.');
            return;
        }
        const assetIdsToSubscribe = [];

        for (const market of MARKETS_TO_MONITOR) {
            try {
                let yes, no;

                if (market.clob_token_ids) {
                    try {
                        const tokenIds = JSON.parse(market.clob_token_ids);
                        if (Array.isArray(tokenIds) && tokenIds.length >= 2) {
                            yes = tokenIds[0].toString();
                            no = tokenIds[1].toString();
                        }
                    } catch (e) {
                        console.warn(`Failed to parse clob_token_ids for ${market.condition_id}, falling back to derivation.`);
                    }
                }

                if (!yes || !no) {
                    console.warn(`Market ${market.condition_id} missing clob_token_ids, skipping subscription.`);
                    continue;
                }

                assetIdsToSubscribe.push(yes);
                assetIdsToSubscribe.push(no);

                this.subscribedAssets.set(yes, {
                    conditionId: market.condition_id,
                    slug: market.slug,
                    question: market.description,
                    endDate: market.end_date,
                    image: market.image,
                    outcome: 'YES',
                    threshold: market.threshold
                });
                this.subscribedAssets.set(no, {
                    conditionId: market.condition_id,
                    slug: market.slug,
                    question: market.description,
                    endDate: market.end_date,
                    image: market.image,
                    outcome: 'NO',
                    threshold: market.threshold
                });
            } catch (error) {
                console.error(`Failed to derive IDs for ${market.condition_id}:`, error);
            }
        }

        console.log(`Prepared to track ${this.subscribedAssets.size} assets from ${MARKETS_TO_MONITOR.length} markets.`);

        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
            console.log('Connected to Polymarket CLOB WebSocket');
            this.reconnectAttempts = 0;

            const subscribeMsg = {
                type: "market",
                assets_ids: assetIdsToSubscribe
            };

            this.ws.send(JSON.stringify(subscribeMsg));
            console.log('Sent subscription request');
            this.pingInterval = setInterval(() => {
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: "ping" }));
                }
            }, 30000);
        };

        this.ws.onmessage = (event) => {
            try {
                if (typeof event.data === 'string' && !event.data.trim().startsWith('{') && !event.data.trim().startsWith('[')) {
                    console.warn('Received non-JSON message from CLOB:', event.data);
                    return;
                }

                const msg = JSON.parse(event.data);
                this.handleMessage(msg);
            } catch (error) {
                console.error('Error handling WebSocket message:', error);
                console.debug('Raw message content:', event.data);
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

    attemptReconnect() {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000);

        console.log(`Attempting to reconnect in ${delay / 1000}s (Attempt ${this.reconnectAttempts})...`);

        this.reconnectTimeout = setTimeout(() => {
            this.start();
        }, delay);
    }

    setThreshold(val) {
        this.aggregator.setGlobalThreshold(val);
    }

    handleMessage(msg) {
        if (Array.isArray(msg)) {
            for (const update of msg) {
                this.processUpdate(update);
            }
        } else {
            this.processUpdate(msg);
        }
    }

    async processUpdate(update) {
        if (!update || !update.asset_id) return;
        if (update.type === "pong") return;

        const assetInfo = this.subscribedAssets.get(update.asset_id);
        if (!assetInfo) return;

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

        if (clearPending) {
            this.aggregator.clearPending();
        }

        if (this.ws) {
            this.ws.close();
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

    getActiveListenersCount() {
        return (this.ws && this.ws.readyState === WebSocket.OPEN) ? 1 : 0;
    }

    getTrackedMarketsCount() {
        const conditions = new Set([...this.subscribedAssets.values()].map(a => a.conditionId));
        return conditions.size;
    }

    async addMarket(conditionId, slug, description, clobTokenIds = null) {
        console.log(`[CLOB] New market added (${slug}). Restarting listener to subscribe...`);
        await this.restart();
    }

    async addMarkets(markets) {
        console.log(`[CLOB] Adding batch of ${markets.length} markets. Restarting listener...`);
        await this.restart();
    }

    async removeMarket(conditionId) {
        console.log(`[CLOB] Market removed (${conditionId}). Restarting listener to update subscription...`);
        await this.restart();
    }

    async removeMarkets(conditionIds) {
        console.log(`[CLOB] Removing batch of ${conditionIds.length} markets. Restarting listener...`);
        await this.restart();
    }
}

export const clobListener = new ClobListener();
