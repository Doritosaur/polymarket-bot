import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { marketRegistry } from '../database/marketRegistry.js';

const connection = {
    host: config.redisHost,
    port: config.redisPort
};

export const marketQueue = new Queue('market-fetch-queue', { connection });

const worker = new Worker('market-fetch-queue', async (job) => {
    console.log(`[MarketFetch] Starting sync job: ${job.name}`);
    try {
        const allMarkets = await fetchAllActiveMarkets();

        if (allMarkets.length > 0) {
            console.log(`[MarketFetch] Fetched ${allMarkets.length} active markets. Syncing to DB...`);
            marketRegistry.upsertMarkets(allMarkets, { fullSync: true });
            console.log(`[MarketFetch] Sync complete.`);
        } else {
            console.log(`[MarketFetch] No markets found (unlikely if API is up).`);
        }
    } catch (error) {
        console.error(`[MarketFetch] Job failed:`, error);
        throw error;
    }
}, {
    connection,
    limiter: {
        max: 1,
        duration: 5000
    }
});

worker.on('failed', (job, err) => {
    console.error(`[MarketFetch] Job ${job.id} failed: ${err.message}`);
});

async function fetchAllActiveMarkets() {
    let allProcessedMarkets = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
        try {
            const url = `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=${limit}&offset=${offset}`;
            console.log(`[MarketFetch] Fetching ${url}...`);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }

            const events = await response.json();

            if (!Array.isArray(events) || events.length === 0) {
                hasMore = false;
                break;
            }

            for (const event of events) {
                if (!event.markets) continue;

                for (const market of event.markets) {
                    if (market.active && !market.closed) {
                        let clobTokenIds = market.clobTokenIds;
                        if (Array.isArray(clobTokenIds)) {
                            clobTokenIds = JSON.stringify(clobTokenIds);
                        }
                        allProcessedMarkets.push({
                            conditionId: market.conditionId,
                            slug: market.slug,
                            description: market.description || event.description,
                            clobTokenIds: clobTokenIds,
                            eventSlug: event.slug,
                            threshold: null,
                            endDate: market.endDateIso || market.endDate,
                            image: market.image || event.image,
                            groupDate: market.groupItemTitle,
                            active: true
                        });
                    }
                }
            }

            if (events.length < limit) {
                hasMore = false;
            } else {
                offset += limit;
                await new Promise(r => setTimeout(r, 200));
            }

        } catch (err) {
            console.error(`[MarketFetch] Error fetching page at offset ${offset}:`, err);
            throw err;
        }
    }

    return allProcessedMarkets;
}

export async function initializeMarketFetcher() {
    await marketQueue.add(
        'fetch-active-markets-job',
        {},
        {
            repeat: {
                every: 10 * 60 * 1000
            },
            jobId: 'market-fetch-periodic'
        }
    );
    console.log('[MarketFetch] Scheduled repeatable market fetch job (every 10m).');
    await marketQueue.add('fetch-active-markets-now', {}, {
        removeOnComplete: true
    });
}

export async function closeMarketQueue() {
    await marketQueue.close();
    await worker.close();
}
