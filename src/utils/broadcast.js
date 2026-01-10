import { Redis } from 'ioredis';
import { config } from '../config.js';

const pub = new Redis(config.redisPort, config.redisHost);
const sub = new Redis(config.redisPort, config.redisHost);

const CHANNEL = 'bot_events';

export const EventType = {
    MARKET_ADDED: 'MARKET_ADDED',
    MARKET_REMOVED: 'MARKET_REMOVED',
    THRESHOLD_UPDATED: 'THRESHOLD_UPDATED',
    MARKET_SEARCHED: 'MARKET_SEARCHED',
    EVENT_SEARCHED: 'EVENT_SEARCHED'
};

export async function publishEvent(type, payload) {
    try {
        const message = JSON.stringify({ type, payload });
        await pub.publish(CHANNEL, message);
    } catch (err) {
        console.error('[Broadcast] Failed to publish event:', err);
    }
}

export function subscribeToEvents(handler) {
    sub.subscribe(CHANNEL, (err) => {
        if (err) console.error('[Broadcast] Failed to subscribe:', err);
        else console.log(`[Broadcast] Subscribed to ${CHANNEL}`);
    });

    sub.on('message', (channel, message) => {
        if (channel === CHANNEL) {
            try {
                const data = JSON.parse(message);
                handler(data.type, data.payload);
            } catch (err) {
                console.error('[Broadcast] Invalid message:', err);
            }
        }
    });

    return sub;
}

export function closeBroadcast() {
    pub.disconnect();
    sub.disconnect();
}
