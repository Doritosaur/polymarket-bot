import { useMarketStore, type Trade } from "../store/marketStore";
import { Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PinnedFeed() {
    const pinnedTrades = useMarketStore(state => state.pinnedTrades);

    return (
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
                    {pinnedTrades.length} TRACKED
                </div>
            </div>

            {/* Scroll container */}
            <div className="flex-1 overflow-y-auto w-full font-mono scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-black">
                {pinnedTrades.length === 0 ? (
                    <div className="text-center text-primary/50 py-10 text-xs blink-cursor">
                        &gt; AWAITING_PINNED_TARGETS...
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {pinnedTrades.map((trade: Trade) => (
                            <div
                                key={trade.id}
                                className="px-4 py-3 border-b border-primary/20 hover:bg-primary/5 transition-colors group"
                            >
                                <div className="relative pl-4 border-l-2 border-primary/30 group-hover:border-primary transition-colors">
                                    <div className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full ${trade.price > 0.5 ? 'bg-primary' : 'bg-destructive'}`} />

                                    {/* Row 1: Badge + Time */}
                                    <div className="flex items-center justify-between mb-1">
                                        <Badge
                                            variant="secondary"
                                            className={`text-[10px] px-1.5 h-5 rounded-none border border-current ${trade.outcome === "YES"
                                                ? "bg-primary/10 text-primary border-primary"
                                                : "bg-destructive/10 text-destructive border-destructive"
                                                }`}
                                        >
                                            {trade.side} {trade.outcome}
                                        </Badge>
                                        <span className="text-[10px] text-primary/50">
                                            {new Date(trade.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>

                                    {/* Row 2: Market Title */}
                                    <p
                                        className="text-xs font-medium text-primary/80 line-clamp-2 h-8 leading-4 mb-2 group-hover:text-primary transition-colors"
                                        title={trade.marketTitle}
                                    >
                                        {trade.marketTitle}
                                    </p>

                                    {/* Row 3: Price + Value */}
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1">
                                            <span className="text-primary/50">Price:</span>
                                            <span
                                                className={`${trade.price > 0.5
                                                    ? "text-primary"
                                                    : "text-destructive"
                                                    }`}
                                            >
                                                {(trade.price * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 font-bold">
                                            <span className="text-primary/50">Value:</span>
                                            <span className="text-primary">
                                                ${trade.size.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
