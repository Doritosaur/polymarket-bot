
import { EmbedBuilder } from 'discord.js';
import { marketRegistry } from '../../database/marketRegistry.js';
import { config } from '../../config.js';
import { getEvent } from '../../utils/gammaClient.js';
import { safeJsonParse, safeFloat } from '../../utils/number.js';
import { formatSlug, formatOutcomePrices } from '../../utils/formatting.js';

export const name = '!search';
export const description = 'Search for markets in the database';

export async function execute(message, args) {
    if (args.length === 0) {
        return message.reply('❌ Please provide a search term. Usage: `!search <query>`');
    }
    const query = args.join(' ');
    const results = marketRegistry.searchMarkets(query, 20);

    if (results.length === 0) {
        return message.reply(`🔍 No active markets found matching: \`${query}\``);
    }

    const loadingMsg = await message.reply(`⏳ Found ${results.length} markets. Fetching live prices...`);
    const grouped = {};
    const eventSlugsToFetch = new Set();

    results.forEach(m => {
        const key = m.event_slug || 'Other';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
        if (m.event_slug) eventSlugsToFetch.add(m.event_slug);
    });

    const slugs = Array.from(eventSlugsToFetch);
    const priceMap = new Map();

    try {
        const eventDataList = await Promise.all(slugs.map(slug => getEvent(slug).catch(e => null)));

        eventDataList.forEach(eventData => {
            if (!eventData || !eventData.markets) return;
            eventData.markets.forEach(m => {
                if (m.outcomePrices) {
                    const prices = safeJsonParse(m.outcomePrices);
                    if (prices && prices.length >= 2) {
                        priceMap.set(m.slug, {
                            yes: safeFloat(prices[0]),
                            no: safeFloat(prices[1])
                        });
                    }
                }
            });
        });
    } catch (err) {
        console.warn('Error fetching prices for search:', err);
    }

    const embed = new EmbedBuilder()
        .setTitle(`🔎 Search Results for: "${query}"`)
        .setColor(config.colors.event || '#2b2d31')
        .setFooter({ text: `Found ${results.length} markets. Use !add <slug> to watch.` });

    let fieldCount = 0;
    const eventKeys = Object.keys(grouped);

    for (const eventSlug of eventKeys) {
        if (fieldCount >= 24) {
            embed.addFields({ name: '...', value: `And more...`, inline: false });
            break;
        }

        const markets = grouped[eventSlug];

        const eventTitle = eventSlug === 'Other'
            ? 'Miscellaneous Markets'
            : `📁 Event: ${formatSlug(eventSlug)}`;

        const marketLines = markets.map(m => {
            const icon = m.watched ? '👀' : '⚪';
            let priceInfo = '';
            const prices = priceMap.get(m.slug);
            if (prices) {
                priceInfo = formatOutcomePrices(prices);
            } else {
                priceInfo = `Prices N/A`;
            }

            return `${icon} ${priceInfo}\n   └ \`${m.slug}\``;
        });

        let valueStr = marketLines.join('\n');
        if (valueStr.length > 1000) {
            valueStr = valueStr.substring(0, 950) + '\n... (more truncated)';
        }

        embed.addFields({ name: eventTitle, value: valueStr, inline: false });
        fieldCount++;
    }

    await loadingMsg.edit({ content: '', embeds: [embed] });
}
