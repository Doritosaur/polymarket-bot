import { create } from 'zustand';
import type { GeoLevel } from '../utils/GeoMapper';

export interface MapBounds {
    west: number;
    south: number;
    east: number;
    north: number;
}

export interface GeoFilter {
    country?: string;
    state?: string;
    zone?: string;
}

// Helper to compute geo level from zoom
export function getGeoLevelFromZoom(zoom: number): GeoLevel {
    if (zoom < 4) return 'world';
    if (zoom < 7) return 'country';
    if (zoom < 10) return 'state';
    return 'city';
}

interface SplitViewState {
    // Bidirectional sync state
    hoveredEventId: string | null;
    selectedEventId: string | null;

    // Map viewport
    mapBounds: MapBounds | null;
    visibleEventIds: string[];
    zoom: number;

    // Geographic hierarchy
    geoLevel: GeoLevel;
    geoFilter: GeoFilter;

    // Filters
    filterToVisibleArea: boolean;
    pinnedOnlyFilter: boolean;
    searchQuery: string;
    sortBy: 'recent' | 'volume' | 'closingSoon';
    statusFilter: 'all' | 'active' | 'resolved';

    // Actions
    setHovered: (id: string | null) => void;
    setSelected: (id: string | null) => void;
    setMapBounds: (bounds: MapBounds | null) => void;
    setVisibleEventIds: (ids: string[]) => void;
    setZoom: (zoom: number) => void;
    setGeoLevel: (level: GeoLevel) => void;
    setGeoFilter: (filter: GeoFilter) => void;
    clearGeoFilter: () => void;
    togglePinnedOnlyFilter: () => void;
    setSearchQuery: (query: string) => void;
    setSortBy: (sort: 'recent' | 'volume' | 'closingSoon') => void;
    setStatusFilter: (status: 'all' | 'active' | 'resolved') => void;
}

export const useSplitViewStore = create<SplitViewState>((set) => ({
    // Initial state
    hoveredEventId: null,
    selectedEventId: null,
    mapBounds: null,
    visibleEventIds: [],
    zoom: 2,
    geoLevel: 'world',
    geoFilter: {},
    filterToVisibleArea: true,  // Always filter to visible map events
    pinnedOnlyFilter: false,     // Show pinned only when enabled
    searchQuery: '',
    sortBy: 'volume',
    statusFilter: 'all',

    // Actions
    setHovered: (id) => set({ hoveredEventId: id }),
    setSelected: (id) => set({ selectedEventId: id }),
    setMapBounds: (bounds) => set({ mapBounds: bounds }),
    setVisibleEventIds: (ids) => set({ visibleEventIds: ids }),
    setZoom: (zoom) => set({ zoom, geoLevel: getGeoLevelFromZoom(zoom) }),
    setGeoLevel: (level) => set({ geoLevel: level }),
    setGeoFilter: (filter) => set((s) => ({ geoFilter: { ...s.geoFilter, ...filter } })),
    clearGeoFilter: () => set({ geoFilter: {} }),
    togglePinnedOnlyFilter: () => set((s) => ({ pinnedOnlyFilter: !s.pinnedOnlyFilter })),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSortBy: (sort) => set({ sortBy: sort }),
    setStatusFilter: (status) => set({ statusFilter: status }),
}));
