import { createServer } from './server.js';

import { clobListener } from './clob/clobListener.js';
import { initializeDiscord, cleanupDiscord } from './discord/notifier.js';
import { marketRegistry } from './database/marketRegistry.js';
import { closeQueue } from './queue/tradeQueue.js';
import { initializeMarketFetcher, closeMarketQueue } from './queue/marketQueue.js';
import { config } from './config.js';

let server = null;

async function start() {
  try {
    console.log('Starting Polymarket Monitor Bot...\n');

    await initializeDiscord();

    await clobListener.initialize();

    // Start the Market Fetcher Cron
    await initializeMarketFetcher();

    const app = createServer();

    server = app.listen(config.port, () => {
      console.log(`\nServer running on http://localhost:${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/health`);
      console.log(`Status: http://localhost:${config.port}/status\n`);
      console.log('Listening for large trades on Polymarket markets (via CLOB)...\n');
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


  await clobListener.cleanup();
  await closeQueue();
  await closeMarketQueue();
  await cleanupDiscord();
  marketRegistry.close();

  console.log('Shutdown complete');
  process.exit(0);
}

start();
