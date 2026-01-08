import { config } from '../../config.js';

export const name = '!add';
export const description = 'Add a market by slug';

export async function execute(message, args) {
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
}
