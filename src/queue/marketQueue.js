import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { marketRegistry } from '../database/marketRegistry.js';

const connection = {
    host: config.redisHost,
    port: config.redisPort
};

export const marketQueue = new Queue('market-fetch-queue', { connection });

let worker;

async function fetchAllActiveMarkets(onBatch) {
    let offset = 0;
    const limit = 1000; // Increased limit for fewer requests, Gamma supports up to 1000 usually
    let hasMore = true;
    let batch = [];
    const BATCH_SIZE = 500; // Upsert every 500 markets to save memory

    while (hasMore) {
        try {
            const url = `${config.polymarket.gammaApiUrl}/events?active=true&closed=false&limit=${limit}&offset=${offset}`;
            console.log(`[MarketFetch] Fetching offset ${offset}...`);
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

                        batch.push({
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

                        if (batch.length >= BATCH_SIZE) {
                            await onBatch(batch);
                            batch = []; // Clear memory
                            // Yield to event loop
                            await new Promise(r => setImmediate(r));
                        }
                    }
                }
            }

            if (events.length < limit) {
                hasMore = false;
            } else {
                offset += limit;
                // Small delay to be nice to API
                await new Promise(r => setTimeout(r, 100));
            }

        } catch (err) {
            console.error(`[MarketFetch] Error fetching page at offset ${offset}:`, err.message);
            // Don't throw entire job for one failed page, try to continue or break? 
            // In strict mode we might throw, but for stability let's break or retry.
            // Let's throw to be safe for now, manual restart needed.
            throw err;
        }
    }

    // Process remaining
    if (batch.length > 0) {
        await onBatch(batch);
    }
}

async function startMarketWorker() {
    if (worker) return; // Already started

    worker = new Worker('market-fetch-queue', async (job) => {
        console.log(`[MarketFetch] Starting sync job: ${job.name} (ID: ${job.id})`);
        try {
            let totalSynced = 0;

            await fetchAllActiveMarkets(async (batch) => {
                if (batch.length === 0) return;
                try {
                    // Perform upsert for this batch
                    await marketRegistry.upsertMarkets(batch, { fullSync: false }); // Partial sync
                    totalSynced += batch.length;
                    console.log(`[MarketFetch] Synced batch of ${batch.length} markets (Total: ${totalSynced})`);
                } catch (dbErr) {
                    console.error(`[MarketFetch] Batch upsert failed:`, dbErr);
                }
            });

            console.log(`[MarketFetch] Sync cycle complete. Total synced: ${totalSynced}`);

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

    console.log('[MarketFetch] Worker started.');
}

export async function initializeMarketFetcher() {
    // 0. Drain any backlog of jobs from previous crash loops
    await marketQueue.drain();
    console.log('[MarketFetch] Drained queue backlog.');

    // 1. Clean up old repeatable jobs to prevent duplicates
    const repeatableJobs = await marketQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
        if (job.name === 'fetch-active-markets-job') {
            await marketQueue.removeRepeatableByKey(job.key);
        }
    }

    // 2. Start the worker NOW (fresh slate)
    await startMarketWorker();

    // 3. Schedule new repeatable job
    await marketQueue.add(
        'fetch-active-markets-job',
        {},
        {
            repeat: {
                every: 10 * 60 * 1000
            },
            jobId: 'market-fetch-periodic' // Ensures uniqueness
        }
    );
    console.log('[MarketFetch] Scheduled repeatable market fetch job (every 10m).');

    // 4. Trigger immediate sync (since we drained, queue is empty)
    await marketQueue.add('fetch-active-markets-now', {}, {
        removeOnComplete: true
    });
    console.log('[MarketFetch] Triggered immediate initial sync.');
}

export async function closeMarketQueue() {
    await marketQueue.close();
    if (worker) {
        await worker.close();
    }
}
