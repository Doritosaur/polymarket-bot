import express from 'express';
import { marketRegistry } from './database/marketRegistry.js';
import { clobListener } from './clob/clobListener.js';
import { config } from './config.js';

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

  // Middleware for API Key Authentication
  const requireAuth = (req, res, next) => {
    const apiKey = req.get('x-api-key');
    if (!apiKey || apiKey !== config.adminApiKey) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key' });
    }
    next();
  };

  app.delete('/api/markets/:conditionId', requireAuth, async (req, res) => {
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


  app.delete('/api/events/:slug', requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;

      // 1. Fetch relevant markets from local database
      // The `slug` param here is the EVENT slug (e.g. "presidential-election")
      const markets = marketRegistry.getMarketsByEventSlug(slug);

      if (markets.length === 0) {
        return res.status(404).json({
          success: false,
          error: `No active markets found for event: ${slug} (or event not tracked)`
        });
      }

      // 2. Identify which of these markets we are actually tracking
      // Since we queried the DB, we know we are tracking ALL of them.
      let removedCount = 0;
      const removedConditionIds = [];

      for (const market of markets) {
        try {
          marketRegistry.removeMarket(market.condition_id);
          removedCount++;
          removedConditionIds.push(market.condition_id);
        } catch (err) {
          console.error(`Error processing removal for ${market.condition_id}:`, err);
        }
      }

      if (removedCount === 0) {
        return res.status(404).json({
          success: false,
          error: `Event exists, but we are not tracking any of its markets.`
        });
      }

      // 3. Batch remove from CLOB listener
      if (removedConditionIds.length > 0) {
        await clobListener.removeMarkets(removedConditionIds);
      }

      res.json({
        success: true,
        message: `Successfully removed ${removedCount} markets for event: ${slug}`,
        removedCount
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });


  app.post('/api/events/:slug', requireAuth, async (req, res) => {
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

              // Pass 'slug' (the event slug) as the 5th argument
              marketRegistry.addMarket(market.conditionId, name, description, clobTokenIds, slug);
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


