import { SlashCommandBuilder } from 'discord.js';
import { marketRegistry } from '../../database/marketRegistry.js';
import { safeFloat, formatUSD } from '../../utils/number.js';
import { extractSlug } from '../../utils/formatting.js';
import { publishEvent, EventType } from '../../utils/broadcast.js';

export const data = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot settings')
    .addSubcommand(subcommand =>
        subcommand
            .setName('threshold')
            .setDescription('Set the global minimum trade amount threshold')
            .addNumberOption(option =>
                option.setName('amount')
                    .setDescription('Minimum amount in USD (e.g., 1000)')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('event')
            .setDescription('Set the minimum trade amount threshold for a specific event')
            .addStringOption(option =>
                option.setName('slug')
                    .setDescription('The event slug or URL')
                    .setRequired(true))
            .addNumberOption(option =>
                option.setName('amount')
                    .setDescription('Minimum amount in USD (e.g., 500)')
                    .setRequired(true)));

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'threshold') {
        const amount = interaction.options.getNumber('amount');

        await marketRegistry.setSetting('minAmountThreshold', amount);
        // Sync with runtime components
        if (global.config) global.config.minAmountThreshold = amount;

        publishEvent(EventType.THRESHOLD_UPDATED, { type: 'global', amount });

        return interaction.reply(`✅ Global minimum trade threshold updated to **${formatUSD(amount)}**.`);
    }

    if (subcommand === 'event') {
        const input = interaction.options.getString('slug');
        const slug = extractSlug(input);
        const amount = interaction.options.getNumber('amount');

        // Note: Logic from setEvent.js
        const changes = await marketRegistry.setEventThreshold(slug, amount);

        // Also update runtime listeners
        publishEvent(EventType.THRESHOLD_UPDATED, { type: 'event', slug, amount });

        if (changes > 0) {
            return interaction.reply(`✅ Updated threshold for event \`${slug}\` to **${formatUSD(amount)}**. Affects ${changes} market(s).`);
        } else {
            return interaction.reply(`⚠️ No active markets found for event \`${slug}\`. Threshold might not be applied until markets are added/active.`);
        }
    }
}
