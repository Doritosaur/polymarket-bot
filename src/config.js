import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  rpcUrl: process.env.RPC_URL || 'https://polygon-rpc.com',
  rpcWsUrl: process.env.RPC_WS_URL || process.env.RPC_URL?.replace('https://', 'wss://').replace('http://', 'ws://') || null,
  chainId: parseInt(process.env.CHAIN_ID || '137'),
  minAmountThreshold: parseFloat(process.env.MIN_AMOUNT_THRESHOLD || '1000'),
  discordToken: process.env.DISCORD_TOKEN || '',
  discordChannelId: process.env.DISCORD_CHANNEL_ID || '',
  conditionalTokensAddress: process.env.CONDITIONAL_TOKENS_ADDRESS || '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045',
  clobWsUrl: process.env.CLOB_WS_URL || 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379'),
};

