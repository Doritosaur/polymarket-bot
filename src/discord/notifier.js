import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../config.js';
import { getMarketStats } from '../utils/gammaClient.js';
import { createTradeEmbed } from './formatters.js';
import { marketRegistry } from '../database/marketRegistry.js';

import * as addCmd from './commands/add.js';
import * as removeCmd from './commands/remove.js';
import * as eventCmd from './commands/event.js';
import * as searchCmd from './commands/search.js';
import * as configCmd from './commands/config.js';

let client = null;

let commandHandlers = {};

export async function initializeDiscord() {
  // Initialize command handlers here to avoid circular dependency issues
  // (notifier -> configCmd -> clobListener -> notifier)
  commandHandlers = {
    [addCmd.data.name]: addCmd.execute,
    [removeCmd.data.name]: removeCmd.execute,
    [eventCmd.data.name]: eventCmd.execute,
    [searchCmd.data.name]: searchCmd.execute,
    [configCmd.data.name]: configCmd.execute
  };

  if (!config.discordToken) {
    console.warn('Discord token not configured. Notifications disabled.');
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
    });

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const handler = commandHandlers[interaction.commandName];

      if (handler) {
        try {
          await handler(interaction);
        } catch (error) {
          try {
            console.error(`Error executing ${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp({ content: `❌ **Error:** ${error.message}`, ephemeral: true });
            } else {
              await interaction.reply({ content: `❌ **Error:** ${error.message}`, ephemeral: true });
            }
          } catch (replyError) {
            console.warn(`Failed to send error response for ${interaction.commandName}:`, replyError.message);
          }
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
  if (!client) return;

  try {
    const embed = createTradeEmbed(data);

    // Get all channels subscribed to this market
    const subscribers = await marketRegistry.getSubscribers(data.slug);

    if (subscribers.length === 0) return;

    // Broadcast to all subscribed channels
    const promises = subscribers.map(async (sub) => {
      try {
        const channel = await client.channels.fetch(sub.channel_id);
        if (channel) {
          await channel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.warn(`Failed to send to channel ${sub.channel_id} (Guild: ${sub.guild_id}): ${err.message}`);
        // Optional: If Unknown Channel (10003), could unsubscribe? 
        // For now, log and ignore.
      }
    });

    await Promise.all(promises);

  } catch (error) {
    console.error('Failed to broadcast Discord notification:', error.message);
  }
}

export async function cleanupDiscord() {
  if (client) {
    await client.destroy();
    client = null;
  }
}
