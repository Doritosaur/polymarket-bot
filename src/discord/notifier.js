import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { marketRegistry } from '../database/marketRegistry.js';
import { clobListener } from '../clob/clobListener.js';

let client = null;
let channel = null;

const COMMANDS = {
  '!add': async (message, args) => {
    const slug = args.join(' ').trim();
    if (!slug) return message.reply('❌ Please provide a market slug. Usage: `!add <slug>`');

    await message.reply(`⏳ Adding market: \`${slug}\`...`);
    const response = await fetch(`http://localhost:${config.port}/api/events/${slug}`, {
      method: 'POST',
      headers: { 'x-api-key': config.adminApiKey }
    });
    const data = await response.json();

    if (response.ok && data.success) {
      await message.reply(`✅ **Success!** Added ${data.addedCount} market(s).`);
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  },

  '!remove': async (message, args) => {
    const slug = args.join(' ').trim();
    if (!slug) return message.reply('❌ Please provide a market slug. Usage: `!remove <slug>`');

    await message.reply(`⏳ Removing market(s) for: \`${slug}\`...`);
    const response = await fetch(`http://localhost:${config.port}/api/events/${slug}`, {
      method: 'DELETE',
      headers: { 'x-api-key': config.adminApiKey }
    });
    const data = await response.json();

    if (response.ok && data.success) {
      await message.reply(`🗑️ **Success!** Removed ${data.removedCount} market(s).`);
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  },

  '!setthreshold': async (message, args) => {
    if (args.length < 1) return message.reply('❌ Usage: `!setthreshold <amount>`');
    const amount = parseFloat(args[0]);
    if (isNaN(amount) || amount < 0) return message.reply('❌ Invalid amount. Positive number required.');

    marketRegistry.setSetting('minAmountThreshold', amount);
    clobListener.setThreshold(amount);

    await message.reply(`✅ **Updated Default!** New markets will default to **$${amount}**. (Existing markets unchanged)`);
  },

  '!setmarket': async (message, args) => {
    if (args.length < 2) return message.reply('❌ Usage: `!setmarket <slug_fragment> <amount>`');
    const slugPart = args[0];
    const amount = parseFloat(args[1]);

    if (isNaN(amount) || amount < 0) return message.reply('❌ Invalid amount.');

    const market = marketRegistry.findMarketBySlugPartial(slugPart);
    if (!market) return message.reply(`❌ No active market found matching "${slugPart}"`);

    marketRegistry.setMarketThreshold(market.condition_id, amount);
    await clobListener.restart();

    await message.reply(`✅ **Updated!** Threshold for \`${market.slug}\` set to **$${amount}**.`);
  }
};

export async function initializeDiscord() {
  if (!config.discordToken || !config.discordChannelId) {
    console.warn('Discord token/channel not configured. Notifications disabled.');
    return;
  }

  try {
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

      const handler = COMMANDS[commandName];
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
    const embed = createEmbed(data);
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Failed to send Discord notification:', error.message);
  }
}

function createEmbed(data) {
  let title = `${data.tradeType} Detected`;
  if (data.value) {
    const valueStr = Math.round(parseFloat(data.value)).toLocaleString();
    title = `$${valueStr} ${data.tradeType}`;
  }

  const embed = new EmbedBuilder()
    .setColor(data.tradeType === 'BUY' ? 0x00FF00 : 0xFF0000)
    .setTitle(title)
    .setTimestamp(new Date(data.timestamp));

  if (data.type === 'trade') {
    const marketName = data.marketName || 'Unnamed Market';
    embed.addFields(
      { name: '📊 Market', value: `[${marketName}](https://polymarket.com/market/${marketName})`, inline: false },
      { name: '💰 Details', value: `**Action:** ${data.tradeType} **${data.outcome}** | **Price:** $${data.price} | **Size:** ${parseFloat(data.amount).toLocaleString()}`, inline: false }
    );
    if (data.marketPrices) {
      embed.addFields({ name: '🔮 Current Prices', value: data.marketPrices, inline: false });
    }
  } else if (data.type === 'large_order') {
    const marketName = data.marketName || 'Unnamed Market';
    embed.addFields(
      { name: '📊 Market', value: `[${marketName}](https://polymarket.com/market/${marketName})`, inline: false },
      { name: '💰 Details', value: `**${data.tradeType}** ${data.outcome} | **$${data.price}** | ${parseFloat(data.amount).toLocaleString()}`, inline: false }
    );
  }
  return embed;
}

export async function cleanupDiscord() {
  if (client) {
    await client.destroy();
    client = null;
    channel = null;
  }
}
