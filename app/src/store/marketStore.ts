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
    image: string;
    endDate: string;

    yesAssetId: string;
    noAssetId: string;
    yesPrice: number;
    noPrice: number;

    history: MarketHistory[];
}

interface MarketState {
    marketMap: Map<string, DisplayMarket>;
    recentTrades: Trade[];
    pinnedIds: Set<string>;
    pinnedTrades: Trade[];
    tradeThreshold: number; // User's min trade size filter (default 1000)

    setSnapshot: (markets: DisplayMarket[]) => void;
    updatePrice: (assetId: string, price: number, timestamp: number) => void;
    addTrade: (trade: Trade) => void;
    togglePin: (conditionId: string) => void;
    setPinnedIds: (conditionIds: string[]) => void;
    syncPin: (conditionId: string, isPinned: boolean) => void;
    setTradeThreshold: (threshold: number) => void;

    assetIdMap: Map<string, string>; // assetId -> conditionId
}

export const useMarketStore = create<MarketState>((set) => ({
    marketMap: new Map(),
    recentTrades: [],
    pinnedIds: new Set<string>(),
    pinnedTrades: [],
    tradeThreshold: 1000, // Default $1000 threshold

    assetIdMap: new Map<string, string>(),

    setSnapshot: (markets) => set((state) => {
        const newMap = new Map(state.marketMap);
        const newAssetIdMap = new Map(state.assetIdMap);

        markets.forEach(m => {
            newMap.set(m.conditionId, m);
            if (m.yesAssetId) newAssetIdMap.set(m.yesAssetId, m.conditionId);
            if (m.noAssetId) newAssetIdMap.set(m.noAssetId, m.conditionId);
        });

        return { marketMap: newMap, assetIdMap: newAssetIdMap };
    }),

    updatePrice: (assetId, price, timestamp) => set((state) => {
        // Fast O(1) Lookup
        const conditionId = state.assetIdMap.get(assetId);
        if (!conditionId) return {}; // Not tracking this asset

        // Get market
        const market = state.marketMap.get(conditionId);
        if (!market) return {}; // Should not happen if maps are synced

        // Determine if YES or NO asset (could cache this too, but simple check is fast enough)
        let updated = false;
        let newMarket = market; // Copy on write is handled below by spread if needed

        if (market.yesAssetId === assetId) {
            if (market.yesPrice !== price) {
                newMarket = {
                    ...market,
                    yesPrice: price,
                    history: [...market.history, { time: timestamp, price }]
                };
                if (newMarket.history.length > 50) newMarket.history.shift();
                updated = true;
            }
        } else if (market.noAssetId === assetId) {
            if (market.noPrice !== price) {
                newMarket = { ...market, noPrice: price };
                updated = true;
            }
        }

        if (updated) {
            const newMap = new Map(state.marketMap);
            newMap.set(conditionId, newMarket);
            return { marketMap: newMap };
        }

        return {};
    }),

    addTrade: (trade) => set((state) => {
        const newTrades = [trade, ...state.recentTrades].slice(0, 1000);

        let newPinnedTrades = state.pinnedTrades;
        // Optimization: Match by Title is still heuristic but okay for now.
        // Ideally backend sends conditionId in trade stream.
        const market = Array.from(state.marketMap.values()).find(m => m.question === trade.marketTitle);
        if (market && state.pinnedIds.has(market.conditionId)) {
            newPinnedTrades = [trade, ...state.pinnedTrades].slice(0, 1000);
        }

        return { recentTrades: newTrades, pinnedTrades: newPinnedTrades };
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

}));
