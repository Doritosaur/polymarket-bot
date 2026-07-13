import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { notifyDiscord } from '../discord/notifier.js';

const connection = config.redisConnection;

// 1. The Producer Queue
export const tradeQueue = new Queue('trade-notification-queue', { connection });

// 2. The Consumer Worker
const worker = new Worker('trade-notification-queue', async (job) => {
    const tradeData = job.data;
    const tradedProb = (tradeData.price * 100).toFixed(4);
    const inverseProb = ((1 - tradeData.price) * 100).toFixed(4);

    const side = tradeData.outcome;
    const otherSide = side === 'YES' ? 'NO' : 'YES';

    const marketPrices = `**${side}:** ${tradedProb}% | **${otherSide}:** ${inverseProb}%`;

    const notificationData = {
        ...tradeData,
        marketPrices
    };

    await notifyDiscord(notificationData);

}, {
    connection,
    limiter: {
        max: 5,
        duration: 1000
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
