import { useState, useEffect, useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useMarketStore } from "../store/marketStore";
import { useSplitViewStore } from "../store/splitViewStore";
import { useSignalStore, type Signal, SIGNAL_TYPES } from "../store/signalStore";
import { getMarketCoordinates } from "../utils/GeoMapper";
import { isCountryInZone } from "../utils/ZoneMapping";

// @ts-ignore
import ClusterWorker from '../workers/cluster.worker?worker';
// Map click now navigates to EventList instead of opening MarketDetailPanel
import { getTooltipHtml } from '../utils/mapHelpers';

import 'maplibre-gl/dist/maplibre-gl.css';
import {
    HEATMAP_LAYER,
    TOP_MARKETS_GLOW_LAYER,
    TOP_MARKETS_CORE_LAYER,
    SIGNAL_PULSE_LAYER,
    SIGNAL_MARKERS_LAYER,
    SIGNAL_LABELS_LAYER,
    SIGNAL_HEATMAP_LAYER
} from '../config/mapLayers';

// Use local custom dark style for heatmap-optimized rendering
const MAP_STYLE = '/world-map.json';

export function MapController() {
    const marketMap = useMarketStore(s => s.marketMap);
    const pinnedIds = useMarketStore(s => s.pinnedIds);
    const selectedTags = useMarketStore(s => s.selectedTags);
    const structureVersion = useMarketStore(s => s.structureVersion);
    const minVolume = useMarketStore(s => s.minVolume);

    const hoveredEventId = useSplitViewStore(s => s.hoveredEventId);
    const setHovered = useSplitViewStore(s => s.setHovered);
    const setSelected = useSplitViewStore(s => s.setSelected);
    const setMapBounds = useSplitViewStore(s => s.setMapBounds);
    const setZoom = useSplitViewStore(s => s.setZoom);
    const setVisibleEventIds = useSplitViewStore(s => s.setVisibleEventIds);
    const geoFilter = useSplitViewStore(s => s.geoFilter);

    // Map refs
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    // State
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    // Worker refs
    const workerRef = useRef<Worker | null>(null);
    const pendingFlyTo = useRef<[number, number] | null>(null);
    const marketMapRef = useRef(marketMap); // Ref for stable access in event handlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processedMarketsRef = useRef<any[]>([]); // Store processed markets for fast filtering

    // Keep ref in sync with marketMap
    useEffect(() => {
        marketMapRef.current = marketMap;
    }, [marketMap]);

    // Initial Map Setup
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: MAP_STYLE,
            center: [0, 20],
            zoom: 1.5,
            minZoom: 1.5,  // Max zoom out - world view limit
            maxZoom: 19,
            attributionControl: false
        });

        // No controls - keeping map clean. Zoom via scroll/pinch.

        map.on('load', () => {
            setIsMapLoaded(true);

            // Sources
            // Sources
            map.addSource('markets', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
                // Clustering DISABLED here - we use spiral layout from worker
            });



            // 1. Heatmap (Volume-Weighted Activity)
            // 1. Heatmap (Volume-Weighted Activity)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            map.addLayer(HEATMAP_LAYER as any);



            // 4.1 Top Markets (Global Anchors) - Always visible
            map.addSource('top_markets', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });

            // Layer: Top Markets Glow (Spatially distributed top markets)
            // Layer: Top Markets Glow (Spatially distributed top markets)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            map.addLayer(TOP_MARKETS_GLOW_LAYER as any);

            // Layer: Top Markets Core (Solid dot in center)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            map.addLayer(TOP_MARKETS_CORE_LAYER as any);

            // 5. Signal Markers Source & Layer
            map.addSource('signals', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });

            // Signal Pulse Ring (outer glow)
            // Signal Pulse Ring (outer glow)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            map.addLayer(SIGNAL_PULSE_LAYER as any);

            // Signal Core Marker
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            map.addLayer(SIGNAL_MARKERS_LAYER as any);

            // Signal Labels (on hover)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            map.addLayer(SIGNAL_LABELS_LAYER as any);

            // Signal Heatmap Layer (intensity visualization)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            map.addLayer(SIGNAL_HEATMAP_LAYER as any, 'signal-pulse'); // Insert before pulse layer

            // Interactions


            // Helper to clean up any existing tooltip
            const cleanupTooltip = () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mapAny = map as any;
                if (mapAny._currentTooltip) {
                    mapAny._currentTooltip.remove();
                    mapAny._currentTooltip = null;
                }
            };

            // Helper to show tooltip for a market
            const showTooltip = (conditionId: string, lngLat: maplibregl.LngLat, feature: maplibregl.MapGeoJSONFeature) => {
                cleanupTooltip();
                const m = marketMapRef.current.get(conditionId);
                if (!m) return;

                const popup = new maplibregl.Popup({
                    closeButton: false,
                    closeOnClick: true,
                    className: 'market-tooltip'
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const html = getTooltipHtml({ ...feature, properties: { ...feature.properties, ...m } } as any);
                if (html) {
                    popup.setLngLat(lngLat).setHTML(html).addTo(map);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (map as any)._currentTooltip = popup;
                }
            };





            // Top Markets Click Handlers (all 3 layers)
            // Top Markets Click Handlers (all 3 layers)
            // Top Markets Click Handlers (Glow and Core)
            const topMarketLayers = ['top-markets-glow', 'top-markets-core'];

            topMarketLayers.forEach(layerId => {
                map.on('mouseenter', layerId, (e) => {
                    map.getCanvas().style.cursor = 'pointer';
                    if (e.features && e.features.length > 0) {
                        const feature = e.features[0];
                        const conditionId = feature.properties?.conditionId;
                        if (conditionId) {
                            setHovered(conditionId);
                            showTooltip(conditionId, e.lngLat, feature);
                        }
                    }
                });

                map.on('mouseleave', layerId, () => {
                    map.getCanvas().style.cursor = '';
                    setHovered(null);
                    cleanupTooltip();
                });

                map.on('click', layerId, (e) => {
                    const feature = e.features?.[0];
                    if (!feature) return;
                    cleanupTooltip();

                    const conditionId = feature.properties?.conditionId;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const coords = (feature.geometry as any).coordinates;
                    const m = marketMapRef.current.get(conditionId);

                    if (m) {
                        handleMarketClick(m);
                        // Zoom to district level (zoom 8) when clicking top market
                        map.flyTo({
                            center: coords,
                            zoom: 8,
                            essential: true
                        });
                    }
                });
            });



        });

        map.on('moveend', () => {
            const z = map.getZoom();
            setZoom(z);
            const b = map.getBounds();
            setMapBounds({
                west: b.getWest(),
                east: b.getEast(),
                south: b.getSouth(),
                north: b.getNorth()
            });
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Worker Initialization
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const worker = new (ClusterWorker as any)();
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent) => {
            const { type, payload } = e.data;

            if (type === 'MARKETS_UPDATED') {
                // Load ALL points immediately - MapLibre handles viewport filtering AND clustering
                if (mapRef.current && mapRef.current.getSource('markets') && payload.points) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (mapRef.current.getSource('markets') as any).setData({
                        type: 'FeatureCollection',
                        features: payload.points
                    });

                    // Update visible IDs from ALL points (clustering visualization handles the rest)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const visibleIds = payload.points.map((p: any) => p.properties.conditionId);
                    setVisibleEventIds(visibleIds);
                }

                // Update Top Markets (Glow)
                if (mapRef.current && mapRef.current.getSource('top_markets') && payload.topPoints) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (mapRef.current.getSource('top_markets') as any).setData({
                        type: 'FeatureCollection',
                        features: payload.topPoints
                    });
                }
            } else if (type === 'EXPANSION_ZOOM_RESULT') {
                if (pendingFlyTo.current && mapRef.current) {
                    mapRef.current.easeTo({
                        center: pendingFlyTo.current,
                        zoom: payload.zoom,
                        duration: 1000
                    });
                    pendingFlyTo.current = null;
                }
            }
        };

        return () => worker.terminate();
    }, []);

    // Push Data to Worker & Calculate Ranks
    useEffect(() => {
        if (!workerRef.current || !marketMap) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const events = new Map<string, any[]>();

        marketMap.forEach(m => {
            if (minVolume > 0 && (m.volume || 0) < minVolume) return;
            if (selectedTags.size > 0 && !m.tags?.some(tag => selectedTags.has(tag))) return;

            // Apply Geo Filter (Zone/Country/State)
            if (geoFilter.country || geoFilter.state || geoFilter.zone) {
                const coords = getMarketCoordinates(m.question + " " + m.slug, m.tags);
                if (geoFilter.country && coords.country !== geoFilter.country) return;
                if (geoFilter.state && coords.state !== geoFilter.state) return;
                if (geoFilter.zone && (!coords.country || !isCountryInZone(coords.country, geoFilter.zone))) return;
            }

            const key = m.eventSlug || m.conditionId;
            if (!events.has(key)) events.set(key, []);
            events.get(key)!.push(m);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const simplifiedMarkets: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        events.forEach((group: any[]) => {
            const m = group[0];
            const base = getMarketCoordinates(m.question + " " + m.slug, m.tags);
            const totalVolume = group.reduce((sum, market) => sum + (market.volume || 0), 0);
            const totalLiquidity = group.reduce((sum, market) => sum + (market.liquidity || 0), 0);
            simplifiedMarkets.push({
                conditionId: m.conditionId,
                baseCoords: base,
                isEvent: group.length > 1,
                yesPrice: m.yesPrice,
                country: base.country || 'Unknown',
                state: base.state || 'Unknown',
                tags: m.tags || [],
                volume: totalVolume,
                liquidity: totalLiquidity,
                // Init Ranks
                globalRank: 9999,
                countryRank: 9999,
                stateRank: 9999
            });
        });

        // Store for other uses if needed, but filtering is done
        processedMarketsRef.current = simplifiedMarkets;

        // Send to worker - it will calculate H3 hexes and return both points and hexes
        workerRef.current.postMessage({
            id: Date.now(),
            type: 'UPDATE_MARKETS',
            payload: { markets: simplifiedMarkets }
        });


    }, [marketMap, structureVersion, selectedTags, minVolume, isMapLoaded, geoFilter]);

    // Sync Hover & Pin State to Map Styles
    useEffect(() => {
        if (!mapRef.current || !mapRef.current.getLayer('top-markets-glow')) return;

        const map = mapRef.current;
        const hoverId = hoveredEventId || '';

        // Update glow intensity (opacity) for hover/pin
        map.setPaintProperty('top-markets-glow', 'circle-opacity', [
            'case',
            ['any', ['==', ['get', 'conditionId'], hoverId], ['in', ['get', 'conditionId'], ['literal', Array.from(pinnedIds)]]],
            1, // Full brightness when hovered or pinned
            0.9 // Default glow opacity
        ]);
        map.setPaintProperty('top-markets-glow', 'circle-radius', [
            'interpolate', ['linear'], ['zoom'],
            8, ['case', ['any', ['==', ['get', 'conditionId'], hoverId], ['in', ['get', 'conditionId'], ['literal', Array.from(pinnedIds)]]], 18, 15],
            12, ['case', ['any', ['==', ['get', 'conditionId'], hoverId], ['in', ['get', 'conditionId'], ['literal', Array.from(pinnedIds)]]], 22, 18],
            16, ['case', ['any', ['==', ['get', 'conditionId'], hoverId], ['in', ['get', 'conditionId'], ['literal', Array.from(pinnedIds)]]], 28, 24]
        ]);

    }, [hoveredEventId, pinnedIds]);

    // Sync Signals to Map
    const { signals, newSignals } = useSignalStore();

    useEffect(() => {
        if (!mapRef.current || !mapRef.current.getSource('signals')) return;

        const severityToNum = { low: 1, medium: 2, high: 3, critical: 4 };
        const typeLabels: Record<string, string> = {
            [SIGNAL_TYPES.WHALE_ACTIVITY]: '🐋 Whale',
            [SIGNAL_TYPES.VOLUME_ANOMALY]: '📈 Volume',
            [SIGNAL_TYPES.PRICE_VELOCITY]: '⚡ Velocity',
            [SIGNAL_TYPES.REGIONAL_SURGE]: '🌍 Surge',
            [SIGNAL_TYPES.MARKET_REVERSAL]: '🔄 Reversal'
        };

        // Convert signals to GeoJSON features
        const features = signals
            .filter((s: Signal) => s.coordinates?.lat && s.coordinates?.lng)
            .map((s: Signal) => ({
                type: 'Feature' as const,
                geometry: {
                    type: 'Point' as const,
                    coordinates: [s.coordinates!.lng, s.coordinates!.lat]
                },
                properties: {
                    id: s.id,
                    type: s.type,
                    severity: s.severity,
                    severity_num: severityToNum[s.severity] || 1,
                    label: typeLabels[s.type] || s.type,
                    isNew: newSignals.has(s.id),
                    timestamp: s.timestamp
                }
            }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapRef.current.getSource('signals') as any).setData({
            type: 'FeatureCollection',
            features
        });
    }, [signals, newSignals]);

    // Handle Market Click - Navigate to event in EventList
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMarketClick = (marketData: any) => {
        // Set selected ID - EventList will auto-scroll and expand
        setSelected(marketData.conditionId);
        // Dispatch event to switch to Events tab if needed
        window.dispatchEvent(new CustomEvent('map-event-selected', {
            detail: { conditionId: marketData.conditionId }
        }));
    };

    const flyTo = useCallback((lng: number, lat: number, zoom: number) => {
        mapRef.current?.flyTo({
            center: [lng, lat],
            zoom,
            speed: 0.8,
            curve: 1.2,
            essential: true
        });
    }, []);

    // Listen for flyTo events from SplitViewLayout controls
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleFlyTo = (e: CustomEvent) => {
            const { lng, lat, zoom } = e.detail;
            flyTo(lng, lat, zoom);
        };

        // Handle flyToLocation from SignalFeed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleSignalFlyTo = (e: CustomEvent) => {
            const { lng, lat, zoom } = e.detail;
            flyTo(lng, lat, zoom || 5);
        };

        window.addEventListener('map-flyto', handleFlyTo as EventListener);
        window.addEventListener('flyToLocation', handleSignalFlyTo as EventListener);

        return () => {
            window.removeEventListener('map-flyto', handleFlyTo as EventListener);
            window.removeEventListener('flyToLocation', handleSignalFlyTo as EventListener);
        };
    }, [flyTo]);

    return (
        <div className="w-full h-full bg-neutral-950 relative overflow-hidden">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Loading Overlay */}
            {!isMapLoaded && (
                <div className="absolute inset-0 bg-neutral-950 flex items-center justify-center z-50">
                    <div className="w-64">
                        <p className="text-primary text-sm font-mono tracking-widest mb-2 uppercase animate-pulse">Initializing System...</p>
                        <div className="h-1 w-full bg-primary/20 overflow-hidden">
                            <div className="h-full bg-primary animate-progress-indeterminate shadow-[0_0_10px_rgba(0,255,159,0.5)]"></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

