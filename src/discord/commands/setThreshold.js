import { marketRegistry } from '../../database/marketRegistry.js';
import { clobListener } from '../../clob/clobListener.js';
import { safeFloat } from '../../utils/number.js';

export const name = '!setthreshold';
export const description = 'Set the global minimum amount threshold';

export async function execute(message, args) {
    if (args.length < 1) return message.reply('❌ Usage: `!setthreshold <amount>`');
    const amount = safeFloat(args[0], -1);
    if (amount < 0) return message.reply('❌ Invalid amount. Positive number required.');

    marketRegistry.setSetting('minAmountThreshold', amount);
    clobListener.setThreshold(amount);

    await message.reply(`✅ **Updated Default!** New markets will default to **$${amount}**. (Existing markets unchanged)`);
}
