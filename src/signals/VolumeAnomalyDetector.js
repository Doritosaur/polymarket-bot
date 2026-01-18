/**
 * VolumeAnomalyDetector - Detects unusual volume spikes
 * Uses rolling average with configurable threshold multiplier
 */
export class VolumeAnomalyDetector {
    constructor(windowMs = 300000, threshold = 2.0) {
        this.windowMs = windowMs;           // 5 minute default window
        this.threshold = threshold;         // 2x average = anomaly
        this.volumePoints = [];             // { volume, timestamp }
    }

    /**
     * Record a new volume data point
     * @param {number} volume Trade volume in USD
     * @param {number} timestamp 
     */
    record(volume, timestamp = Date.now()) {
        this.volumePoints.push({ volume, timestamp });
        this._prune(timestamp);
    }

    /**
     * Get the rolling average volume
     * @returns {number}
     */
    getRollingAverage() {
        if (this.volumePoints.length === 0) return 0;
        const sum = this.volumePoints.reduce((acc, p) => acc + p.volume, 0);
        return sum / this.volumePoints.length;
    }

    /**
     * Get total volume in window
     * @returns {number}
     */
    getTotalVolume() {
        return this.volumePoints.reduce((acc, p) => acc + p.volume, 0);
    }

    /**
     * Check if a given volume is an anomaly
     * @param {number} volume 
     * @returns {{ isAnomaly: boolean, score: number, average: number }}
     */
    isAnomaly(volume) {
        const average = this.getRollingAverage();

        // If no baseline yet, can't determine anomaly
        if (average === 0 || this.volumePoints.length < 5) {
            return { isAnomaly: false, score: 0, average };
        }

        const score = volume / average;
        return {
            isAnomaly: score >= this.threshold,
            score,
            average
        };
    }

    /**
     * Update threshold dynamically
     * @param {number} newThreshold 
     */
    setThreshold(newThreshold) {
        this.threshold = newThreshold;
    }

    /**
     * Remove volume points outside the window
     * @param {number} now Current timestamp
     */
    _prune(now) {
        const cutoff = now - this.windowMs;
        while (this.volumePoints.length > 0 && this.volumePoints[0].timestamp < cutoff) {
            this.volumePoints.shift();
        }
    }

    /**
     * Clear all recorded data
     */
    reset() {
        this.volumePoints = [];
    }

    /**
     * Get number of data points in window
     */
    getDataPointCount() {
        return this.volumePoints.length;
    }

    /**
     * Get volume rate (volume per minute)
     * @returns {number}
     */
    getVolumeRate() {
        if (this.volumePoints.length < 2) return 0;

        const oldest = this.volumePoints[0];
        const newest = this.volumePoints[this.volumePoints.length - 1];
        const deltaMinutes = (newest.timestamp - oldest.timestamp) / 60000;

        if (deltaMinutes === 0) return 0;
        return this.getTotalVolume() / deltaMinutes;
    }
}
