import { useState } from "react";
import { useMarketStore } from "../store/marketStore";
import { Badge } from "@/components/ui/badge";
import { Rss, Bell, Settings, X } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export function WhaleFeedPopover() {
    const trades = useMarketStore((s) => s.recentTrades);
    const threshold = useMarketStore((s) => s.tradeThreshold);
    const setThreshold = useMarketStore((s) => s.setTradeThreshold);
    const [isOpen, setIsOpen] = useState(false);

    // Filter trades by user's threshold (Dollar Value)
    const filteredTrades = trades.filter((t) => (t.size * t.price) >= threshold);
    const unreadCount = filteredTrades.length;

    return (
        <div className="flex items-center gap-2">
            {/* Notification Icon */}
            <button
                className="p-2 text-primary/50 hover:text-primary hover:bg-primary/10 transition relative"
                title="Notifications"
            >
                <Bell className="w-5 h-5" />
            </button>

            {/* Settings Icon */}
            <button
                className="p-2 text-primary/50 hover:text-primary hover:bg-primary/10 transition"
                title="Settings"
            >
                <Settings className="w-5 h-5" />
            </button>

            {/* Whale Feed Icon with Popover */}
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <button
                        className={`p-2 transition relative ${isOpen
                            ? "text-primary bg-primary/10"
                            : "text-primary/50 hover:text-primary hover:bg-primary/10"
                            }`}
                        title="Whale Feed"
                    >
                        <Rss className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-black text-[10px] font-bold flex items-center justify-center animate-pulse">
                                {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                        )}
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="end"
                    sideOffset={8}
                    className="w-80 max-h-[500px] p-0 bg-black border-2 border-primary overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-3 border-b border-primary/30 flex flex-col gap-2 bg-primary/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-primary">
                                <Rss className="w-4 h-4" />
                                <h2 className="text-sm font-bold uppercase tracking-wider font-mono">
                                    Whale_Feed //
                                </h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-[10px] font-mono text-primary border border-primary px-2 py-0.5">
                                    LIVE ({filteredTrades.length})
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-primary/50 hover:text-primary transition"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        {/* Threshold Control */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-primary/50 font-mono">MIN_$:</span>
                            <input
                                type="number"
                                value={threshold}
                                onChange={(e) => setThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-20 bg-black border border-primary/50 text-primary text-xs font-mono px-2 py-1 focus:border-primary focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Scroll container */}
                    <div className="max-h-[380px] overflow-y-auto font-mono scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-black">
                        {filteredTrades.length === 0 ? (
                            <div className="text-center text-primary/50 py-10 text-xs blink-cursor">
                                &gt; SCANNING_FOR_WHALES...
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {filteredTrades.map((trade) => (
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
                                                        ${(trade.size * trade.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
