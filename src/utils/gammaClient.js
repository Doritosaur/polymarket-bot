import { config } from '../config.js';

const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const statsCache = new Map();

// Simple in-memory cache helper
async function fetchWithCache(key, fetchFn, ttl = CACHE_TTL_MS) {
    const cached = statsCache.get(key);
    if (cached && (Date.now() - cached.timestamp < ttl)) {
        return cached.data;
    }

    const data = await fetchFn();

    if (data) {
        statsCache.set(key, {
            timestamp: Date.now(),
            data
        });
    }

    return data;
}

export async function getMarketStats(slug) {
    if (!slug) return null;

    // Reuse the same cache map, but prefix keys to avoid collisions
    return fetchWithCache(`stats:${slug}`, async () => {
        try {
            const market = await getMarket(slug);
            if (!market) return null;

            return {
                volume: market.volume || 0,
                volume24hr: market.volume24hr || 0,
                liquidity: market.liquidity || 0,
                outcomePrices: market.outcomePrices ? JSON.parse(market.outcomePrices) : null,
                outcomes: market.outcomes ? JSON.parse(market.outcomes) : null
            };
        } catch (error) {
            console.error(`[Gamma] Error fetching market stats:`, error.message);
            return null;
        }
    });
}

export async function getEvent(slug) {
    return fetchWithCache(`event:${slug}`, async () => {
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
    });
}

export async function getMarket(slug) {
    return fetchWithCache(`market:${slug}`, async () => {
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
    });
}
