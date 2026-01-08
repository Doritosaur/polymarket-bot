import { config } from '../config.js';

const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const statsCache = new Map();

export async function getMarketStats(slug) {
    if (!slug) return null;

    // Check cache
    const cached = statsCache.get(slug);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return cached.data;
    }

    try {
        // Query Gamma API by slug
        // Endpoint: /markets/slug/:slug
        const response = await fetch(`https://gamma-api.polymarket.com/markets/slug/${slug}`);

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        // The /markets/slug/:slug endpoint returns a single market object
        const market = data;

        if (!market) return null;

        const stats = {
            volume: market.volume || 0,
            volume24hr: market.volume24hr || 0,
            liquidity: market.liquidity || 0,
            outcomePrices: market.outcomePrices ? JSON.parse(market.outcomePrices) : null,
            outcomes: market.outcomes ? JSON.parse(market.outcomes) : null
        };

        // Update cache
        statsCache.set(slug, {
            timestamp: Date.now(),
            data: stats
        });

        return stats;

    } catch (error) {
        console.error(`[Gamma] Error fetching market stats:`, error.message);
        return null;
    }
}
