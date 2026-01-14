// Configuration for the Frontend

// In production (and via Vite proxy), this should be empty strings to use relative paths.
// If running separately without proxy, set to 'http://localhost:3000'
export const API_BASE_URL = ''; // Relative path
export const SOCKET_URL = '/'; // Relative namespace for Socket.IO

// Cyber Theme Map Colors
export const MAP_COLORS = {
    // Cyber Theme Map Colors
    cyberYellow: [255, 232, 29] as [number, number, number], // Yellow Glow
    bullish: [0, 255, 159] as [number, number, number], // Matches --primary/--accent-foreground
    bearish: [197, 0, 60] as [number, number, number], // Matches --destructive (#c5003c)
    bgDark: [10, 10, 10] as [number, number, number],
    borderDark: [40, 40, 40] as [number, number, number],
    clusterFill: [30, 30, 30] as [number, number, number],
    clusterText: [255, 255, 255] as [number, number, number],
    pinned: [220, 0, 255] as [number, number, number], // Magenta for pinned items

    // Heatmap Gradient (low to high intensity)
    heatmapRange: [
        [10, 10, 10, 0],
        [50, 0, 80, 40],
        [80, 0, 120, 60],
        [0, 150, 150, 80],
        [0, 255, 159, 100],
    ] as [number, number, number, number][],
};

// Tooltip CSS Theme
export const TOOLTIP_THEME = {
    background: 'rgba(23, 23, 23, 0.9)',
    border: '#404040',
    textPrimary: '#ffffff',
    textSecondary: '#a3a3a3',
    separator: '#333333',

    // Event Badge
    eventBadgeBg: '#ffffff',
    eventBadgeText: '#404040',

    // YES Outcome
    yesBg: 'rgba(0, 255, 159, 0.1)', // Subtle cyber green bg
    yesBorder: '#00ff7d',
    yesText: '#00ff7d',

    // NO Outcome
    noBg: 'rgba(197, 0, 60, 0.1)', // Subtle destructive red bg
    noBorder: '#c5003c',
    noText: '#c5003c',
    pinned: '#dc00ff', // Magenta
};
