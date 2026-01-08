import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../config.js';
import { getMarketStats } from '../utils/gammaClient.js';
import { createTradeEmbed } from './formatters.js';

import * as addCmd from './commands/add.js';
import * as removeCmd from './commands/remove.js';
import * as setThresholdCmd from './commands/setThreshold.js';
import * as setEventCmd from './commands/setEvent.js';
import * as eventCmd from './commands/event.js';

let client = null;
let channel = null;

export const commandHandlers = {
  [addCmd.name]: addCmd.execute,
  [removeCmd.name]: removeCmd.execute,
  [setThresholdCmd.name]: setThresholdCmd.execute,
  [setEventCmd.name]: setEventCmd.execute,
  [eventCmd.name]: eventCmd.execute
};

export async function initializeDiscord() {
  if (!config.discordToken || !config.discordChannelId) {
    console.warn('Discord token/channel not configured. Notifications disabled.');
    return;
  }

  try {
    if (client) {
      console.warn('Discord client already initialized. Skipping initialization.');
      return;
    }

    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    await client.login(config.discordToken);

    client.once('clientReady', () => {
      console.log(`Discord bot logged in as ${client.user.tag}`);
      channel = client.channels.cache.get(config.discordChannelId);
      if (!channel) console.error(`Discord channel ${config.discordChannelId} not found!`);
      else console.log(`Connected to Discord channel: ${channel.name}`);
    });

    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;

      const args = message.content.trim().split(/\s+/);
      const commandName = args.shift();

      const handler = commandHandlers[commandName];
      if (handler) {
        try {
          await handler(message, args);
        } catch (error) {
          console.error(`Error executing ${commandName}:`, error);
          await message.reply(`❌ **Error:** ${error.message}`);
        }
      }
    });

    client.on('error', (error) => {
      console.error('Discord client error:', error);
    });

  } catch (error) {
    console.error('Failed to initialize Discord bot:', error.message);
  }
}

export async function notifyDiscord(data) {
  if (!client || !channel) return;

  try {
    let stats = null;
    if (data.marketName) {
      stats = await getMarketStats(data.marketName);
    }

    const embedData = { ...data, ...stats };
    const embed = createTradeEmbed(embedData);
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Failed to send Discord notification:', error.message);
  }
}

export async function cleanupDiscord() {
  if (client) {
    await client.destroy();
    client = null;
    channel = null;
  }
}
