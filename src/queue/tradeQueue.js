import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { notifyDiscord } from '../discord/notifier.js';
import { fetchMarketOutcomePrices } from '../server.js';

const connection = {
    host: config.redisHost,
    port: config.redisPort
};

// 1. The Producer Queue
export const tradeQueue = new Queue('trade-notification-queue', { connection });

// 2. The Consumer Worker
const worker = new Worker('trade-notification-queue', async (job) => {
    const tradeData = job.data;

    // Fetch prices (with caching from server.js)
    const marketPrices = await fetchMarketOutcomePrices(tradeData.marketName);

    // Update the data with fetched prices
    const notificationData = {
        ...tradeData,
        marketPrices
    };

    // Send to Discord
    await notifyDiscord(notificationData);

}, {
    connection,
    limiter: {
        max: 5,         // Max 5 jobs
        duration: 1000  // Per 1 second
    }
});

worker.on('completed', job => {
    // console.log(`Job ${job.id} completed!`);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed: ${err.message}`);
});

export async function addTradeToQueue(data) {
    try {
        // Add job to queue
        // removeOnComplete: true keeps Redis clean
        await tradeQueue.add('process-trade', data, {
            removeOnComplete: true,
            removeOnFail: 1000
        });
    } catch (error) {
        console.error('Failed to add trade to queue:', error);
    }
}

export async function closeQueue() {
    await tradeQueue.close();
    await worker.close();
}
