import { Pin, PinOff, ExternalLink, TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/utils/mapHelpers';
import { formatSlug } from '@/utils/formatters';
import { usePinToggle, type EventGroup } from '@/hooks';

interface EventDetailViewProps {
    event: EventGroup;
    onBack: () => void;
}

/**
 * Shared component for displaying event details with markets list
 * Used in EventList drill-down and PinnedFeed
 */
export function EventDetailView({ event, onBack }: EventDetailViewProps) {
    const { toggle, isPinned, pinAll, unpinAll, pinnedIds } = usePinToggle();

    const markets = event.markets;
    const eventSlug = formatSlug(event.primaryMarket.eventSlug || event.primaryMarket.slug);
    const isEventPinned = markets.some(m => pinnedIds.has(m.conditionId));

    const handlePinAll = () => pinAll(markets.map(m => m.conditionId));
    const handleUnpinAll = () => unpinAll(markets.map(m => m.conditionId));

    return (
        <div className="h-full flex flex-col bg-black font-mono animate-in slide-in-from-right duration-300">
            {/* Header with Back Button */}
            <div className="p-4 border-b border-primary/30 bg-primary/10 shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-primary/70 hover:text-primary transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-bold uppercase tracking-wider">Back</span>
                    </button>
                    <div className="flex items-center gap-2">
                        {isEventPinned ? (
                            <button
                                onClick={handleUnpinAll}
                                className="flex items-center gap-1 text-[10px] border border-destructive text-destructive hover:bg-destructive/20 px-2 py-1 transition-colors"
                            >
                                <PinOff className="w-3 h-3" />
                                UNPIN EVENT
                            </button>
                        ) : (
                            <button
                                onClick={handlePinAll}
                                className="flex items-center gap-1 text-[10px] border border-primary text-primary hover:bg-primary/20 px-2 py-1 transition-colors"
                            >
                                <Pin className="w-3 h-3" />
                                PIN EVENT
                            </button>
                        )}
                    </div>
                </div>

                {/* Event Title */}
                <div className="mt-2">
                    <h2 className="text-lg font-bold text-primary leading-tight line-clamp-2">
                        {eventSlug}
                    </h2>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] border-primary/50 text-primary/70">
                            {markets.length} MARKET{markets.length > 1 ? 'S' : ''}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
                            {formatMoney(event.totalVolume)} VOL
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
                            {formatMoney(event.totalLiquidity)} LIQ
                        </Badge>
                        {event.primaryMarket.tags?.slice(0, 3).map((tag: string) => (
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

                {/* External Link */}
                <a
                    href={`https://polymarket.com/event/${eventSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-2 text-[11px] text-primary/60 hover:text-primary transition-colors"
                >
                    <ExternalLink className="w-3 h-3" />
                    View on Polymarket
                </a>
            </div>

            {/* Markets List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-black">
                {markets.map((market) => {
                    const marketIsPinned = isPinned(market.conditionId);
                    const yesP = (market.yesPrice * 100).toFixed(0);
                    const noP = (market.noPrice * 100).toFixed(0);
                    const isUp = market.yesPrice > 0.5;

                    return (
                        <div
                            key={market.conditionId}
                            className={`
                                px-3 py-3 border transition-all
                                ${marketIsPinned
                                    ? 'border-primary/50 bg-primary/5'
                                    : 'border-primary/20 bg-black hover:border-primary/40'
                                }
                            `}
                        >
                            {/* Row 1: Image + Slug */}
                            <div className="flex items-start gap-3">
                                <img
                                    src={market.image}
                                    alt=""
                                    className="w-8 h-8 rounded-sm bg-neutral-800 object-cover flex-shrink-0 mt-0.5"
                                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                                />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[12px] text-primary/80 leading-tight block">
                                        {formatSlug(market.slug)}
                                    </span>
                                    <div className="text-[10px] text-primary/40 mt-1">
                                        {market.question.length > 80
                                            ? market.question.slice(0, 80) + '...'
                                            : market.question
                                        }
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Prices + Actions */}
                            <div className="flex items-center justify-between mt-3 pl-11">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 text-[12px] font-mono font-bold">
                                        <span className="text-primary">YES: {yesP}%</span>
                                        <span className="text-primary/30">|</span>
                                        <span className="text-destructive">NO: {noP}%</span>
                                    </div>
                                    {isUp ? (
                                        <TrendingUp className="w-4 h-4 text-primary" />
                                    ) : (
                                        <TrendingDown className="w-4 h-4 text-destructive" />
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggle(market.conditionId)}
                                        className={`p-1.5 border transition-colors ${marketIsPinned
                                            ? 'border-primary text-primary'
                                            : 'border-primary/30 text-primary/50 hover:border-primary hover:text-primary'
                                            }`}
                                    >
                                        {marketIsPinned ? (
                                            <PinOff className="w-3.5 h-3.5" />
                                        ) : (
                                            <Pin className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                    <a
                                        href={`https://polymarket.com/event/${market.eventSlug || market.slug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 border border-primary/30 text-primary/50 hover:border-primary hover:text-primary transition-colors"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            </div>

                            {/* Volume/Liquidity */}
                            <div className="flex items-center gap-4 mt-2 pl-11 text-[10px] text-primary/50">
                                <span>Vol: <span className="text-primary/70">{formatMoney(market.volume || 0)}</span></span>
                                <span>Liq: <span className="text-primary/70">{formatMoney(market.liquidity || 0)}</span></span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
