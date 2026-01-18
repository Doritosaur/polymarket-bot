/**
 * SignalEngine - Core signal detection and emission system
 * Detects patterns: Volume Anomaly, Price Velocity, Regional Surge, Whale Activity, Market Reversal
 */
import { VelocityTracker } from './VelocityTracker.js';
import { VolumeAnomalyDetector } from './VolumeAnomalyDetector.js';
import { broadcast } from '../utils/broadcast.js';
import { config } from '../config.js';
import { marketRegistry } from '../database/marketRegistry.js';

// Signal type constants
export const SIGNAL_TYPES = {
    VOLUME_ANOMALY: 'volume_anomaly',
    PRICE_VELOCITY: 'price_velocity',
    REGIONAL_SURGE: 'regional_surge',
    WHALE_ACTIVITY: 'whale_activity',
    MARKET_REVERSAL: 'market_reversal'
};

// Severity levels
export const SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * SignalEngine class - manages all signal detection
 */
class SignalEngine {
    constructor() {
        // Per-market trackers: Map<conditionId, { velocity, volume }>
        this.marketTrackers = new Map();

        // Per-region aggregates: Map<region, { markets, totalVolume, sentimentSum }>
        this.regionAggregates = new Map();

        // Recent signals for deduplication: Map<signalKey, timestamp>
        this.recentSignals = new Map();
        this.signalCooldownMs = 30000; // 30 second cooldown per signal type per market

        // Configuration (can be updated dynamically)
        this.config = {
            volumeAnomalyThreshold: config.signals?.volumeAnomalyThreshold ?? 2.0,
            velocityThreshold: config.signals?.velocityThreshold ?? 5.0, // 5% per minute
            regionalSurgeMinMarkets: config.signals?.regionalSurgeMinMarkets ?? 3,
            whaleThreshold: config.signals?.whaleThreshold ?? config.minAmountThreshold ?? 1000,
            slidingWindowMs: config.signals?.slidingWindowMs ?? 60000,
            volumeWindowMs: config.signals?.volumeWindowMs ?? 300000
        };

        // Signal counter for IDs
        this.signalCounter = 0;

        // Periodic region analysis
        this.regionAnalysisInterval = null;

        console.log('[SignalEngine] Initialized with config:', this.config);
    }

    /**
     * Start the signal engine
     */
    start() {
        // Run region analysis every 10 seconds
        this.regionAnalysisInterval = setInterval(() => {
            this._analyzeRegions();
        }, 10000);

        // Cleanup old signals every minute
        setInterval(() => {
            this._cleanupOldSignals();
        }, 60000);

        console.log('[SignalEngine] Started');
    }

    /**
     * Stop the signal engine
     */
    stop() {
        if (this.regionAnalysisInterval) {
            clearInterval(this.regionAnalysisInterval);
            this.regionAnalysisInterval = null;
        }
        console.log('[SignalEngine] Stopped');
    }

    /**
     * Get or create trackers for a market
     * @param {string} conditionId 
     * @returns {{ velocity: VelocityTracker, volume: VolumeAnomalyDetector }}
     */
    _getTrackers(conditionId) {
        if (!this.marketTrackers.has(conditionId)) {
            this.marketTrackers.set(conditionId, {
                velocity: new VelocityTracker(this.config.slidingWindowMs),
                volume: new VolumeAnomalyDetector(this.config.volumeWindowMs, this.config.volumeAnomalyThreshold),
                lastPrice: null,
                priceDirection: 'stable',
                region: null,
                metadata: {}
            });
        }
        return this.marketTrackers.get(conditionId);
    }

    /**
     * Register a market with the signal engine
     * @param {Object} market Market data with conditionId, region, etc.
     */
    registerMarket(market) {
        const trackers = this._getTrackers(market.conditionId);
        trackers.region = market.region || 'global';
        trackers.metadata = {
            slug: market.slug,
            question: market.question,
            eventSlug: market.eventSlug,
            coordinates: market.coordinates
        };

        // Initialize region aggregate if needed
        if (!this.regionAggregates.has(trackers.region)) {
            this.regionAggregates.set(trackers.region, {
                markets: new Set(),
                recentActivity: [],
                coordinates: market.coordinates
            });
        }
        this.regionAggregates.get(trackers.region).markets.add(market.conditionId);
    }

