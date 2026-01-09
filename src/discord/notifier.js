import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../config.js';
import { getMarketStats } from '../utils/gammaClient.js';
import { createTradeEmbed } from './formatters.js';

import * as addCmd from './commands/add.js';
import * as removeCmd from './commands/remove.js';
import * as eventCmd from './commands/event.js';
import * as searchCmd from './commands/search.js';
import * as configCmd from './commands/config.js';

let client = null;
let channel = null;

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

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const handler = commandHandlers[interaction.commandName];

      if (handler) {
        try {
          await handler(interaction);
        } catch (error) {
          console.error(`Error executing ${interaction.commandName}:`, error);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: `❌ **Error:** ${error.message}`, ephemeral: true });
          } else {
            await interaction.reply({ content: `❌ **Error:** ${error.message}`, ephemeral: true });
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
  if (!client || !channel) return;

  try {
    const embed = createTradeEmbed(data);
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
