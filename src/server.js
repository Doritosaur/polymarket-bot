import express from 'express';
import { marketRegistry } from './database/marketRegistry.js';
import { config } from './config.js';
import { getEvent, getMarket } from './utils/gammaClient.js';
import { publishEvent, EventType } from './utils/broadcast.js';

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
    // Note: Active Listeners count is now part of Ingest service, not available here directly
    res.json({
      status: 'running',
      service: 'bot-gateway',
      totalStats: 'See Ingest Logs'
    });
  });

  app.get('/api/markets', async (req, res) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const markets = includeInactive
        ? await marketRegistry.getAllMarkets()
        : await marketRegistry.getActiveMarkets();

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

  app.get('/api/markets/:conditionId', async (req, res) => {
    try {
      const market = await marketRegistry.getMarket(req.params.conditionId);

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
      await marketRegistry.removeMarket(req.params.conditionId);

      // Notify Ingest to stop listening
      publishEvent(EventType.MARKET_REMOVED, { conditionId: req.params.conditionId });

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
      const markets = await marketRegistry.getMarketsByEventSlug(slug);

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
          await marketRegistry.removeMarket(market.condition_id);
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

      // 3. Notify Ingest
      if (removedConditionIds.length > 0) {
        // Send one by one or batch? clobListener.removeMarkets takes array
        // But our event protocol... let's define payload as conditionIds array for batch?
        // Or just loop. Simple is loop or one event.
        // clobListener.removeMarkets takes array.
        // Lets modify broadcast handler to support batch removal or multiple events.
        // Or just send one event with array.
        publishEvent(EventType.MARKET_REMOVED, { conditionIds: removedConditionIds });
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

      let data = await getEvent(slug);
      let isSingleMarket = false;

      // Fallback: If event not found, try finding a single market
      if (!data) {
        const marketData = await getMarket(slug);
        if (marketData) {
          // Wrap it in an event-like structure so the loop below works
          data = {
            ...marketData,
            slug: marketData.slug, // ensure event slug is market slug
            markets: [marketData]
          };
          isSingleMarket = true;
        }
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          error: `Event or Market '${slug}' not found`
        });
      }

      let addedCount = 0;
      const addedMarkets = [];

      if (data.markets && Array.isArray(data.markets)) {
        for (const market of data.markets) {
          if (market.conditionId) {
            try {
              const name = market.slug || market.question || 'Unknown Market';
              const description = market.question || market.description || name;
              const clobTokenIds = market.clobTokenIds;

              const image = market.image || data.image || null;
              const endDate = market.endDate || data.endDate || null;
              const groupDate = market.groupItemTitle || null;

              // Pass 'slug' (the event slug) as the 5th argument
              // Wait, addMarket returns ID now using Postgres, but we don't capture it here.
              // Just await it.
              await marketRegistry.addMarket(market.conditionId, name, description, clobTokenIds, slug, null, endDate, image, groupDate);

              addedCount++;
              addedMarkets.push(market.conditionId);
            } catch (err) {
              console.warn(`Failed to auto-add market ${market.conditionId}:`, err.message);
            }
          }
        }
      }

      if (addedCount > 0) {
        // Notify Ingest
        publishEvent(EventType.MARKET_ADDED, { conditionIds: addedMarkets });
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


