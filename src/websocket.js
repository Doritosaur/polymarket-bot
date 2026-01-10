import { Server } from 'socket.io';
import { subscribeToEvents } from './utils/broadcast.js';
import { marketRegistry } from './database/marketRegistry.js';

let io;

export function initializeWebSockets(server) {
    if (io) return io;

    io = new Server(server, {
        cors: {
            origin: ["http://localhost:5173", "http://127.0.0.1:5173"], // Vite default port
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log(`[WebSocket] Client connected: ${socket.id}`);

        socket.emit('status', { message: 'Connected to Polymarket Bot' });

        socket.on('command', async (data) => {
            const { command, id } = data;
            console.log(`[WebSocket] Received command: ${command}`);

            try {
                let response;
                switch (command.toLowerCase().trim()) {
                    case 'ping':
                        response = 'pong';
                        break;

                    case 'status':
                        const activeCount = (await marketRegistry.getWatchedMarkets()).length;
                        response = {
                            status: 'running',
                            uptime: process.uptime(),
                            activeMarkets: activeCount,
                            service: 'polymarket-bot'
                        };
                        break;

                    case 'markets':
                        const markets = await marketRegistry.getWatchedMarkets();
                        response = {
                            count: markets.length,
                            markets: markets.map(m => ({
                                conditionId: m.condition_id,
                                slug: m.slug,
                                question: m.question
                            }))
                        };
                        break;

                    default:
                        response = `Unknown command: ${command}`;
                }

                socket.emit('command_response', { id, command, response });

            } catch (error) {
                console.error(`Error processing command ${command}:`, error);
                socket.emit('command_response', { id, command, error: error.message });
            }
        });

        socket.on('disconnect', () => {
            console.log(`[WebSocket] Client disconnected: ${socket.id}`);
        });
    });

    // Subscribe to Redis events and forward them to all connected clients
    subscribeToEvents((type, payload) => {
        // Emit broadly with the type as the event name, or generic 'event'
        console.log(`[WebSocket] Forwarding event: ${type}`);
        io.emit('event', { type, payload, timestamp: Date.now() });

        // Also emit specific events for easier handling
        io.emit(type, payload);
    });

    console.log('[WebSocket] Initialized');
    return io;
}
