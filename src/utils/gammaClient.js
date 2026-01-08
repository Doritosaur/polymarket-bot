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
        // Query Gamma API by slug via shared service
        const market = await getMarket(slug);

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

export async function getEvent(slug) {
    try {
        const response = await fetch(`${config.polymarket.gammaApiUrl}/events/slug/${slug}`);
        if (response.status === 404) return null;
        if (!response.ok) {
            throw new Error(`Gamma API Error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`[Gamma] Error fetching event ${slug}:`, error.message);
        throw error;
    }
}

export async function getMarket(slug) {
    try {
        const response = await fetch(`${config.polymarket.gammaApiUrl}/markets/slug/${slug}`);
        if (response.status === 404) return null;
        if (!response.ok) {
            throw new Error(`Gamma API Error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`[Gamma] Error fetching market ${slug}:`, error.message);
        throw error;
    }
}
