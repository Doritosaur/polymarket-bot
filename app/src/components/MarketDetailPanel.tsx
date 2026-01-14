import { Pin, PinOff, ExternalLink, TrendingUp, TrendingDown, X } from 'lucide-react';
import { useMarketStore } from '../store/marketStore';
import { useAuthStore } from '../store/authStore';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MarketDetailPanelProps {
    open: boolean;
    onClose: () => void;
    eventData: any | null; // The clicked market/event data
}

export function MarketDetailPanel({ open, onClose, eventData }: MarketDetailPanelProps) {
    const { togglePin, pinnedIds } = useMarketStore();
    const { user } = useAuthStore();
    const socket = useAuthStore(state => state.socket);

    if (!eventData) return null;

    const markets = eventData.groupMarkets || [eventData];
    const eventSlug = eventData.eventSlug || eventData.slug;
    const isEventPinned = markets.some((m: any) => pinnedIds.has(m.conditionId));

    const handlePinToggle = (conditionId: string) => {
        togglePin(conditionId);
        if (socket && user) {
            socket.emit('toggle_pin', { userId: user.id, conditionId });
        }
    };

    const handlePinAll = () => {
        markets.forEach((m: any) => {
            if (!pinnedIds.has(m.conditionId)) {
                handlePinToggle(m.conditionId);
            }
        });
    };

    const handleUnpinAll = () => {
        markets.forEach((m: any) => {
            if (pinnedIds.has(m.conditionId)) {
                handlePinToggle(m.conditionId);
            }
        });
    };

    return (
        <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <SheetContent
                side="right"
                showCloseButton={false}
                className="w-[400px] sm:w-[450px] bg-black border-l-2 border-primary p-0 font-mono overflow-hidden"
            >
                {/* Header */}
                <SheetHeader className="p-4 border-b border-primary/30 bg-primary/10">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="text-primary text-sm font-bold uppercase tracking-wider">
                            Event_Details //
                        </SheetTitle>
                        <div className="flex items-center gap-2">
                            {isEventPinned ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleUnpinAll}
                                    className="h-6 text-[10px] border-destructive text-destructive hover:bg-destructive/20"
                                >
                                    <PinOff className="w-3 h-3 mr-1" />
                                    UNPIN EVENT
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handlePinAll}
                                    className="h-6 text-[10px] border-primary text-primary hover:bg-primary/20"
                                >
                                    <Pin className="w-3 h-3 mr-1" />
                                    PIN EVENT
                                </Button>
                            )}

                            {/* Custom Close Button */}
                            <button
                                onClick={onClose}
                                className="w-6 h-6 flex items-center justify-center border border-primary/50 text-primary/50 hover:border-primary hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Close"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    </div>

                    {/* Event Title */}
                    <div className="mt-3">
                        <h2 className="text-lg font-bold text-primary/70 leading-tight">
                            {eventSlug}
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px] border-primary/50 text-primary/70">
                                {markets.length} MARKET{markets.length > 1 ? 'S' : ''}
                            </Badge>
                            {eventData.tags?.slice(0, 3).map((tag: string) => (
                                <Badge
                                    key={tag}
                                    variant="outline"
                                    className="text-[10px] border-primary/30 text-primary/50"
                                >
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </SheetHeader>

                {/* Markets List - Dense Layout */}
                <div className="flex-1 overflow-y-auto max-h-[calc(100vh-180px)] p-2 space-y-1">
                    {markets.map((market: any) => {
                        const isPinned = pinnedIds.has(market.conditionId);
                        const yesP = (market.yesPrice * 100).toFixed(0);
                        const noP = (market.noPrice * 100).toFixed(0);
                        const isUp = market.yesPrice > 0.5;

                        return (
                            <div
                                key={market.conditionId}
                                className={`
                                    px-2 py-2 border transition-all
                                    ${isPinned
                                        ? 'border-primary/50 bg-primary/5'
                                        : 'border-primary/20 bg-black hover:border-primary/40'
                                    }
                                `}
                            >
                                {/* Row 1: Image + Slug */}
                                <div className="flex items-center gap-2">
                                    <img
                                        src={market.image}
                                        alt=""
                                        className="w-5 h-5 rounded-sm bg-neutral-800 object-cover flex-shrink-0"
                                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                                    />
                                    <span className="text-[12px] text-primary/70 line-clamp-2 leading-tight flex-1">
                                        {market.slug}
                                    </span>
                                </div>

                                {/* Row 2: Prices + Icons */}
                                <div className="flex items-center gap-3 mt-1.5 pl-7">
                                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold leading-none">
                                        <span className="text-primary">Y:{yesP}%</span>
                                        <span className="text-primary/30">|</span>
                                        <span className="text-destructive">N:{noP}%</span>
                                    </div>

                                    {isUp ? (
                                        <TrendingUp className="w-3 h-3 text-primary" />
                                    ) : (
                                        <TrendingDown className="w-3 h-3 text-destructive" />
                                    )}

                                    <div className="flex-1" />

                                    <a
                                        href={`https://polymarket.com/event/${market.eventSlug || market.slug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary/30 hover:text-primary transition-colors text-[10px] flex items-center gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </SheetContent>
        </Sheet>
    );
}
