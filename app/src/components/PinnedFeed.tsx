import { useState } from 'react';
import { useMarketStore, type DisplayMarket } from "../store/marketStore";
import { Pin } from "lucide-react";
import { formatMoney } from "@/utils/mapHelpers";
import { MarketDetailPanel } from './MarketDetailPanel';

export function PinnedFeed() {
    const { marketMap, pinnedIds } = useMarketStore();
    const [selectedMarket, setSelectedMarket] = useState<any>(null);

    // Get pinned markets with their data
    const pinnedMarkets: DisplayMarket[] = [];
    pinnedIds.forEach(conditionId => {
        const market = marketMap.get(conditionId);
        if (market) pinnedMarkets.push(market);
    });

    // Group by eventSlug for events with multiple markets
    const eventGroups = new Map<string, DisplayMarket[]>();
    pinnedMarkets.forEach(m => {
        const key = m.eventSlug || m.conditionId;
        if (!eventGroups.has(key)) eventGroups.set(key, []);
        eventGroups.get(key)!.push(m);
    });

    const handleMarketClick = (markets: DisplayMarket[]) => {
        // Create event data structure similar to MapController
        const primaryMarket = markets[0];
        setSelectedMarket({
            ...primaryMarket,
            groupMarkets: markets,
            isPinned: true
        });
    };

    return (
        <>
            <div className="h-full flex flex-col bg-black border-l-2 border-primary">
                {/* Header */}
                <div className="p-4 border-b border-primary/30 flex items-center justify-between sticky top-0 bg-primary/10 z-10 shrink-0">
                    <div className="flex items-center gap-2 text-primary">
                        <Pin className="w-4 h-4" />
                        <h2 className="text-sm font-bold uppercase tracking-wider font-mono">
                            Pinned_Events //
                        </h2>
                    </div>
                    <div className="text-[10px] font-mono text-primary border border-primary px-2 py-0.5">
                        {eventGroups.size} EVENTS
                    </div>
                </div>

                {/* Scroll container */}
                <div className="flex-1 overflow-y-auto w-full font-mono scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-black">
                    {eventGroups.size === 0 ? (
                        <div className="text-center text-primary/50 py-10 text-xs blink-cursor">
                            &gt; AWAITING_PINNED_TARGETS...
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {Array.from(eventGroups.entries()).map(([eventKey, markets]) => {
                                const primaryMarket = markets[0];

                                return (
                                    <button
                                        key={eventKey}
                                        onClick={() => handleMarketClick(markets)}
                                        className="px-3 py-2.5 border-b border-primary/20 hover:bg-primary/5 transition-colors text-left group"
                                    >
                                        <div className="flex items-center gap-2">
                                            {/* Image */}
                                            <img
                                                src={primaryMarket.image}
                                                alt=""
                                                className="w-8 h-8 rounded-sm bg-neutral-800 object-cover flex-shrink-0"
                                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                                            />

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-primary/70 line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                                                    {primaryMarket.eventSlug || primaryMarket.slug}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 text-[10px]">
                                                    <div className="flex items-center gap-2 text-primary/70">
                                                        <span className="font-bold text-primary">{formatMoney(markets.reduce((s, m) => s + (parseFloat(String(m.volume)) || 0), 0))}</span>
                                                        <span className="opacity-50 text-[9px] uppercase">VOL</span>
                                                    </div>
                                                    <span className="text-primary/30">|</span>
                                                    <div className="flex items-center gap-2 text-primary/70">
                                                        <span className="font-bold text-primary">{formatMoney(markets.reduce((s, m) => s + (parseFloat(String(m.liquidity)) || 0), 0))}</span>
                                                        <span className="opacity-50 text-[9px] uppercase">LIQ</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Panel */}
            <MarketDetailPanel
                open={!!selectedMarket}
                onClose={() => setSelectedMarket(null)}
                eventData={selectedMarket}
            />
        </>
    );
}
