import { marketRegistry } from '../../database/marketRegistry.js';
import { getEvent } from '../../utils/gammaClient.js';
import { createEventEmbed } from '../formatters.js';

export const name = '!event';
export const description = 'Get detailed info and prices for an event';

export async function execute(message, args) {
    if (args.length < 1) return message.reply('❌ Usage: `!event <slug_fragment>`');
    const slugPart = args[0];

    let eventSlugToUse = null;

    // 1. Priority: Direct Exact Event Slug Match
    const eventsExact = marketRegistry.getMarketsByEventSlug(slugPart);
    if (eventsExact && eventsExact.length > 0) {
        eventSlugToUse = eventsExact[0].event_slug;
    } else {
        // 2. Fallback: Infer from Partial Market Slug
        const matchedEvents = marketRegistry.findDistinctEventsByMarketSlugPartial(slugPart);

        if (matchedEvents.length === 0) {
            // Fallback 3: User might be trying to fetch an event we DON'T track yet.
            // We'll allow it, passing the raw slug to Gamma to see if it exists.
            eventSlugToUse = slugPart;
        } else if (matchedEvents.length > 1) {
            const matches = matchedEvents.map(e => `\`${e.event_slug}\``).join(', ');
            return message.reply(`⚠️ **Ambiguous Match:** "${slugPart}" matches markets in multiple events: ${matches}.\nPlease be more specific or use the exact Event Slug.`);
        } else {
            eventSlugToUse = matchedEvents[0].event_slug;
        }
    }

    try {
        const data = await getEvent(eventSlugToUse);
        if (!data) return message.reply(`❌ Event \`${eventSlugToUse}\` not found on Polymarket.`);

        const markets = data.markets || [];
        if (markets.length === 0) return message.reply(`⚠️ Event found but has no markets.`);

        const embed = createEventEmbed(data);
        if (markets.length > 25) {
            embed.setFooter({ text: `Showing top 25 of ${markets.length} markets. | Event: ${data.slug}` });
        }

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error(error);
        message.reply(`❌ Error fetching event: ${error.message}`);
    }
}
