import { safeFloat } from './number.js';

/**
 * Formats a slug into a readable title.
 * e.g. "us-election-2024" -> "Us Election 2024"
 * @param {string} slug 
 * @returns {string}
 */
export function formatSlug(slug) {
    if (!slug) return 'Unknown';
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Formats outcome prices into a short string.
 * e.g. { yes: 0.55, no: 0.45 } -> "Y: 55¢ | N: 45¢"
 * or [0.55, 0.45] -> "Y: 55¢ | N: 45¢"
 * @param {object|Array} prices 
 * @returns {string}
 */
export function formatOutcomePrices(prices) {
    let yes = 0, no = 0;

    if (!prices) return 'Prices N/A';

    if (Array.isArray(prices)) {
        if (prices.length < 2) return 'Prices N/A';
        yes = safeFloat(prices[0]);
        no = safeFloat(prices[1]);
    } else if (typeof prices === 'object') {
        yes = safeFloat(prices.yes);
        no = safeFloat(prices.no);
    } else {
        return 'Prices N/A';
    }

    const yesCents = Math.round(yes * 100);
    const noCents = Math.round(no * 100);
    return `Y: ${yesCents}¢ | N: ${noCents}¢`;
}
