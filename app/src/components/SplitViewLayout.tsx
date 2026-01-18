import { useCallback } from 'react';
import { MapController } from './MapController';
import { EventList } from './EventList'; // Keep imports
import { FilterBar } from './FilterBar'; // Changed from TagFilter
import { MarketSearch } from './MarketSearch';
import { ZoneFilter } from './ZoneFilter';
import { useSplitViewStore } from '../store/splitViewStore';

export function SplitViewLayout() {
    const geoLevel = useSplitViewStore(s => s.geoLevel);
    const geoFilter = useSplitViewStore(s => s.geoFilter);
    const clearGeoFilter = useSplitViewStore(s => s.clearGeoFilter);
    const setGeoFilter = useSplitViewStore(s => s.setGeoFilter);

    // FlyTo callback for search/zone selection
    const flyTo = useCallback((lng: number, lat: number, zoom: number, zoneId?: string) => {
        // Dispatch custom event that MapController listens to
        window.dispatchEvent(new CustomEvent('map-flyto', {
            detail: { lng, lat, zoom }
        }));

        // Handle Zone Filtering
        if (zoneId) {
            // Set zone and clear specific country/state filters
            setGeoFilter({ zone: zoneId, country: undefined, state: undefined });
        } else if (zoneId === undefined && zoom < 2) {
            // Global Reset (zoom < 2 check matches global view)
            clearGeoFilter();
        }
    }, [setGeoFilter, clearGeoFilter]);

    return (
        <div className="flex w-full h-full">
            {/* Map Section - Left Side (70%) */}
            <div className="relative flex-1 h-full">
                <MapController />

                {/* Controls - Top Left Overlay on Map */}
                <div className="absolute top-4 left-4 z-30 flex items-center gap-2 pointer-events-auto">
                    {/* Geo Level Indicator */}
                    <div className="bg-black/80 border border-primary/30 px-3 py-1.5 text-xs font-mono flex items-center h-7">
                        <span className="text-primary/70 mr-1">View: </span>
                        <span className="text-primary font-bold uppercase">{geoLevel}</span>
                        {geoFilter.country && (
                            <>
                                <span className="text-primary/50 mx-1">›</span>
                                <span className="text-primary">{geoFilter.country}</span>
                            </>
                        )}
                        {geoFilter.state && (
                            <>
                                <span className="text-primary/50 mx-1">›</span>
                                <span className="text-primary">{geoFilter.state}</span>
                            </>
                        )}
                        {(geoFilter.country || geoFilter.state) && (
                            <button onClick={clearGeoFilter} className="ml-2 text-destructive hover:text-destructive/80">✕</button>
                        )}
                    </div>

                    <MarketSearch onSelectMarket={flyTo} />
                    <ZoneFilter onSelectZone={flyTo} />
                    <FilterBar />
                </div>
            </div>

            {/* Event List Panel - Right Side (30%) */}
            <div className="w-[30%] min-w-[350px] h-full bg-neutral-950 border-l border-primary/20 overflow-hidden">
                <EventList />
            </div>
        </div>
    );
}
