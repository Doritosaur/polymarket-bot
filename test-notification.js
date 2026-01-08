
import { notifyDiscord, initializeDiscord } from './src/discord/notifier.js';
import { config } from './src/config.js';

// Mock Data representing a trade from Aggregator
const mockTrade = {
    type: 'trade',
    tradeType: 'BUY',
    outcome: 'YES',
    conditionId: '0xd94b47bdeba16ae948bfb147bda059f3543d6fca73291644dfff5268bba7a797', // Tucker Carlson 2028 (from user example)
    marketName: 'will-tucker-carlson-win-the-2028-us-presidential-election',
    question: 'Will Tucker Carlson win the 2028 US Presidential Election?',
    price: 0.01,
    amount: '1000',
    value: '10',
    timestamp: Date.now(),
    endDate: '2028-11-07T00:00:00Z',
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/tucker.png'
};

async function runTest() {
    console.log('Initializing Discord...');
    await initializeDiscord();

    // Give it a moment to connect
    await new Promise(r => setTimeout(r, 2000));

    console.log('Sending Test Notification...');
    await notifyDiscord(mockTrade);

    console.log('Done! Check Discord.');
    process.exit(0);
}

runTest();
