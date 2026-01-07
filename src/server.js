import express from 'express';
import { marketRegistry } from './database/marketRegistry.js';

import { clobListener } from './clob/clobListener.js';

export function createServer() {
  const app = express();

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  app.get('/status', (req, res) => {
    const markets = marketRegistry.getActiveMarkets();
    res.json({
      status: 'running',
      markets: markets.map(m => ({
        conditionId: m.condition_id,
        slug: m.slug,
        description: m.description
      })),
      activeListeners: clobListener.getActiveListenersCount(),
      trackedMarkets: clobListener.getTrackedMarketsCount(),
      totalMarkets: markets.length,
    });
  });

  app.get('/api/markets', (req, res) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const markets = includeInactive
        ? marketRegistry.getAllMarkets()
        : marketRegistry.getActiveMarkets();

      res.json({
        success: true,
        markets
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  app.get('/api/markets/:conditionId', (req, res) => {
    try {
      const market = marketRegistry.getMarket(req.params.conditionId);

      if (!market) {
        return res.status(404).json({
          success: false,
          error: 'Market not found'
        });
      }

      res.json({
        success: true,
        market
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  app.delete('/api/markets/:conditionId', async (req, res) => {
    try {
      marketRegistry.removeMarket(req.params.conditionId);
      await clobListener.removeMarket(req.params.conditionId);

      res.json({
        success: true,
        message: 'Market removed successfully'
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  });


  app.post('/api/events/:slug', async (req, res) => {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.status(400).json({
          success: false,
          error: 'Slug is required'
        });
      }

      const response = await fetch(`https://gamma-api.polymarket.com/events/slug/${slug}`);

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: `Gamma API returned ${response.status}: ${response.statusText}`
        });
      }

      const data = await response.json();

      let addedCount = 0;
      const addedMarkets = [];

      if (data.markets && Array.isArray(data.markets)) {
        for (const market of data.markets) {
          if (market.conditionId) {
            try {
              const name = market.slug || market.question || 'Unknown Market';
              const description = market.question || market.description || name;
              const clobTokenIds = market.clobTokenIds;

              marketRegistry.addMarket(market.conditionId, name, description, clobTokenIds);
              addedCount++;
              addedMarkets.push(market.conditionId);
            } catch (err) {
              console.warn(`Failed to auto-add market ${market.conditionId}:`, err.message);
            }
          }
        }
      }

      if (addedCount > 0) {
        await clobListener.addMarkets(addedMarkets);
      }

      res.json({
        success: true,
        addedCount,
        addedMarkets,
        data
      });
    } catch (error) {
      console.error('Error fetching event by slug:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return app;
}

const priceCache = new Map();
const CACHE_TTL = 5000; // 5 seconds cache

export async function fetchMarketOutcomePrices(slug) {
  try {
    const now = Date.now();
    if (priceCache.has(slug)) {
      const { timestamp, data } = priceCache.get(slug);
      if (now - timestamp < CACHE_TTL) {
        return data;
      }
    }

    const response = await fetch(`https://gamma-api.polymarket.com/markets/slug/${slug}`);
    if (!response.ok) return null;
    const data = await response.json();

    const outcomes = JSON.parse(data.outcomes);
    const prices = JSON.parse(data.outcomePrices);

    if (!outcomes || !prices || outcomes.length !== prices.length) return null;

    const formattedPrices = outcomes.map((outcome, index) => {
      const p = parseFloat(prices[index]);
      return `**${outcome}:** ${(p * 100).toFixed(2)}%`;
    }).join(' | ');

    priceCache.set(slug, { timestamp: now, data: formattedPrices });
    return formattedPrices;

  } catch (error) {
    console.error(`Error fetching prices for ${slug}:`, error);
    return null;
  }
}
