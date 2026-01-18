export function formatSlug(slug: string): string {
    if (!slug) return '';
    return slug
        .split(/[-_]+/) // Split by one or more dashes or underscores
        .filter(Boolean) // Remove empty strings
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter, lower others (optional but good for 'DEMOCRATIC' -> 'Democratic')
        .join(' ');
}
