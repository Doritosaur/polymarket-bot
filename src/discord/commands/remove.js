import { SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.js';
import { extractSlug } from '../../utils/formatting.js';
import { marketRegistry } from '../../database/marketRegistry.js';

export const data = new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a market by slug or URL')
    .addStringOption(option =>
        option.setName('slug')
            .setDescription('The market slug or URL')
            .setRequired(true));

export async function execute(interaction) {
    const input = interaction.options.getString('slug').trim();
    const slug = extractSlug(input);

    await interaction.deferReply();

    // Unsubscribe this channel
    const wasSubscribed = marketRegistry.unsubscribe(interaction.guildId, interaction.channelId, 'market', slug);

    // Check if anyone else is still watching
    const stillActive = marketRegistry.hasSubscribers(slug);

    if (stillActive) {
        if (wasSubscribed) {
            await interaction.editReply(`🗑️ **Stopped watching** \`${slug}\` in this channel. (Market remains active in other channels).`);
        } else {
            await interaction.editReply(`⚠️ This channel was not subscribed to \`${slug}\`.`);
        }
        return;
    }

    // If no one is watching, remove it entirely
    await interaction.editReply(`⏳ No remaining subscribers. Removing market \`${slug}\` entirely...`);

    try {
        const response = await fetch(`http://localhost:${config.port}/api/events/${slug}`, {
            method: 'DELETE',
            headers: { 'x-api-key': config.adminApiKey }
        });
        const data = await response.json();

        if (response.ok && data.success) {
            await interaction.editReply(`🗑️ **Success!** Removed ${data.removedCount} market(s) from bot.`);
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    } catch (error) {
        await interaction.editReply(`❌ **Error:** ${error.message}`);
    }
}
