import { createServer } from './server.js';
import { initializeWebSockets } from './websocket.js';

import { initializeDiscord, cleanupDiscord } from './discord/notifier.js';
import { marketRegistry } from './database/marketRegistry.js';
import { startNotificationWorker, closeNotificationQueue } from './queue/notificationQueue.js';
import { config } from './config.js';
import { closeBroadcast } from './utils/broadcast.js';

let server = null;

async function start() {
  try {
    console.log(`[System] Starting Polymer Monitor Bot (Gateway) (PID: ${process.pid})`);

    await marketRegistry.initialize();
    await initializeDiscord();

    // Start consuming notifications from Ingest
    startNotificationWorker();

    const app = createServer();

    server = app.listen(config.port, () => {
      console.log(`\nServer running on http://localhost:${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/health`);
      console.log(`Status: http://localhost:${config.port}/status\n`);

      initializeWebSockets(server);
    });

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown() {
  console.log('\nShutting down gracefully...');

  if (server) {
    server.close();
  }

  await closeNotificationQueue();
  await cleanupDiscord();
  await marketRegistry.close();
  closeBroadcast();

  console.log('Shutdown complete');
  process.exit(0);
}

start();
