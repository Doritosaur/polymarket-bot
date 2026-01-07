import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { notifyDiscord } from '../discord/notifier.js';

const connection = {
    host: config.redisHost,
    port: config.redisPort
};

// 1. The Producer Queue
export const tradeQueue = new Queue('trade-notification-queue', { connection });

// 2. The Consumer Worker
const worker = new Worker('trade-notification-queue', async (job) => {
    const tradeData = job.data;

    // Calculate probabilities based on traded price
    // Polymarket prices sum to 1.0 (approx). P(Yes) + P(No) = 1.0
    const tradedProb = (tradeData.price * 100).toFixed(4);
    const inverseProb = ((1 - tradeData.price) * 100).toFixed(4);

    const side = tradeData.outcome; // 'YES' or 'NO'
    const otherSide = side === 'YES' ? 'NO' : 'YES';

    const marketPrices = `**${side}:** ${tradedProb}% | **${otherSide}:** ${inverseProb}%`;

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
