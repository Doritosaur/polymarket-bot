import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { marketRegistry } from '../database/marketRegistry.js';
import { clobListener } from '../clob/clobListener.js';
import { getMarketStats } from '../utils/gammaClient.js';

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



  '!setevent': async (message, args) => {
    if (args.length < 2) return message.reply('❌ Usage: `!setevent <slug_fragment> <amount>`');
    const slugPart = args[0];
    const amount = parseFloat(args[1]);

    if (isNaN(amount) || amount < 0) return message.reply('❌ Invalid amount.');

    let eventSlugToUse = null;

    // 1. Priority: Direct Exact Event Slug Match
    const eventsExact = marketRegistry.getMarketsByEventSlug(slugPart);
    if (eventsExact && eventsExact.length > 0) {
      eventSlugToUse = eventsExact[0].event_slug; // It's the event itself
    } else {
      // 2. Fallback: Infer from Partial Market Slug (with Safety Check)
      const matchedEvents = marketRegistry.findDistinctEventsByMarketSlugPartial(slugPart);

      if (matchedEvents.length === 0) {
        return message.reply(`❌ No active market or event found matching "${slugPart}".`);
      } else if (matchedEvents.length > 1) {
        const matches = matchedEvents.map(e => `\`${e.event_slug}\``).join(', ');
        return message.reply(`⚠️ **Ambiguous Match:** "${slugPart}" matches markets in multiple events: ${matches}.\nPlease be more specific or use the exact Event Slug.`);
      } else {
        // Exactly one event matched
        eventSlugToUse = matchedEvents[0].event_slug;
      }
    }

    if (!eventSlugToUse) {
      return message.reply(`❌ Could not resolve event.`);
    }

    const updatedCount = marketRegistry.setEventThreshold(eventSlugToUse, amount);
    await clobListener.restart();

    await message.reply(`✅ **Updated!** Threshold for Event \`${eventSlugToUse}\` (${updatedCount} markets) set to **$${amount}**.`);
  }
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
    let stats = null;
    if (data.marketName) {
      stats = await getMarketStats(data.marketName);
    }

    const embedData = { ...data, ...stats };
    const embed = createEmbed(embedData);
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Failed to send Discord notification:', error.message);
  }
}

function createEmbed(data) {
  const isBuy = data.tradeType === 'BUY';
  const color = isBuy ? 0x2ECC71 : 0xE74C3C;
  let title = `${data.tradeType} Detected`;
  if (data.value) {
    const valueStr = Math.round(parseFloat(data.value)).toLocaleString();
    title = `$${valueStr} ${data.tradeType} -> ${data.outcome}`;
  }

  const marketLink = `https://polymarket.com/market/${data.marketName}`;
  const marketTitle = data.question || data.marketName || 'Unnamed Market';

  let dateStr = 'Unknown';
  if (data.endDate) {
    try {
      const dateDate = new Date(data.endDate);
      dateStr = dateDate.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    } catch (e) { dateStr = data.endDate; }
  }

  const embed = new EmbedBuilder()
    // .setColor(color)
    .setTitle(title)
    .setAuthor({
      name: marketTitle,
      iconURL: data.image || 'https://polymarket.com/favicon.ico',
      url: marketLink
    })
    .setFooter({ text: 'Polymarket Whale Watcher', iconURL: 'https://polymarket.com/images/brand/icon-blue.png' })
    .setTimestamp(new Date(data.timestamp));

  if (data.type === 'trade') {
    const formatCompact = (num) => {
      return new Intl.NumberFormat('en-US', {
        notation: "compact",
        maximumFractionDigits: 1
      }).format(num);
    };

    const priceVal = parseFloat(data.price);
    const priceStr = `$${priceVal.toFixed(2)}`;
    const amountStr = formatCompact(parseFloat(data.amount));
    const valueStr = `$${formatCompact(parseFloat(data.value))}`;

    const rawVol24 = data.volume24hr;
    const rawVolTotal = data.volume;

    const vol24Str = rawVol24 ? `$${formatCompact(parseInt(rawVol24))}` : 'N/A';
    const volTotalStr = rawVolTotal ? `$${formatCompact(parseInt(rawVolTotal))}` : 'N/A';

    const liqStr = data.liquidity ? `$${formatCompact(parseInt(data.liquidity))}` : 'N/A';
    let probStr = `${(priceVal * 100).toFixed(2)}%`;
    if (data.outcomePrices && data.outcomes) {
      try {
        probStr = data.outcomes
          .map((o, i) => `${o}: ${(parseFloat(data.outcomePrices[i]) * 100).toFixed(2)}%`)
          .join(' | ');
      } catch (e) { /* fallback */ }
    }

    embed.addFields(
      { name: 'Outcome', value: `${data.outcome}`, inline: true },
      { name: 'Price', value: `${priceStr}`, inline: true },
      { name: 'Amount', value: `${amountStr}`, inline: true },

      { name: 'Value', value: `${valueStr}`, inline: true },
      { name: 'Ends', value: `${dateStr}`, inline: true },
      { name: '24h Vol', value: `${vol24Str}`, inline: true },

      { name: 'Total Vol', value: `${volTotalStr}`, inline: true },
      { name: 'Liquidity', value: `${liqStr}`, inline: true },

      { name: 'Outcomes', value: `${probStr}`, inline: true }
    );



  } else if (data.type === 'large_order') {
    embed.addFields(
      { name: 'Details', value: `**${data.tradeType}** ${data.outcome} | **$${data.price}** | ${parseFloat(data.amount).toLocaleString()}`, inline: false }
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
