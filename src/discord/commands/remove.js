import { config } from '../../config.js';

export const name = '!remove';
export const description = 'Remove a market by slug';

export async function execute(message, args) {
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
}
