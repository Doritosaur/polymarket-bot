export const API_BASE_URL = ''; // Relative path
export const SOCKET_URL = '/'; // Relative namespace for Socket.IO

const c = (hex: string, alpha: number = 1) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (alpha === 1) return [r, g, b] as [number, number, number];
    return [r, g, b, Math.round(alpha * 255)] as [number, number, number, number];
};
export const MAP_COLORS = {
    blinkColor: c('#FFE81D', 0.8),
    bullish: c('#00ff7d'),
    bearish: c('#C5003C'),
    bgDark: c('#0A0A0A'),
    borderDark: c('#282828'),
    clusterFill: c('#1E1E1E'),
    clusterText: c('#FFFFFF'),
    pinColor: c('#DC00FF'),

    heatmapRange: [
        c('#0A0A0A', 0),
        c('#320050', 0.15),
        c('#500078', 0.23),
        c('#009696', 0.31),
        c('#00ff7d', 0.39),
    ] as [number, number, number, number][],
};

export const TOOLTIP_THEME = {
    background: 'rgba(23, 23, 23, 0.95)',
    textMain: '#00ff7d',
    textDim: '#A3A3A3',
    textAlert: '#C5003C',
    pinColor: '#DC00FF',
};
