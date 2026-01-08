/**
 * Safely parses a value to a float.
 * @param {string|number} value - The value to parse.
 * @param {number} fallback - The fallback value if parsing fails (default 0).
 * @returns {number} The parsed float or fallback.
 */
export function safeFloat(value, fallback = 0) {
    if (value === null || value === undefined) return fallback;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely parses a JSON string.
 * @param {string|object} value - The value to parse.
 * @returns {object|null} The parsed object or null if failed.
 */
export function safeJsonParse(value) {
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (e) {
        return null;
    }
}

/**
 * Formats a number as USD strings.
 * @param {number} value - The number to format.
 * @param {object} options - Options for Intl.NumberFormat. (compact, fractionDigits)
 * @returns {string} The formatted string (e.g. "$1,000" or "$1.5k").
 */
export function formatUSD(value, options = {}) {
    const val = safeFloat(value);

    // Default options
    const opts = {
        style: 'currency',
        currency: 'USD',
        ...options
    };

    // Handle "compact" notation manually if needed combined with currency, 
    // or rely on Intl support. simpler to just pass options.
    return new Intl.NumberFormat('en-US', opts).format(val);
}

/**
 * Custom compact formatter matching existing bot logic
 */
export function formatCompactUSD(value) {
    const val = safeFloat(value);
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: "compact",
        maximumFractionDigits: 1
    }).format(val);
}
