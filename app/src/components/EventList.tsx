import { useRef, useEffect, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, MapPin, TrendingUp, Clock, Globe } from 'lucide-react';
import { useSplitViewStore } from '../store/splitViewStore';
import { useEventGroups, type EventGroup } from '@/hooks';
import { formatMoney } from '../utils/mapHelpers';
import { formatSlug } from '../utils/formatters';
import { EventDetailView } from './EventDetailView';
import { UI_CONFIG } from '@/config';

export function EventList() {
    const {
        hoveredEventId,
        selectedEventId,
        setHovered,
        setSelected,
        pinnedOnlyFilter,
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        togglePinnedOnlyFilter,
        geoLevel,
        geoFilter,
        clearGeoFilter,
    } = useSplitViewStore();

    const parentRef = useRef<HTMLDivElement>(null);

    // State for detail view
    const [detailEvent, setDetailEvent] = useState<EventGroup | null>(null);

    // Use shared hook for event grouping with all filters
    const filteredEvents = useEventGroups({ sortBy });

    // Virtual list setup
    const virtualizer = useVirtualizer({
        count: filteredEvents.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => UI_CONFIG.virtualList.rowHeight,
        overscan: UI_CONFIG.virtualList.overscan,
    });

    // Auto-navigate to detail view when selectedEventId changes from map
    useEffect(() => {
        if (selectedEventId) {
            const event = filteredEvents.find(e =>
                e.markets.some(m => m.conditionId === selectedEventId)
            );
            if (event) {
                setDetailEvent(event);
            }
        }
    }, [selectedEventId, filteredEvents]);

    // Handle event click - navigate to detail view
    const handleEventClick = useCallback((event: EventGroup) => {
        setSelected(event.primaryMarket.conditionId);
        setDetailEvent(event);
    }, [setSelected]);

    // Handle back button
    const handleBack = useCallback(() => {
        setDetailEvent(null);
        setSelected(null);
    }, [setSelected]);

    // Handle hover
    const handleEventHover = useCallback((conditionId: string | null) => {
        setHovered(conditionId);
    }, [setHovered]);

    // Detail View
    if (detailEvent) {
        return <EventDetailView event={detailEvent} onBack={handleBack} />;
    }

    // List View
    return (
        <div className="h-full flex flex-col bg-black font-mono">
            {/* Header */}
            <div className="p-4 border-b border-primary/30 shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
                        Events //
                    </h2>
                    <div className="flex items-center gap-2">
                        {(geoFilter.country || geoFilter.state) && (
                            <button
                                onClick={clearGeoFilter}
                                className="flex items-center gap-1 text-[10px] text-primary/80 border border-primary/30 px-2 py-0.5 hover:border-primary hover:bg-primary/10 transition-colors"
                            >
                                <Globe className="w-3 h-3" />
                                {geoFilter.state || geoFilter.country}
                                <span className="text-destructive ml-1">✕</span>
                            </button>
                        )}
                        <span className="text-[10px] text-primary border border-primary px-2 py-0.5">
                            {filteredEvents.length} {geoLevel === 'world' ? 'EVENTS' : geoLevel.toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50" />
                    <input
                        type="text"
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-black border border-primary/30 text-primary text-sm pl-10 pr-4 py-2 focus:border-primary outline-none placeholder:text-primary/30"
                    />
                </div>

                {/* Filters & Sort */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={togglePinnedOnlyFilter}
                        className={`flex items-center gap-1.5 text-[10px] uppercase px-2 py-1 border transition-colors ${pinnedOnlyFilter
                            ? 'bg-primary text-black border-primary'
                            : 'text-primary/70 border-primary/30 hover:border-primary'
                            }`}
                    >
                        <MapPin className="w-3 h-3" />
                        Pinned
                    </button>

                    <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[10px] text-primary/50 uppercase">Sort:</span>
                        {(['volume', 'recent', 'closingSoon'] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setSortBy(s)}
                                className={`text-[10px] uppercase px-2 py-1 border transition-colors ${sortBy === s
                                    ? 'bg-primary text-black border-primary'
                                    : 'text-primary/70 border-primary/30 hover:border-primary'
                                    }`}
                            >
                                {s === 'volume' && <TrendingUp className="w-3 h-3 inline mr-1" />}
                                {s === 'closingSoon' && <Clock className="w-3 h-3 inline mr-1" />}
                                {s === 'volume' ? 'Vol' : s === 'closingSoon' ? 'Ends' : 'New'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Virtual List */}
            <div ref={parentRef} className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-black">
                {filteredEvents.length === 0 ? (
                    <div className="text-center text-primary/50 py-10 text-xs">
                        &gt; NO_EVENTS_FOUND...
                    </div>
                ) : (
                    <div
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {virtualizer.getVirtualItems().map((virtualRow) => {
                            const event = filteredEvents[virtualRow.index];
                            const isHovered = event.markets.some(m => m.conditionId === hoveredEventId);
                            const isSelected = event.markets.some(m => m.conditionId === selectedEventId);
                            const primaryMarket = event.primaryMarket;
                            return (
                                <div
                                    key={event.id}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <button
                                        onClick={() => handleEventClick(event)}
                                        onMouseEnter={() => handleEventHover(primaryMarket.conditionId)}
                                        onMouseLeave={() => handleEventHover(null)}
                                        className={`w-full h-full px-4 py-3 border-b border-primary/10 text-left transition-colors ${isSelected
                                            ? 'bg-primary/20 border-l-2 border-l-primary'
                                            : isHovered
                                                ? 'bg-primary/10'
                                                : 'hover:bg-primary/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={primaryMarket.image}
                                                alt=""
                                                className="w-10 h-10 rounded-sm bg-neutral-800 object-cover shrink-0"
                                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                                            />

                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-primary line-clamp-1 font-medium">
                                                    {formatSlug(primaryMarket.eventSlug || primaryMarket.slug)}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-[10px] text-primary/60">
                                                    <span className="font-bold text-primary">{formatMoney(event.totalVolume)}</span>
                                                    <span className="opacity-50">VOL</span>
                                                    <span className="text-primary/30">|</span>
                                                    <span className="font-bold text-primary">{formatMoney(event.totalLiquidity)}</span>
                                                    <span className="opacity-50">LIQ</span>
                                                    {event.markets.length > 1 && (
                                                        <>
                                                            <span className="text-primary/30">|</span>
                                                            <span className="text-primary/70">{event.markets.length} mkts</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
