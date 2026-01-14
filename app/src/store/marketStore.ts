import { create } from 'zustand';

export interface MarketHistory {
    time: number;
    price: number;
}

export interface Trade {
    id: string;
    price: number;
    size: number;
    side: 'BUY' | 'SELL';
    timestamp: number;
    marketTitle: string;
    outcome: string;
    image?: string;
}

export interface DisplayMarket {
    conditionId: string;
    question: string;
    slug: string;
    eventSlug?: string;
    image: string;
    endDate: string;

    yesAssetId: string;
    noAssetId: string;
    yesPrice: number;
    noPrice: number;

    // Visual fidelity stats
    lastTradeTime?: number; // Timestamp of last trade for glow effect
    isNew?: boolean; // True if market was just added

    history: MarketHistory[];
    tags?: string[]; // Category tags from Polymarket API
    volume: number;
    liquidity: number;
}

interface MarketState {
    marketMap: Map<string, DisplayMarket>;
    recentTrades: Trade[];
    pinnedIds: Set<string>;
    pinnedTrades: Trade[];
    tradeThreshold: number; // User's min trade size filter (default 1000)

    // Tag Filter State
    selectedTags: Set<string>;
    toggleTag: (tag: string) => void;
    clearTags: () => void;

    // Animation state: tracks price changes for pulsing effect
    recentlyUpdated: Map<string, { timestamp: number; direction: 'up' | 'down' }>;

    setSnapshot: (markets: DisplayMarket[]) => void;
    updatePrice: (assetId: string, price: number, timestamp: number) => void;
    addTrade: (trade: Trade) => void;
    togglePin: (conditionId: string) => void;
    setPinnedIds: (conditionIds: string[]) => void;
    syncPin: (conditionId: string, isPinned: boolean) => void;
    setTradeThreshold: (threshold: number) => void;
    clearStaleUpdates: () => void;

    assetIdMap: Map<string, string>; // assetId -> conditionId
    isInitialized: boolean;
    structureVersion: number;
}

export const useMarketStore = create<MarketState>((set) => ({
    marketMap: new Map(),
    recentTrades: [],
    pinnedIds: new Set<string>(),
    pinnedTrades: [],
    tradeThreshold: 1000, // Default $1000 threshold

    // Tag Filter State
    selectedTags: new Set<string>(),
    recentlyUpdated: new Map(),

    assetIdMap: new Map<string, string>(),
    isInitialized: false,
    structureVersion: 0,

    setSnapshot: (markets) => set((state) => {
        const newMap = new Map(state.marketMap);
        const newAssetIdMap = new Map(state.assetIdMap);
        const now = Date.now();
        const firstLoad = !state.isInitialized;

        markets.forEach(m => {
            // Check if new
            const existing = newMap.get(m.conditionId);

            // Preserve lastTradeTime
            let lastTradeTime = existing ? existing.lastTradeTime : undefined;

            // If it's a new market AND it's not the first load, trigger glow
            if (!existing && !firstLoad) {
                lastTradeTime = now;
            }

            newMap.set(m.conditionId, {
                ...m,
                lastTradeTime,
                isNew: false
            });
            if (m.yesAssetId) newAssetIdMap.set(m.yesAssetId, m.conditionId);
            if (m.noAssetId) newAssetIdMap.set(m.noAssetId, m.conditionId);
        });

        return {
            marketMap: newMap,
            assetIdMap: newAssetIdMap,
            isInitialized: true,
            structureVersion: state.structureVersion + 1
        };
    }),

    updatePrice: (assetId, price, timestamp) => set((state) => {
        // Fast O(1) Lookup
        const conditionId = state.assetIdMap.get(assetId);
        if (!conditionId) return {}; // Not tracking this asset

        // Get market
        const market = state.marketMap.get(conditionId);
        if (!market) return {}; // Should not happen if maps are synced

        // Determine if YES or NO asset
        let updated = false;
        let newMarket = market;
        let direction: 'up' | 'down' = 'up';

        if (market.yesAssetId === assetId) {
            if (market.yesPrice !== price) {
                direction = price > market.yesPrice ? 'up' : 'down';
                newMarket = {
                    ...market,
                    yesPrice: price,
                    lastTradeTime: timestamp,
                    history: [...market.history, { time: timestamp, price }]
                };
                if (newMarket.history.length > 50) newMarket.history.shift();
                updated = true;
            }
        } else if (market.noAssetId === assetId) {
            if (market.noPrice !== price) {
                direction = price > market.noPrice ? 'up' : 'down';
                newMarket = {
                    ...market,
                    noPrice: price,
                    lastTradeTime: timestamp
                };
                updated = true;
            }
        }

        if (updated) {
            const newMap = new Map(state.marketMap);
            newMap.set(conditionId, newMarket);

            // Track for animation pulse
            const newRecentlyUpdated = new Map(state.recentlyUpdated);
            newRecentlyUpdated.set(conditionId, { timestamp: Date.now(), direction });

            return { marketMap: newMap, recentlyUpdated: newRecentlyUpdated };
        }

        return {};
    }),

    addTrade: (trade) => set((state) => {
        const newTrades = [trade, ...state.recentTrades].slice(0, 1000);

        let newPinnedTrades = state.pinnedTrades;

        // Find market to update lastTradeTime
        const newMap = new Map(state.marketMap);

        // Try to find market by title/slug match
        const market = Array.from(state.marketMap.values()).find(m =>
            m.slug === trade.marketTitle ||
            m.question === trade.marketTitle ||
            m.eventSlug === trade.marketTitle
        );

        if (market) {
            const updatedMarket = {
                ...market,
                lastTradeTime: Date.now()
            };
            newMap.set(market.conditionId, updatedMarket);

            if (state.pinnedIds.has(market.conditionId)) {
                newPinnedTrades = [trade, ...state.pinnedTrades].slice(0, 1000);
            }
        }

        return {
            recentTrades: newTrades,
            pinnedTrades: newPinnedTrades,
            marketMap: newMap
        };
    }),

    togglePin: (conditionId) => set((state) => {
        const newPinned = new Set(state.pinnedIds);
        if (newPinned.has(conditionId)) {
            newPinned.delete(conditionId);
        } else {
            newPinned.add(conditionId);
        }
        return { pinnedIds: newPinned };
    }),

    setPinnedIds: (conditionIds: string[]) => set(() => ({
        pinnedIds: new Set(conditionIds)
    })),

    syncPin: (conditionId: string, isPinned: boolean) => set((state) => {
        const newPinned = new Set(state.pinnedIds);
        if (isPinned) {
            newPinned.add(conditionId);
        } else {
            newPinned.delete(conditionId);
        }
        return { pinnedIds: newPinned };
    }),

    setTradeThreshold: (threshold: number) => set({ tradeThreshold: threshold }),

    toggleTag: (tag: string) => set((state) => {
        const newTags = new Set(state.selectedTags);
        if (newTags.has(tag)) {
            newTags.delete(tag);
        } else {
            newTags.add(tag);
        }
        return { selectedTags: newTags };
    }),

    clearTags: () => set({ selectedTags: new Set() }),

    clearStaleUpdates: () => set((state) => {
        const now = Date.now();

        // 1. Clean Price Updates
        const newUpdates = new Map(state.recentlyUpdated);
        for (const [id, { timestamp }] of newUpdates) {
            if (now - timestamp > 2000) newUpdates.delete(id);
        }

        return {
            recentlyUpdated: newUpdates
        };
    }),

}));
