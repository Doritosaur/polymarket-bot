import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { FlyToInterpolator } from '@deck.gl/core';
import { useMarketStore } from "../store/marketStore";
import { getMarketCoordinates } from "../utils/GeoMapper";
import ClusterWorker from '../workers/cluster.worker?worker';
import { TagFilter } from './TagFilter';
import { MarketSearch } from './MarketSearch';
import { ZoneFilter } from './ZoneFilter';
import { MarketDetailPanel } from './MarketDetailPanel';

import { MAP_COLORS } from '../config';
import { getGlowData, getTooltipHtml } from '../utils/mapHelpers';

const GEO_JSON_URL = "/world-map.geojson";

export function MapController() {
    const { marketMap, pinnedIds, selectedTags, structureVersion } = useMarketStore();

    // State for detail panel
    const [selectedEvent, setSelectedEvent] = useState<any>(null);

    // View State for DeckGL with smooth transitions
    const [viewState, setViewState] = useState({
        longitude: 0,
        latitude: 20,
        zoom: 1.5,
        pitch: 0,
        bearing: 0,
        transitionDuration: 0,
        transitionInterpolator: undefined as InstanceType<typeof FlyToInterpolator> | undefined,
    });

    // Open detail panel when clicking a market
    const handleMarketClick = (marketData: any) => {
        setSelectedEvent(marketData);
    };

    // Smooth zoom function for cluster expansion
    const flyTo = useCallback((longitude: number, latitude: number, zoom: number) => {
        setViewState(prev => ({
            ...prev,
            longitude,
            latitude,
            zoom,
            transitionDuration: 500,
            transitionInterpolator: new FlyToInterpolator(),
        }));
    }, []);

    // 1. Worker Setup & State
    const [clusters, setClusters] = useState<any[]>([]);
    const [layoutFeatures, setLayoutFeatures] = useState<any[]>([]);
    const workerRef = useRef<Worker | null>(null);
    const pendingFlyTo = useRef<[number, number] | null>(null);
    const [lastFrameTime, setLastFrameTime] = useState(0);

    useEffect(() => {
        workerRef.current = new ClusterWorker();

        // Handle Worker Messages
        workerRef.current.onmessage = (e: MessageEvent) => {
            const { type, payload } = e.data;
            if (type === 'MARKETS_UPDATED') {
                // Store points for Glows/Heatmap
                setLayoutFeatures(payload.points);

                // Index ready, request clusters for current view
                workerRef.current?.postMessage({
                    id: Date.now(),
                    type: 'GET_CLUSTERS',
                    payload: {
                        zoom: viewState.zoom,
                        bbox: [-180, -90, 180, 90]
                    }
                });
            } else if (type === 'CLUSTER_RESULT') {
                setClusters(payload.clusters);
            } else if (type === 'EXPANSION_ZOOM_RESULT') {
                if (pendingFlyTo.current) {
                    flyTo(pendingFlyTo.current[0], pendingFlyTo.current[1], payload.zoom);
                    pendingFlyTo.current = null;
                }
            }
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    // 2. Prepare Data & Send to Worker (Async Layout)
    useEffect(() => {
        if (!workerRef.current) return;

        // Group by Event Slug (or Condition ID if no slug)
        const events = new Map<string, any[]>();

        marketMap.forEach(m => {
            if (selectedTags.size > 0) {
                const hasTag = m.tags?.some(tag => selectedTags.has(tag));
                if (!hasTag) return;
            }
            const key = m.eventSlug || m.conditionId;
            if (!events.has(key)) events.set(key, []);
            events.get(key)!.push(m);
        });

        // Prepare simplified list of "Display Items" (Events or Single Markets)
        const simplifiedMarkets: any[] = [];

        events.forEach(group => {
            const m = group[0]; // Representative
            const base = getMarketCoordinates(m.question + " " + m.slug, m.tags);
            const isEvent = group.length > 1;

            simplifiedMarkets.push({
                conditionId: m.conditionId,
                baseCoords: base,
                isEvent: isEvent,
                groupMarkets: isEvent ? group.map(gm => ({ conditionId: gm.conditionId })) : undefined
            });
        });

        workerRef.current.postMessage({
            id: Date.now(),
            type: 'UPDATE_MARKETS',
            payload: { markets: simplifiedMarkets }
        });

    }, [structureVersion, selectedTags]);

    // 3. Update View (Zoom) - Throttled
    const lastZoomRequestRef = useRef(0);
    const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!workerRef.current) return;

        const now = Date.now();
        const throttleMs = 64; // ~15fps is smooth enough for clusters during zoom

        const doUpdate = () => {
            workerRef.current?.postMessage({
                id: Date.now(),
                type: 'GET_CLUSTERS',
                payload: {
                    zoom: viewState.zoom,
                    bbox: [-180, -90, 180, 90]
                }
            });
            lastZoomRequestRef.current = Date.now();
        };

        if (now - lastZoomRequestRef.current > throttleMs) {
            if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
            doUpdate();
        } else {
            if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
            zoomTimeoutRef.current = setTimeout(doUpdate, throttleMs);
        }

        return () => {
            if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
        };
    }, [viewState.zoom]);




    // 5. (Removed renderClusters to prevent allocation loop)

    // 6. Static heatmap data
    const heatmapData = useMemo(() => {
        return layoutFeatures.map(lf => ({
            position: lf.geometry.coordinates as [number, number],
            weight: 1
        }));
    }, [layoutFeatures]);

    // 7. Glow Data
    const glowData = useMemo(() => {
        return getGlowData(marketMap, layoutFeatures, Date.now());
    }, [layoutFeatures, marketMap, lastFrameTime]);

    // Animation Loop
    useEffect(() => {
        let animationFrameId: number;
        const loop = () => {
            setLastFrameTime(Date.now());
            animationFrameId = requestAnimationFrame(loop);
        };
        if (glowData.length > 0) {
            animationFrameId = requestAnimationFrame(loop);
        }
        return () => cancelAnimationFrame(animationFrameId);
    }, [glowData.length]);

    // Layers - optimized for performance
    const layers = useMemo(() => [
        // Background World Map
        new GeoJsonLayer({
            id: 'world-map',
            data: GEO_JSON_URL,
            filled: true,
            stroked: true,
            getFillColor: MAP_COLORS.bgDark,
            getLineColor: MAP_COLORS.borderDark,
            lineWidthMinPixels: 1,
        }),

        // Static Heatmap Layer
        // @ts-expect-error - deck.gl 9 HeatmapLayer type inference
        new HeatmapLayer({
            id: 'activity-heatmap',
            data: heatmapData,
            getPosition: (d: any) => d.position,
            getWeight: (d: any) => d.weight,
            radiusPixels: 50,
            intensity: 0.4,
            threshold: 0.05,
            colorRange: MAP_COLORS.heatmapRange,
        }),

        // Glow Layer (Subtle Backlight)
        new ScatterplotLayer({
            id: 'market-glows',
            // ... (keep logic)
            data: glowData,
            getPosition: (d: any) => d.position,
            filled: true,
            getFillColor: MAP_COLORS.blinkColor,
            stroked: false,
            radiusUnits: 'pixels',
            getRadius: (d: any) => {
                const age = Date.now() - d.timestamp;
                const progress = age / 5000;
                return 15 + (Math.sin(progress * Math.PI * 8) * 5);
            },
            getOpacity: (d: any) => {
                const age = Date.now() - d.timestamp;
                const progress = age / 5000;
                const fade = Math.max(0, 1 - progress);
                const blink = 0.4 + 0.6 * Math.abs(Math.sin(progress * Math.PI * 8));
                return fade * blink * 0.8;
            },
            updateTriggers: {
                getRadius: Date.now(),
                getOpacity: Date.now()
            },
            parameters: {
                depthTest: false,
                blend: true
            }
        }),

        // Clustering Layer (Circles)
        new ScatterplotLayer({
            id: 'clusters',
            data: clusters.filter(f => f.properties.cluster),
            getPosition: (d: any) => d.geometry.coordinates,
            getFillColor: MAP_COLORS.clusterFill,
            getLineColor: MAP_COLORS.blinkColor,
            getLineWidth: 2,
            getRadius: 12,
            radiusScale: 1,
            radiusUnits: 'pixels',
            pickable: true,
            onClick: ({ object }: any) => {
                pendingFlyTo.current = object.geometry.coordinates as [number, number];
                workerRef.current?.postMessage({
                    id: Date.now(),
                    type: 'GET_EXPANSION_ZOOM',
                    payload: { clusterId: object.properties.cluster_id }
                });
            }
        }),

        // Cluster Count Labels
        new TextLayer({
            id: 'cluster-counts',
            data: clusters.filter(f => f.properties.cluster),
            getPosition: (d: any) => d.geometry.coordinates,
            getText: (d: any) => `${d.properties.point_count_abbreviated || d.properties.point_count}`,
            getSize: 10,
            getColor: MAP_COLORS.clusterText,
            fontFamily: 'JetBrains Mono'
        }),

        // Market Dots - DIRECT ACCESS OPTIMIZED
        new ScatterplotLayer({
            id: 'market-dots',
            data: clusters.filter(f => !f.properties.cluster), // Raw clusters data (stale properties)
            getPosition: (d: any) => d.geometry.coordinates,

            // Dynamic Colors via Lookup
            getFillColor: (d: any) => {
                const m = marketMap.get(d.properties.conditionId) || d.properties;
                const prob = m.yesPrice;
                const isYes = prob > 0.5;
                const alpha = 200 + Math.floor(Math.abs(prob - 0.5) * 2 * 55);

                if (pinnedIds.has(m.conditionId)) return MAP_COLORS.pinColor;
                return isYes ? [...MAP_COLORS.bullish, alpha] : [...MAP_COLORS.bearish, alpha];
            },
            getLineColor: (d: any) => {
                const m = marketMap.get(d.properties.conditionId) || d.properties;
                const isYes = m.yesPrice > 0.5;
                return isYes ? MAP_COLORS.bullish : MAP_COLORS.bearish;
            },

            getLineWidth: (d: any) => pinnedIds.has(d.properties.conditionId) ? 3 : 1,
            lineWidthUnits: 'pixels',

            // Check 'isEvent' from d.properties (populated by worker)
            // Note: worker properties are effectively static until update. 
            getRadius: (d: any) => d.properties.isEvent ? 8 : 6,
            radiusUnits: 'pixels',

            stroked: true,
            pickable: true,
            onClick: (info: any) => {
                // Use fresh data for selection
                if (info.object) {
                    const props = info.object.properties;
                    const m = marketMap.get(props.conditionId);

                    if (m) {
                        // Hydrate Group Markets
                        const groupMarkets = props.groupMarkets
                            ? props.groupMarkets.map((gm: any) => marketMap.get(gm.conditionId)).filter(Boolean)
                            : undefined;

                        handleMarketClick({
                            ...m,
                            groupMarkets: groupMarkets || (props.isEvent ? [m] : undefined)
                        });
                    }
                }
            },
            autoHighlight: true,
            highlightColor: [255, 255, 255, 100],

            // IMPORTANT: Trigger update when marketMap changes
            updateTriggers: {
                getFillColor: [marketMap, pinnedIds],
                getLineColor: [marketMap],
                getLineWidth: [pinnedIds]
            }
        })
    ], [clusters, flyTo, glowData, heatmapData, marketMap, pinnedIds]); // Add marketMap/pinnedIds to dependency

    return (
        <div className="w-full h-full bg-neutral-950 relative overflow-hidden">
            <DeckGL
                initialViewState={viewState}
                onViewStateChange={(e: any) => setViewState(e.viewState)}
                controller={true}
                layers={layers}
                getTooltip={({ object }: any) => {
                    let data = object;
                    if (object && !object.properties.cluster && object.properties.conditionId) {
                        const m = marketMap.get(object.properties.conditionId);
                        if (m) {
                            // Hydrate groupMarkets if present
                            let groupMarkets = object.properties.groupMarkets;
                            if (groupMarkets && Array.isArray(groupMarkets)) {
                                groupMarkets = groupMarkets.map((gm: any) => marketMap.get(gm.conditionId)).filter(Boolean);
                            }

                            data = {
                                ...object,
                                properties: {
                                    ...object.properties,
                                    ...m,
                                    groupMarkets: groupMarkets || object.properties.groupMarkets
                                }
                            };
                        }
                    }
                    const html = getTooltipHtml(data);
                    return html ? {
                        html,
                        style: {
                            backgroundColor: 'transparent',
                            padding: '0',
                            border: 'none'
                        }
                    } : null;
                }}
            />

            {/* Search & Filter Overlay */}
            <div className="absolute top-24 right-4 z-10 flex items-center gap-2">
                <MarketSearch onSelectMarket={flyTo} />
                <ZoneFilter onSelectZone={flyTo} />
                <TagFilter />
            </div>

            {/* Market Detail Panel */}
            <MarketDetailPanel
                open={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                eventData={selectedEvent}
            />
        </div>
    );
}
