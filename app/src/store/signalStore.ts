/**
 * Signal Store - Zustand store for signal state management
 * Manages active signals, regions, and user filter configurations
 */
import { create } from 'zustand';

// Signal types matching backend
export const SIGNAL_TYPES = {
    VOLUME_ANOMALY: 'volume_anomaly',
    PRICE_VELOCITY: 'price_velocity',
    REGIONAL_SURGE: 'regional_surge',
    WHALE_ACTIVITY: 'whale_activity',
    MARKET_REVERSAL: 'market_reversal'
} as const;

export type SignalType = typeof SIGNAL_TYPES[keyof typeof SIGNAL_TYPES];

// Severity levels
export const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = typeof SEVERITY_LEVELS[number];

// Signal interface
export interface Signal {
    id: string;
    type: SignalType;
    severity: Severity;
    conditionId: string | null;
    region: string;
    coordinates: { lat: number; lng: number } | null;
    value: number;
    metadata: {
        marketTitle?: string;
        price?: number;
        size?: number;
        side?: 'BUY' | 'SELL';
        outcome?: string;
        direction?: 'up' | 'down' | 'stable' | 'bullish' | 'bearish' | 'mixed';
        percentChange?: number;
        volume?: number;
        average?: number;
        activeMarkets?: string[];
        totalVolume?: number;
        sentiment?: number;
        fromDirection?: string;
        toDirection?: string;
    };
    timestamp: number;
}

// Region aggregate state
export interface RegionState {
    id: string;
    name: string;
    coordinates: { lat: number; lng: number };
    activeSignals: Signal[];
    aggregateVolume: number;
    aggregateSentiment: number; // -1 to 1 (bearish to bullish)
    priceVelocity: number;
    lastActivity: number;
}

// Filter configuration
export interface SignalFilters {
    types: Set<SignalType>;
    minSeverity: Severity;
    regions: Set<string>;
}

interface SignalState {
    // Active signals (capped at 100)
    signals: Signal[];

    // Regional aggregates
    regions: Map<string, RegionState>;

    // Filter configuration
    filters: SignalFilters;

    // Animation state: tracks new signals for pulse effects
    newSignals: Set<string>;

    // Actions
    addSignal: (signal: Signal) => void;
    updateRegion: (regionId: string, state: Partial<RegionState>) => void;
    setTypeFilter: (type: SignalType, enabled: boolean) => void;
    setMinSeverity: (severity: Severity) => void;
    setRegionFilter: (region: string, enabled: boolean) => void;
    clearFilters: () => void;
    clearOldSignals: () => void;
    markSignalSeen: (signalId: string) => void;

    // Computed getters
    getFilteredSignals: () => Signal[];
    getSignalsForRegion: (region: string) => Signal[];
}

const MAX_SIGNALS = 100;
const NEW_SIGNAL_DURATION = 5000; // 5 seconds for "new" animation

export const useSignalStore = create<SignalState>((set, get) => ({
    signals: [],
    regions: new Map(),
    newSignals: new Set(),

    // Default filters: show all types, all severities, all regions
    filters: {
        types: new Set(Object.values(SIGNAL_TYPES)),
        minSeverity: 'low',
        regions: new Set()
    },

    addSignal: (signal) => set((state) => {
        // Add to signals array, cap at MAX_SIGNALS
        const newSignals = [signal, ...state.signals].slice(0, MAX_SIGNALS);

        // Mark as new for animation
        const newSignalsSet = new Set(state.newSignals);
        newSignalsSet.add(signal.id);

        // Update region aggregate if applicable
        const newRegions = new Map(state.regions);
        if (signal.region && signal.coordinates) {
            const existing = newRegions.get(signal.region) || {
                id: signal.region,
                name: signal.region,
                coordinates: signal.coordinates,
                activeSignals: [],
                aggregateVolume: 0,
                aggregateSentiment: 0,
                priceVelocity: 0,
                lastActivity: 0
            };

            existing.activeSignals = [signal, ...existing.activeSignals].slice(0, 20);
            existing.lastActivity = signal.timestamp;

            // Update aggregate sentiment based on signal metadata
            if (signal.metadata.sentiment !== undefined) {
                existing.aggregateSentiment = signal.metadata.sentiment;
            }
            if (signal.metadata.totalVolume !== undefined) {
                existing.aggregateVolume = signal.metadata.totalVolume;
            }

            newRegions.set(signal.region, existing);
        }

        // Auto-clear new signal flag after duration
        setTimeout(() => {
            get().markSignalSeen(signal.id);
        }, NEW_SIGNAL_DURATION);

        return {
            signals: newSignals,
            newSignals: newSignalsSet,
            regions: newRegions
        };
    }),

    updateRegion: (regionId, update) => set((state) => {
        const newRegions = new Map(state.regions);
        const existing = newRegions.get(regionId) || {
            id: regionId,
            name: regionId,
            coordinates: { lat: 0, lng: 0 },
            activeSignals: [],
            aggregateVolume: 0,
            aggregateSentiment: 0,
            priceVelocity: 0,
            lastActivity: 0
        };

        newRegions.set(regionId, { ...existing, ...update });
        return { regions: newRegions };
    }),

    setTypeFilter: (type, enabled) => set((state) => {
        const newTypes = new Set(state.filters.types);
        if (enabled) {
            newTypes.add(type);
        } else {
            newTypes.delete(type);
        }
        return { filters: { ...state.filters, types: newTypes } };
    }),

    setMinSeverity: (severity) => set((state) => ({
        filters: { ...state.filters, minSeverity: severity }
    })),

    setRegionFilter: (region, enabled) => set((state) => {
        const newRegions = new Set(state.filters.regions);
        if (enabled) {
            newRegions.add(region);
        } else {
            newRegions.delete(region);
        }
        return { filters: { ...state.filters, regions: newRegions } };
    }),

    clearFilters: () => set(() => ({
        filters: {
            types: new Set(Object.values(SIGNAL_TYPES)),
            minSeverity: 'low',
            regions: new Set()
        }
    })),

    clearOldSignals: () => set((state) => {
        const now = Date.now();
        const cutoff = now - 300000; // 5 minutes

        // Clear old signals
        const filteredSignals = state.signals.filter(s => s.timestamp > cutoff);

        // Clear old region activity
        const newRegions = new Map(state.regions);
        for (const [, region] of newRegions) {
            region.activeSignals = region.activeSignals.filter(s => s.timestamp > cutoff);
        }

        return { signals: filteredSignals, regions: newRegions };
    }),

    markSignalSeen: (signalId) => set((state) => {
        const newSet = new Set(state.newSignals);
        newSet.delete(signalId);
        return { newSignals: newSet };
    }),

    // Computed: get filtered signals based on current filters
    getFilteredSignals: () => {
        const state = get();
        const { types, minSeverity, regions } = state.filters;

        const severityIndex = SEVERITY_LEVELS.indexOf(minSeverity);

        return state.signals.filter(signal => {
            // Type filter
            if (!types.has(signal.type)) return false;

            // Severity filter
            const signalSeverityIndex = SEVERITY_LEVELS.indexOf(signal.severity);
            if (signalSeverityIndex < severityIndex) return false;

            // Region filter (empty = all regions)
            if (regions.size > 0 && !regions.has(signal.region)) return false;

            return true;
        });
    },

    // Get signals for a specific region
    getSignalsForRegion: (region) => {
        const state = get();
        return state.signals.filter(s => s.region === region);
    }
}));
