import { config as defaultConfig } from '../config.js';
import { addTradeToQueue as defaultAddTradeToQueue } from '../queue/tradeQueue.js';

export class TradeAggregator {
    constructor(deps = {}) {
        const { config = defaultConfig, addTradeToQueue = defaultAddTradeToQueue } = deps;

        this.addTradeToQueue = addTradeToQueue;
        this.minAmountThreshold = config.minAmountThreshold;

        this.pendingAggregations = new Map();
        this.AGGREGATION_WINDOW_MS = 50;

        // Single tick loop for efficient aggregation
        this.tickInterval = setInterval(() => this.tick(), 50);
    }

    setGlobalThreshold(val) {
        this.minAmountThreshold = parseFloat(val);
        console.log(`[Aggregator] Global threshold updated to ${this.minAmountThreshold}`);
    }

    processTrade(trade) {
        const { price, size, side, assetInfo, timestamp } = trade;
        const tradeValue = price * size;

        const key = `${assetInfo.slug}-${assetInfo.outcome}-${side}`;
        let entry = this.pendingAggregations.get(key);

        if (entry) {
            entry.totalSize += size;
            entry.totalValue += tradeValue;
            entry.vwapNumerator += (price * size);
            entry.count += 1;
            entry.lastUpdate = Date.now();
        } else {
            entry = {
                conditionId: assetInfo.conditionId,
                marketName: assetInfo.slug,
                question: assetInfo.question,
                endDate: assetInfo.endDate,
                image: assetInfo.image,
                outcome: assetInfo.outcome,
                tradeType: side,
                totalSize: size,
                totalValue: tradeValue,
                vwapNumerator: (price * size),
                count: 1,
                timestamp: timestamp ? parseInt(timestamp) : Date.now(),
                threshold: assetInfo.threshold,
                firstUpdate: Date.now(),
                lastUpdate: Date.now()
            };
            this.pendingAggregations.set(key, entry);
        }
    }

    tick() {
        const now = Date.now();
        for (const [key, entry] of this.pendingAggregations) {
            // Flush if window has passed since FIRST trade in this batch
            if (now - entry.firstUpdate >= this.AGGREGATION_WINDOW_MS) {
                this.flushAggregation(key, entry);
            }
        }
    }

    flushAggregation(key, d) {
        this.pendingAggregations.delete(key);

        const avgPrice = d.vwapNumerator / d.totalSize;
        const thresholdToUse = d.threshold || this.minAmountThreshold;

        if (d.totalValue >= thresholdToUse) {
            console.log(`[TRADE_AGG] ${d.marketName} (${d.outcome}) ${d.tradeType}: $${d.totalValue.toFixed(2)} (Count: ${d.count}, AvgPrice: ${avgPrice.toFixed(4)})`);

            this.addTradeToQueue({
                type: 'trade',
                tradeType: d.tradeType,
                conditionId: d.conditionId,
                marketName: d.marketName,
                question: d.question,
                endDate: d.endDate,
                image: d.image,
                outcome: d.outcome,
                amount: d.totalSize.toFixed(2),
                price: avgPrice.toFixed(4),
                value: d.totalValue.toFixed(2),
                timestamp: d.timestamp,
                isAggregated: d.count > 1,
                fillCount: d.count
            });
        }
    }

    clearPending() {
        this.pendingAggregations.clear();
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }
}
