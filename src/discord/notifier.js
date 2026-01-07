import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

let client = null;
let channel = null;

export async function initializeDiscord() {
  if (!config.discordToken) {
    console.warn('Discord token not configured. Notifications will be disabled.');
    return;
  }

  if (!config.discordChannelId) {
    console.warn('Discord channel ID not configured. Notifications will be disabled.');
    return;
  }

  try {
    client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });

    await client.login(config.discordToken);

    client.once('clientReady', () => {
      console.log(`Discord bot logged in as ${client.user.tag}`);
      channel = client.channels.cache.get(config.discordChannelId);

      if (!channel) {
        console.error(`Discord channel ${config.discordChannelId} not found!`);
      } else {
        console.log(`Connected to Discord channel: ${channel.name}`);
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
  if (!client || !channel) {
    console.log('Discord not configured, skipping notification:', data);
    return;
  }

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

    embed
      .addFields(
        { name: '📊 Market', value: `[${marketName}](https://polymarket.com/market/${marketName})`, inline: false },
        { name: '💰 Details', value: `**Action:** ${data.tradeType} **${data.outcome}** | **Price:** $${data.price} | **Size:** ${parseFloat(data.amount).toLocaleString()}`, inline: false }
      );

    if (data.marketPrices) {
      embed.addFields({ name: '🔮 Current Prices', value: data.marketPrices, inline: false });
    }
  } else if (data.type === 'large_order') {
    const marketName = data.marketName || 'Unnamed Market';

    embed
      .addFields(
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

