import { marketRegistry } from '../../database/marketRegistry.js';
import { clobListener } from '../../clob/clobListener.js';
import { safeFloat } from '../../utils/number.js';

export const name = '!setevent';
export const description = 'Set threshold for all markets in an event';

export async function execute(message, args) {
    if (args.length < 2) return message.reply('❌ Usage: `!setevent <slug_fragment> <amount>`');
    const slugPart = args[0];
    const amount = safeFloat(args[1], -1);

    if (amount < 0) return message.reply('❌ Invalid amount.');

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
    clobListener.updateEventThreshold(eventSlugToUse, amount);

    await message.reply(`✅ **Updated!** Threshold for Event \`${eventSlugToUse}\` (${updatedCount} markets) set to **$${amount}**.`);
}
