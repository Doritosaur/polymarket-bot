/**
 * MapLibre GL Layer Configurations
 * Extracted for configurability and reduced code size in MapController
 */
import { MAP_COLORS, buildHeatmapColorExpression, buildSignalHeatmapExpression } from './index';

// ============ LAYER DEFINITIONS ============

export const HEATMAP_LAYER = {
    id: 'heatmap',
    type: 'heatmap' as const,
    source: 'markets',
    maxzoom: 9,
    paint: {
        'heatmap-weight': [
            // Use logVolume for perceptually linear heat distribution
            'interpolate', ['linear'], ['get', 'logVolume'],
            0, 0,
            3, 0.2,     // $1k
            5, 0.5,     // $100k
            6, 0.65,    // $1M
            7, 0.8,     // $10M
            8, 0.9,     // $100M+
            9, 1        // $1B
        ],
        'heatmap-intensity': [
            'interpolate', ['linear'], ['zoom'],
            0, 1.5,
            3, 1.2,
            6, 0.8,
            9, 0.5
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'heatmap-color': buildHeatmapColorExpression() as any,
        'heatmap-radius': [
            'interpolate', ['linear'], ['zoom'],
            0, 40,
            2, 50,
            4, 40,
            6, 30,
            9, 20
        ],
        'heatmap-opacity': [
            'interpolate', ['linear'], ['zoom'],
            0, 0.8,
            4, 0.7,
            9, 0.5
        ]
    }
};

export const CLUSTERS_LAYER = {
    id: 'clusters',
    type: 'circle' as const,
    source: 'markets',
    minzoom: 5,
    filter: ['has', 'point_count'],
    paint: {
        'circle-color': MAP_COLORS.clusterFill,
        'circle-radius': [
            'step', ['get', 'point_count'],
            15,
            10, 20,
            50, 25,
            100, 30
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': MAP_COLORS.clusterStroke,
        'circle-stroke-opacity': 0.5
    }
};

export const CLUSTER_COUNT_LAYER = {
    id: 'cluster-count',
    type: 'symbol' as const,
    source: 'markets',
    minzoom: 5,
    filter: ['has', 'point_count'],
    layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
        'text-allow-overlap': true
    },
    paint: {
        'text-color': MAP_COLORS.clusterText
    }
};

export const UNCLUSTERED_POINT_LAYER = {
    id: 'unclustered-point',
    type: 'circle' as const,
    source: 'markets',
    minzoom: 8,
    filter: ['!', ['has', 'point_count']],
    paint: {
        'circle-color': MAP_COLORS.dotColor,
        'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            8, 15,
            12, 18,
            16, 24
        ],
        'circle-blur': 0.8,
        'circle-opacity': 0.9
    }
};


// ============ TOP MARKETS LAYERS ============

export const TOP_MARKETS_GLOW_LAYER = {
    id: 'top-markets-glow',
    type: 'circle' as const,
    source: 'top_markets',
    paint: {
        'circle-color': MAP_COLORS.topMarketGlow,
        'circle-radius': 15, // Base radius, adjusted dynamically in MapController
        'circle-blur': 0.8,
        'circle-opacity': 0.35
    }
};

export const TOP_MARKETS_CORE_LAYER = {
    id: 'top-markets-core',
    type: 'circle' as const,
    source: 'top_markets',
    paint: {
        'circle-color': MAP_COLORS.topMarketGlow,
        'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            0, 4,
            6, 8,
            12, 12
        ],
        'circle-stroke-width': 0,
        'circle-opacity': 0.85
    }
};

// ============ SIGNAL LAYERS ============

export const SIGNAL_PULSE_LAYER = {
    id: 'signal-pulse',
    type: 'circle' as const,
    source: 'signals',
    paint: {
        'circle-color': [
            'match', ['get', 'type'],
            'whale_activity', MAP_COLORS.signalsPulse.whale,
            'volume_anomaly', MAP_COLORS.signalsPulse.volume,
            'price_velocity', MAP_COLORS.signalsPulse.velocity,
            'regional_surge', MAP_COLORS.signalsPulse.surge,
            'market_reversal', MAP_COLORS.signalsPulse.reversal,
            MAP_COLORS.signalsPulse.whale
        ],
        'circle-radius': [
            'interpolate', ['linear'], ['get', 'severity_num'],
            1, 20,
            4, 40
        ],
        'circle-opacity': [
            'case',
            ['boolean', ['get', 'isNew'], false],
            0.6,
            0.3
        ]
    }
};

export const SIGNAL_MARKERS_LAYER = {
    id: 'signal-markers',
    type: 'circle' as const,
    source: 'signals',
    paint: {
        'circle-color': [
            'match', ['get', 'type'],
            'whale_activity', MAP_COLORS.signals.whale,
            'volume_anomaly', MAP_COLORS.signals.volume,
            'price_velocity', MAP_COLORS.signals.velocity,
            'regional_surge', MAP_COLORS.signals.surge,
            'market_reversal', MAP_COLORS.signals.reversal,
            MAP_COLORS.signals.whale
        ],
        'circle-radius': [
            'interpolate', ['linear'], ['get', 'severity_num'],
            1, 6,
            4, 12
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': [
            'match', ['get', 'severity'],
            'critical', MAP_COLORS.severity.critical,
            'high', MAP_COLORS.severity.high,
            'medium', MAP_COLORS.severity.medium,
            MAP_COLORS.severity.low
        ]
    }
};

