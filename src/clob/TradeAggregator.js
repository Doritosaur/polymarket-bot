import { config as defaultConfig } from '../config.js';
import { addTradeToQueue as defaultAddTradeToQueue } from '../queue/tradeQueue.js';

export class TradeAggregator {
    constructor(deps = {}) {
        const { config = defaultConfig, addTradeToQueue = defaultAddTradeToQueue } = deps;

        this.addTradeToQueue = addTradeToQueue;
        this.minAmountThreshold = config.minAmountThreshold;

        this.pendingAggregations = new Map();
        this.AGGREGATION_WINDOW_MS = 50;
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
            clearTimeout(entry.timeout);

            entry.data.totalSize += size;
            entry.data.totalValue += tradeValue;
            entry.data.vwapNumerator += (price * size);
            entry.data.count += 1;
        } else {
            entry = {
                data: {
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
                    threshold: assetInfo.threshold
                }
            };
        }

        entry.timeout = setTimeout(() => {
            this.flushAggregation(key);
        }, this.AGGREGATION_WINDOW_MS);

        this.pendingAggregations.set(key, entry);
    }

    flushAggregation(key) {
        const entry = this.pendingAggregations.get(key);
        if (!entry) return;

        this.pendingAggregations.delete(key);

        const d = entry.data;
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
        for (const [key, entry] of this.pendingAggregations) {
            clearTimeout(entry.timeout);
        }
        this.pendingAggregations.clear();
    }
}
