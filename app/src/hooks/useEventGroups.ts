import { useMemo } from 'react';
import { useMarketStore, type DisplayMarket } from '../store/marketStore';
import { useSplitViewStore } from '../store/splitViewStore';
import { getMarketCoordinates } from '../utils/GeoMapper';
import { isCountryInZone } from '../utils/ZoneMapping';

export interface EventGroup {
    id: string;
    markets: DisplayMarket[];
    primaryMarket: DisplayMarket;
    totalVolume: number;
    totalLiquidity: number;
}

interface UseEventGroupsOptions {
    filterByTags?: boolean;
    filterBySearch?: boolean;
    filterByGeo?: boolean;
    filterByVisible?: boolean;
    sortBy?: 'volume' | 'recent' | 'closingSoon';
    pinnedFirst?: boolean;
}

/**
 * Hook for grouping markets by event and applying filters
 */
export function useEventGroups(options: UseEventGroupsOptions = {}) {
    const {
        filterByTags = true,
        filterBySearch = true,
        filterByGeo = true,
        filterByVisible = true,
        sortBy = 'volume',
        pinnedFirst = true,
    } = options;

    const { marketMap, selectedTags, pinnedIds } = useMarketStore();
    const {
        searchQuery,
        geoFilter,
        filterToVisibleArea,
        visibleEventIds,
        pinnedOnlyFilter,
    } = useSplitViewStore();

    const eventGroups = useMemo(() => {
        const events = new Map<string, DisplayMarket[]>();

        marketMap.forEach(m => {
            // Tag filter
            if (filterByTags && selectedTags.size > 0) {
                const hasTag = m.tags?.some(tag => selectedTags.has(tag));
                if (!hasTag) return;
            }

            // Search filter
            if (filterBySearch && searchQuery) {
                const query = searchQuery.toLowerCase();
                const matches =
                    m.question.toLowerCase().includes(query) ||
                    m.slug.toLowerCase().includes(query) ||
                    (m.eventSlug?.toLowerCase().includes(query) ?? false);
                if (!matches) return;
            }

            // Geo filter
            if (filterByGeo && (geoFilter.country || geoFilter.state || geoFilter.zone)) {
                const coords = getMarketCoordinates(m.question + " " + m.slug, m.tags);
                if (geoFilter.country && coords.country !== geoFilter.country) return;
                if (geoFilter.state && coords.state !== geoFilter.state) return;
                if (geoFilter.zone && (!coords.country || !isCountryInZone(coords.country, geoFilter.zone))) return;
            }

            const key = m.eventSlug || m.conditionId;
            if (!events.has(key)) events.set(key, []);
            events.get(key)!.push(m);
        });

        let eventList: EventGroup[] = Array.from(events.entries()).map(([key, markets]) => ({
            id: key,
            markets,
            primaryMarket: markets[0],
            totalVolume: markets.reduce((sum, m) => sum + (parseFloat(String(m.volume)) || 0), 0),
            totalLiquidity: markets.reduce((sum, m) => sum + (parseFloat(String(m.liquidity)) || 0), 0),
        }));

        // Filter to visible area if enabled
        if (filterByVisible && filterToVisibleArea && visibleEventIds.length > 0) {
            const visibleSet = new Set(visibleEventIds);
            eventList = eventList.filter(e =>
                e.markets.some(m => visibleSet.has(m.conditionId))
            );
        }

        // Filter to pinned only if enabled
        if (pinnedOnlyFilter) {
            eventList = eventList.filter(e =>
                e.markets.some(m => pinnedIds.has(m.conditionId))
            );
        }

        // Sort
        switch (sortBy) {
            case 'volume':
                eventList.sort((a, b) => b.totalVolume - a.totalVolume);
                break;
            case 'recent':
                eventList.sort((a, b) => {
                    const aTime = a.primaryMarket.lastTradeTime || 0;
                    const bTime = b.primaryMarket.lastTradeTime || 0;
                    return bTime - aTime;
                });
                break;
            case 'closingSoon':
                eventList.sort((a, b) => {
                    const aEnd = new Date(a.primaryMarket.endDate).getTime();
                    const bEnd = new Date(b.primaryMarket.endDate).getTime();
                    return aEnd - bEnd;
                });
                break;
        }

        // Pinned first (when not in pinned-only mode)
        if (pinnedFirst && !pinnedOnlyFilter) {
            eventList.sort((a, b) => {
                const aIsPinned = a.markets.some(m => pinnedIds.has(m.conditionId));
                const bIsPinned = b.markets.some(m => pinnedIds.has(m.conditionId));
                if (aIsPinned && !bIsPinned) return -1;
                if (!aIsPinned && bIsPinned) return 1;
                return 0;
            });
        }

        return eventList;
    }, [
        marketMap, selectedTags, searchQuery, geoFilter,
        filterToVisibleArea, visibleEventIds, pinnedIds, pinnedOnlyFilter,
        filterByTags, filterBySearch, filterByGeo, filterByVisible,
        sortBy, pinnedFirst
    ]);

    return eventGroups;
}

/**
 * Hook for getting pinned event groups only
 */
export function usePinnedEventGroups() {
    const { marketMap, pinnedIds } = useMarketStore();

    return useMemo(() => {
        const eventGroups = new Map<string, DisplayMarket[]>();

        pinnedIds.forEach(conditionId => {
            const market = marketMap.get(conditionId);
            if (market) {
                const key = market.eventSlug || market.conditionId;
                if (!eventGroups.has(key)) eventGroups.set(key, []);
                eventGroups.get(key)!.push(market);
            }
        });

        return Array.from(eventGroups.entries()).map(([key, markets]) => ({
            id: key,
            markets,
            primaryMarket: markets[0],
            totalVolume: markets.reduce((sum, m) => sum + (parseFloat(String(m.volume)) || 0), 0),
            totalLiquidity: markets.reduce((sum, m) => sum + (parseFloat(String(m.liquidity)) || 0), 0),
        })) as EventGroup[];
    }, [marketMap, pinnedIds]);
}