export const SIGNAL_LABELS_LAYER = {
    id: 'signal-labels',
    type: 'symbol' as const,
    source: 'signals',
    layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10,
        'text-offset': [0, 1.5],
        'text-anchor': 'top'
    },
    paint: {
        'text-color': MAP_COLORS.labelText,
        'text-halo-color': MAP_COLORS.labelHalo,
        'text-halo-width': 1
    }
};

export const SIGNAL_HEATMAP_LAYER = {
    id: 'signal-heatmap',
    type: 'heatmap' as const,
    source: 'signals',
    maxzoom: 12,
    paint: {
        'heatmap-weight': [
            'interpolate', ['linear'], ['get', 'severity_num'],
            1, 0.2,
            2, 0.4,
            3, 0.7,
            4, 1
        ],
        'heatmap-intensity': [
            'interpolate', ['linear'], ['zoom'],
            0, 0.5,
            6, 1,
            12, 2
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'heatmap-color': buildSignalHeatmapExpression() as any,
        'heatmap-radius': [
            'interpolate', ['linear'], ['zoom'],
            0, 15,
            6, 30,
            12, 50
        ],
        'heatmap-opacity': 0.5
    }
};

// ============ H3 HEXAGON LAYERS ============

export const HEX_FILL_LAYER = {
    id: 'hex-fill',
    type: 'fill' as const,
    source: 'hexes',
    maxzoom: 8, // Fade out at zoom 8
    paint: {
        // Color based on volume - gradient from dark to bright green
        'fill-color': [
            'interpolate', ['linear'], ['get', 'totalVolume'],
            0, 'rgba(0, 50, 30, 0.5)',           // Very low - dark green
            100000, 'rgba(0, 100, 50, 0.6)',     // Low - medium green
            1000000, 'rgba(0, 150, 75, 0.7)',    // Medium - bright green
            10000000, 'rgba(0, 200, 100, 0.8)',  // High - vibrant green
            100000000, 'rgba(0, 255, 125, 0.9)', // Very high - neon green
        ],
        // Opacity fades out as we zoom in
        'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            0, 0.8,
            5, 0.7,
            7, 0.4,
            8, 0
        ]
    }
};

export const HEX_OUTLINE_LAYER = {
    id: 'hex-outline',
    type: 'line' as const,
    source: 'hexes',
    maxzoom: 8,
    paint: {
        'line-color': MAP_COLORS.topMarketGlow,
        'line-width': [
            'interpolate', ['linear'], ['zoom'],
            0, 0.5,
            4, 1,
            7, 0.5
        ],
        'line-opacity': [
            'interpolate', ['linear'], ['zoom'],
            0, 0.6,
            5, 0.5,
            7, 0.2,
            8, 0
        ]
    }
};

export const HEX_LABEL_LAYER = {
    id: 'hex-label',
    type: 'symbol' as const,
    source: 'hexes',
    minzoom: 3,
    maxzoom: 7,
    layout: {
        'text-field': [
            'case',
            ['>=', ['get', 'totalVolume'], 1000000],
            ['concat', ['to-string', ['round', ['/', ['get', 'totalVolume'], 1000000]]], 'M'],
            ['>=', ['get', 'totalVolume'], 1000],
            ['concat', ['to-string', ['round', ['/', ['get', 'totalVolume'], 1000]]], 'K'],
            ''
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10,
        'text-allow-overlap': false,
    },
    paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0, 0, 0, 0.8)',
        'text-halo-width': 1,
        'text-opacity': [
            'interpolate', ['linear'], ['zoom'],
            3, 0.7,
            6, 0.5,
            7, 0
        ]
    }
};

// ============ ALL LAYERS FOR EASY ITERATION ============

export const HEX_LAYERS = [
    HEX_FILL_LAYER,
    HEX_OUTLINE_LAYER,
    HEX_LABEL_LAYER,
];

export const MARKET_LAYERS = [
    HEATMAP_LAYER,
    CLUSTERS_LAYER,
    CLUSTER_COUNT_LAYER,
    UNCLUSTERED_POINT_LAYER,
];

export const TOP_MARKET_LAYERS = [
    TOP_MARKETS_GLOW_LAYER,
    TOP_MARKETS_CORE_LAYER,
];

export const SIGNAL_LAYERS = [
    SIGNAL_PULSE_LAYER,
    SIGNAL_MARKERS_LAYER,
    SIGNAL_LABELS_LAYER,
];

export const TOP_MARKET_LAYER_IDS = ['top-markets-glow', 'top-markets-core'];
export const INTERACTIVE_LAYER_IDS = ['clusters', 'unclustered-point', 'hex-fill'];

