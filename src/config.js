import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  minAmountThreshold: parseFloat(process.env.MIN_AMOUNT_THRESHOLD || '1000'),
  discordToken: process.env.DISCORD_TOKEN || '',
  discordClientId: process.env.DISCORD_CLIENT_ID || '',
  discordGuildId: process.env.DISCORD_GUILD_ID || '',
  clobWsUrl: process.env.CLOB_WS_URL || 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  adminApiKey: process.env.ADMIN_API_KEY || 'changeme',

  // Customization
  colors: {
    buy: 0x2ECC71,  // Green
    sell: 0xE74C3C, // Red
    event: 0x0099FF // Blue
  },
  db: {
    host: process.env.POSTGRES_HOST || 'postgres', // Service name in docker-compose
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'adminpassword',
    database: process.env.POSTGRES_DB || 'polymarket'
  },
  polymarket: {
    appUrl: 'https://polymarket.com',
    gammaApiUrl: 'https://gamma-api.polymarket.com'
  },

  // Signal Engine Configuration
  signals: {
    volumeAnomalyThreshold: parseFloat(process.env.SIGNAL_VOLUME_THRESHOLD || '2.0'),
    velocityThreshold: parseFloat(process.env.SIGNAL_VELOCITY_THRESHOLD || '5.0'),
    regionalSurgeMinMarkets: parseInt(process.env.SIGNAL_SURGE_MIN_MARKETS || '3'),
    whaleThreshold: parseFloat(process.env.SIGNAL_WHALE_THRESHOLD || process.env.MIN_AMOUNT_THRESHOLD || '1000'),
    slidingWindowMs: parseInt(process.env.SIGNAL_SLIDING_WINDOW_MS || '60000'),
    volumeWindowMs: parseInt(process.env.SIGNAL_VOLUME_WINDOW_MS || '300000')
  }
};

