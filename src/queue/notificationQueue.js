import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { notifyDiscord } from '../discord/notifier.js';

const connection = {
    host: config.redisHost,
    port: config.redisPort
};

// Publisher (Ingest Service uses this)
export const notificationQueue = new Queue('notification-queue', {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 100
    }
});

// Worker (Bot Service uses this)
// We export a function to start it, so it's only started in the Bot process
let worker;

export function startNotificationWorker() {
    if (worker) return;

    console.log('[NotificationWorker] Starting...');

    worker = new Worker('notification-queue', async (job) => {
        try {
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
        } catch (error) {
            console.error(`[NotificationWorker] Job ${job.id} failed:`, error.message);
            // We usually don't throw here to avoid infinite retries on "Discord API Error: 500"
            // But if it's a transient network error, maybe we should.
            // For now, log and swallow to keep queue moving.
        }
    }, {
        connection,
        concurrency: 5 // Allow sending multiple Discord messages in parallel (rate limited by lib usually)
    });

    worker.on('failed', (job, err) => {
        console.error(`[NotificationWorker] Job ${job.id} failed: ${err.message}`);
    });
}

export async function addNotification(data) {
    try {
        await notificationQueue.add('trade-notification', data);
    } catch (error) {
        console.error('[NotificationQueue] Failed to add job:', error);
    }
}

export async function closeNotificationQueue() {
    await notificationQueue.close();
    if (worker) {
        await worker.close();
    }
}
