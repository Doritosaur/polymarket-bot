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

  // Middleware for API Key Authentication
  const requireAuth = (req, res, next) => {
    const apiKey = req.get('x-api-key');
    if (!apiKey || apiKey !== config.adminApiKey) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key' });
    }
    next();
  };

  app.delete('/api/events/:slug', requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;

      const markets = await marketRegistry.getMarketsByEventSlug(slug);

      if (markets.length === 0) {
        return res.status(404).json({
          success: false,
          error: `No active markets found for event: ${slug} (or event not tracked)`
        });
      }
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

      // 3. Notify Ingest and Dashboard
      if (removedConditionIds.length > 0) {
        publishEvent(EventType.MARKET_REMOVED, {
          conditionIds: removedConditionIds,
          slug,
          source: {
            guildId: req.body.guildId,
            guildName: req.body.guildName,
            channelId: req.body.channelId,
            channelName: req.body.channelName,
            user: req.body.user
          }
        });
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
          data = {
            ...marketData,
            slug: marketData.slug,
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
        // Notify Ingest and Dashboard
        publishEvent(EventType.MARKET_ADDED, {
          conditionIds: addedMarkets,
          slug,
          source: {
            guildId: req.body.guildId,
            guildName: req.body.guildName,
            channelId: req.body.channelId,
            channelName: req.body.channelName,
            user: req.body.user
          }
        });
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


