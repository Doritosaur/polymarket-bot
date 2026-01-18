/**
 * VelocityTracker - Sliding window price velocity calculator
 * Tracks rate of change in price over configurable time windows
 */
export class VelocityTracker {
    constructor(windowMs = 60000) {
        this.windowMs = windowMs;
        this.pricePoints = []; // { price, timestamp }
    }

    /**
     * Record a new price point
     * @param {number} price 
     * @param {number} timestamp 
     */
    record(price, timestamp = Date.now()) {
        this.pricePoints.push({ price, timestamp });
        this._prune(timestamp);
    }

    /**
     * Get current velocity (rate of change per minute)
     * @returns {number} Velocity as percentage change per minute
     */
    getVelocity() {
        if (this.pricePoints.length < 2) return 0;

        const oldest = this.pricePoints[0];
        const newest = this.pricePoints[this.pricePoints.length - 1];

        const deltaTime = (newest.timestamp - oldest.timestamp) / 60000; // Convert to minutes
        if (deltaTime === 0) return 0;

        const deltaPrice = newest.price - oldest.price;
        const percentChange = (deltaPrice / oldest.price) * 100;

        return percentChange / deltaTime; // % per minute
    }

    /**
     * Get price direction based on velocity
     * @returns {'up' | 'down' | 'stable'}
     */
    getDirection() {
        const velocity = this.getVelocity();
        if (velocity > 0.5) return 'up';
        if (velocity < -0.5) return 'down';
        return 'stable';
    }

    /**
     * Get the total price change in the window
     * @returns {number} Absolute price change
     */
    getPriceChange() {
        if (this.pricePoints.length < 2) return 0;
        const oldest = this.pricePoints[0];
        const newest = this.pricePoints[this.pricePoints.length - 1];
        return newest.price - oldest.price;
    }

    /**
     * Get the percentage change in the window
     * @returns {number} Percentage change
     */
    getPercentChange() {
        if (this.pricePoints.length < 2) return 0;
        const oldest = this.pricePoints[0];
        const newest = this.pricePoints[this.pricePoints.length - 1];
        return ((newest.price - oldest.price) / oldest.price) * 100;
    }

    /**
     * Remove price points outside the window
     * @param {number} now Current timestamp
     */
    _prune(now) {
        const cutoff = now - this.windowMs;
        while (this.pricePoints.length > 0 && this.pricePoints[0].timestamp < cutoff) {
            this.pricePoints.shift();
        }
    }

    /**
     * Clear all recorded data
     */
    reset() {
        this.pricePoints = [];
    }

    /**
     * Get number of data points in window
     */
    getDataPointCount() {
        return this.pricePoints.length;
    }
}
