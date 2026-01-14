import { clobListener } from '../clob/clobListener.js';
import { marketRegistry } from '../database/marketRegistry.js';
import { initializeMarketFetcher, closeMarketQueue } from '../queue/marketQueue.js';
import { closeNotificationQueue } from '../queue/notificationQueue.js';
import { subscribeToEvents, EventType, broadcast } from '../utils/broadcast.js';

async function start() {
    try {
        console.log(`[Ingest] Starting Ingestion Service (PID: ${process.pid})`);

        await marketRegistry.initialize();

        await clobListener.initialize();

        // await globalMonitor.start();
        console.log('[Ingest] MarketQueue now driving Global Watch (Event-Driven).');

        // Start the Market Fetcher Cron
        await initializeMarketFetcher();

        // ... (subscribe logic)

        // Subscribe to inter-service events
        subscribeToEvents(async (type, payload) => {
            try {
                switch (type) {
                    case EventType.MARKET_ADDED:
                        if (payload.conditionIds) await clobListener.addMarkets(payload.conditionIds);
                        break;
                    case EventType.MARKET_REMOVED:
                        if (payload.conditionIds) await clobListener.removeMarkets(payload.conditionIds);
                        else if (payload.conditionId) await clobListener.removeMarket(payload.conditionId);
                        break;
                    case EventType.THRESHOLD_UPDATED:
                        if (payload.type === 'global') clobListener.setThreshold(payload.amount);
                        else if (payload.type === 'event') await clobListener.updateEventThreshold(payload.slug, payload.amount);
                        break;
                }
            } catch (err) {
                console.error(`[Ingest] Error handling event ${type}:`, err);
            }
        });

        console.log('[Ingest] Service is running.');

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (error) {
        console.error('[Ingest] Failed to start:', error);
        process.exit(1);
    }
}

async function shutdown() {
    console.log('\n[Ingest] Shutting down gracefully...');

    // await globalMonitor.stop();
    await clobListener.cleanup();
    await closeMarketQueue();
    await closeNotificationQueue();
    await marketRegistry.close();

    console.log('[Ingest] Shutdown complete');
    process.exit(0);
}

start();
