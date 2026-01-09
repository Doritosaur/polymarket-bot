import { SlashCommandBuilder } from 'discord.js';
import { marketRegistry } from '../../database/marketRegistry.js';
import { getEvent } from '../../utils/gammaClient.js';
import { createEventEmbed } from '../formatters.js';
import { extractSlug } from '../../utils/formatting.js';

export const data = new SlashCommandBuilder()
    .setName('event')
    .setDescription('Get detailed info and prices for an event (supports URL)')
    .addStringOption(option =>
        option.setName('slug')
            .setDescription('Event slug, URL, or partial market slug')
            .setRequired(true));

export async function execute(interaction) {
    const input = interaction.options.getString('slug');
    const slugPart = extractSlug(input);
    await interaction.deferReply();

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
            eventSlugToUse = slugPart;
        } else if (matchedEvents.length > 1) {
            const matches = matchedEvents.map(e => `\`${e.event_slug}\``).join(', ');
            return interaction.editReply(`⚠️ **Ambiguous Match:** "${slugPart}" matches markets in multiple events: ${matches}.\nPlease be more specific or use the exact Event Slug.`);
        } else {
            eventSlugToUse = matchedEvents[0].event_slug;
        }
    }

    try {
        const data = await getEvent(eventSlugToUse);
        if (!data) return interaction.editReply(`❌ Event \`${eventSlugToUse}\` not found on Polymarket.`);

        const markets = data.markets || [];
        if (markets.length === 0) return interaction.editReply(`⚠️ Event found but has no markets.`);

        const embed = createEventEmbed(data);
        if (markets.length > 25) {
            embed.setFooter({ text: `Showing top 25 of ${markets.length} markets. | Event: ${data.slug}` });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(error);
        interaction.editReply(`❌ Error fetching event: ${error.message}`);
    }
}
