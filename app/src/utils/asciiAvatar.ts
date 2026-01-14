export function generateAsciiAvatar(username: string): string {
    if (!username) return '';

    // Simple hash function to seed the generator
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        const char = username.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Characters to use for the avatar
    const chars = ['#', '/', '\\', '|', '-', '+', '=', ':', '.', ' '];

    // Deterministic random using hash
    const random = () => {
        const x = Math.sin(hash++) * 10000;
        return x - Math.floor(x);
    };

    // Generate 3x4 grid
    const rows = 4;
    const cols = 3;
    let art = '';

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const index = Math.floor(random() * chars.length);
            art += chars[index];
        }
        if (i < rows - 1) art += '\n';
    }

    return art;
}
