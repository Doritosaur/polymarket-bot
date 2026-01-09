import { SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.js';
import { extractSlug } from '../../utils/formatting.js';
import { marketRegistry } from '../../database/marketRegistry.js';

export const data = new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a market by slug or URL')
    .addStringOption(option =>
        option.setName('slug')
            .setDescription('The market slug or URL')
            .setRequired(true));

export async function execute(interaction) {
    const input = interaction.options.getString('slug').trim();
    const slug = extractSlug(input);

    await interaction.deferReply();
    await interaction.editReply(`⏳ Adding market: \`${slug}\`...`);

    try {
        const response = await fetch(`http://localhost:${config.port}/api/events/${slug}`, {
            method: 'POST',
            headers: { 'x-api-key': config.adminApiKey }
        });
        const data = await response.json();

        if (response.ok && data.success) {
            // Subscribe this channel to the market
            await marketRegistry.subscribe(interaction.guildId, interaction.channelId, 'market', slug);

            await interaction.editReply(`✅ **Success!** Added and watching \`${slug}\` in this channel.`);
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    } catch (error) {
        await interaction.editReply(`❌ **Error:** ${error.message}`);
    }
}