    /**
     * Process a trade and check for signals
     * @param {Object} trade Trade data
     */
    processTrade(trade) {
        const {
            conditionId,
            assetId,
            price,
            size,
            side,
            timestamp = Date.now(),
            marketTitle,
            outcome,
            region,
            coordinates
        } = trade;

        if (!conditionId) return;

        const trackers = this._getTrackers(conditionId);
        const volumeUsd = price * size;

        // Update trackers
        trackers.velocity.record(price, timestamp);
        trackers.volume.record(volumeUsd, timestamp);

        // Update region if provided
        if (region && region !== trackers.region) {
            // Move market to new region
            if (trackers.region && this.regionAggregates.has(trackers.region)) {
                this.regionAggregates.get(trackers.region).markets.delete(conditionId);
            }
            trackers.region = region;
            if (!this.regionAggregates.has(region)) {
                this.regionAggregates.set(region, {
                    markets: new Set(),
                    recentActivity: [],
                    coordinates
                });
            }
            this.regionAggregates.get(region).markets.add(conditionId);
        }

        // Track activity in region
        if (trackers.region && this.regionAggregates.has(trackers.region)) {
            const regionData = this.regionAggregates.get(trackers.region);
            regionData.recentActivity.push({
                conditionId,
                side,
                volumeUsd,
                timestamp,
                priceChange: trackers.velocity.getPercentChange()
            });

            // Keep only last 5 minutes of activity
            const cutoff = Date.now() - 300000;
            regionData.recentActivity = regionData.recentActivity.filter(a => a.timestamp > cutoff);
        }

        // Detect previous direction for reversal detection
        const previousDirection = trackers.priceDirection;

        // Update last price and direction
        if (trackers.lastPrice !== null) {
            if (price > trackers.lastPrice * 1.001) {
                trackers.priceDirection = 'up';
            } else if (price < trackers.lastPrice * 0.999) {
                trackers.priceDirection = 'down';
            }
        }
        trackers.lastPrice = price;

        // === SIGNAL DETECTION ===

        // 1. Whale Activity (large single trade)
        if (volumeUsd >= this.config.whaleThreshold) {
            this._emitSignal({
                type: SIGNAL_TYPES.WHALE_ACTIVITY,
                conditionId,
                region: trackers.region,
                coordinates: trackers.metadata.coordinates || coordinates,
                value: volumeUsd,
                metadata: {
                    price,
                    size,
                    side,
                    marketTitle: marketTitle || trackers.metadata.question,
                    outcome
                }
            });
        }

        // 2. Volume Anomaly
        const volumeCheck = trackers.volume.isAnomaly(volumeUsd);
        if (volumeCheck.isAnomaly) {
            this._emitSignal({
                type: SIGNAL_TYPES.VOLUME_ANOMALY,
                conditionId,
                region: trackers.region,
                coordinates: trackers.metadata.coordinates || coordinates,
                value: volumeCheck.score,
                metadata: {
                    volume: volumeUsd,
                    average: volumeCheck.average,
                    marketTitle: marketTitle || trackers.metadata.question
                }
            });
        }

        // 3. Price Velocity
        const velocity = Math.abs(trackers.velocity.getVelocity());
        if (velocity >= this.config.velocityThreshold && trackers.velocity.getDataPointCount() >= 3) {
            this._emitSignal({
                type: SIGNAL_TYPES.PRICE_VELOCITY,
                conditionId,
                region: trackers.region,
                coordinates: trackers.metadata.coordinates || coordinates,
                value: velocity,
                metadata: {
                    direction: trackers.velocity.getDirection(),
                    percentChange: trackers.velocity.getPercentChange(),
                    marketTitle: marketTitle || trackers.metadata.question
                }
            });
        }

        // 4. Market Reversal (direction change after sustained movement)
        if (previousDirection !== 'stable' &&
            trackers.priceDirection !== 'stable' &&
            previousDirection !== trackers.priceDirection &&
            trackers.velocity.getDataPointCount() >= 5) {
            this._emitSignal({
                type: SIGNAL_TYPES.MARKET_REVERSAL,
                conditionId,
                region: trackers.region,
                coordinates: trackers.metadata.coordinates || coordinates,
                value: Math.abs(trackers.velocity.getPercentChange()),
                metadata: {
                    fromDirection: previousDirection,
                    toDirection: trackers.priceDirection,
                    marketTitle: marketTitle || trackers.metadata.question
                }
            });
        }
    }

    /**
     * Analyze regions for regional surge signals
     */
    _analyzeRegions() {
        for (const [regionId, regionData] of this.regionAggregates) {
            if (regionData.recentActivity.length < this.config.regionalSurgeMinMarkets) {
                continue;
            }

            // Count unique active markets in last 60 seconds
            const recentCutoff = Date.now() - 60000;
            const recentActivity = regionData.recentActivity.filter(a => a.timestamp > recentCutoff);
            const activeMarkets = new Set(recentActivity.map(a => a.conditionId));

            if (activeMarkets.size >= this.config.regionalSurgeMinMarkets) {
                // Calculate aggregate sentiment
                const buyVolume = recentActivity.filter(a => a.side === 'BUY').reduce((sum, a) => sum + a.volumeUsd, 0);
                const sellVolume = recentActivity.filter(a => a.side === 'SELL').reduce((sum, a) => sum + a.volumeUsd, 0);
                const totalVolume = buyVolume + sellVolume;
                const sentiment = totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0;

                this._emitSignal({
                    type: SIGNAL_TYPES.REGIONAL_SURGE,
                    conditionId: null,
                    region: regionId,
                    coordinates: regionData.coordinates,
                    value: activeMarkets.size,
                    metadata: {
                        activeMarkets: Array.from(activeMarkets),
                        totalVolume,
                        sentiment,
                        direction: sentiment > 0.2 ? 'bullish' : sentiment < -0.2 ? 'bearish' : 'mixed'
                    }
                });
            }
        }
    }

    /**
     * Emit a signal with deduplication
     * @param {Object} signalData 
     */
    _emitSignal(signalData) {
        const { type, conditionId, region } = signalData;
        const signalKey = `${type}:${conditionId || region}`;

        // Check cooldown
        const lastEmit = this.recentSignals.get(signalKey);
        if (lastEmit && Date.now() - lastEmit < this.signalCooldownMs) {
            return; // Skip, too recent
        }

        // Calculate severity based on value
        let severity = SEVERITY.LOW;
        if (type === SIGNAL_TYPES.WHALE_ACTIVITY) {
            if (signalData.value >= 50000) severity = SEVERITY.CRITICAL;
            else if (signalData.value >= 20000) severity = SEVERITY.HIGH;
            else if (signalData.value >= 5000) severity = SEVERITY.MEDIUM;
        } else if (type === SIGNAL_TYPES.VOLUME_ANOMALY) {
            if (signalData.value >= 5) severity = SEVERITY.CRITICAL;
            else if (signalData.value >= 3) severity = SEVERITY.HIGH;
            else if (signalData.value >= 2.5) severity = SEVERITY.MEDIUM;
        } else if (type === SIGNAL_TYPES.PRICE_VELOCITY) {
            if (signalData.value >= 20) severity = SEVERITY.CRITICAL;
            else if (signalData.value >= 10) severity = SEVERITY.HIGH;
            else if (signalData.value >= 7) severity = SEVERITY.MEDIUM;
        } else if (type === SIGNAL_TYPES.REGIONAL_SURGE) {
            if (signalData.value >= 10) severity = SEVERITY.CRITICAL;
            else if (signalData.value >= 7) severity = SEVERITY.HIGH;
            else if (signalData.value >= 5) severity = SEVERITY.MEDIUM;
        }

        const signal = {
            id: `sig_${++this.signalCounter}_${Date.now()}`,
            type,
            severity,
            conditionId,
            region,
            coordinates: signalData.coordinates,
            value: signalData.value,
            metadata: signalData.metadata,
            timestamp: Date.now()
        };

        // Update cooldown
        this.recentSignals.set(signalKey, Date.now());

        // Broadcast to connected clients
        broadcast('signal', signal);

        // Persist to database for history
        marketRegistry.saveSignal(signal);

        console.log(`[SignalEngine] Emitted ${severity.toUpperCase()} ${type}:`, {
            id: signal.id,
            value: signal.value,
            region: signal.region,
            market: signal.metadata?.marketTitle?.substring(0, 40)
        });
    }

    /**
     * Cleanup old signals from cooldown map
     */
    _cleanupOldSignals() {
        const now = Date.now();
        for (const [key, timestamp] of this.recentSignals) {
            if (now - timestamp > this.signalCooldownMs * 2) {
                this.recentSignals.delete(key);
            }
        }
    }

    /**
     * Update configuration dynamically
     * @param {Object} newConfig 
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };

        // Update all volume detectors with new threshold
        if (newConfig.volumeAnomalyThreshold) {
            for (const trackers of this.marketTrackers.values()) {
                trackers.volume.setThreshold(newConfig.volumeAnomalyThreshold);
            }
        }

        console.log('[SignalEngine] Config updated:', this.config);
    }

    /**
     * Remove a market from tracking
     * @param {string} conditionId 
     */
    removeMarket(conditionId) {
        const trackers = this.marketTrackers.get(conditionId);
        if (trackers && trackers.region) {
            const regionData = this.regionAggregates.get(trackers.region);
            if (regionData) {
                regionData.markets.delete(conditionId);
            }
        }
        this.marketTrackers.delete(conditionId);
    }

    /**
     * Get current stats for monitoring
     */
    getStats() {
        return {
            trackedMarkets: this.marketTrackers.size,
            activeRegions: this.regionAggregates.size,
            recentSignalCount: this.recentSignals.size,
            config: this.config
        };
    }
}

// Export singleton instance
export const signalEngine = new SignalEngine();
