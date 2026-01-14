import { useMemo, useState, useEffect, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { FlyToInterpolator } from '@deck.gl/core';
import { useMarketStore } from "../store/marketStore";
import { getMarketCoordinates } from "../utils/GeoMapper";
import Supercluster from 'supercluster';
import { TagFilter } from './TagFilter';
import { MarketSearch } from './MarketSearch';
import { ZoneFilter } from './ZoneFilter';
import { MarketDetailPanel } from './MarketDetailPanel';

import { MAP_COLORS } from '../config';
import { getGlowData, getTooltipHtml } from '../utils/mapHelpers';

const GEO_JSON_URL = "/world-map.geojson";

export function MapController() {
    const { marketMap, pinnedIds, selectedTags } = useMarketStore();

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

    // 1. Prepare Base Layout - Only re-calc when market list changes
    const layoutFeatures = useMemo(() => {
        const features: any[] = [];
        const locationGroups = new Map<string, any[]>();

        // Group by Event Slug (or Condition ID if no slug)
        const events = new Map<string, any[]>();

        marketMap.forEach(m => {
            // Filter by tags if any are selected
            if (selectedTags.size > 0) {
                const hasTag = m.tags?.some(tag => selectedTags.has(tag));
                if (!hasTag) return;
            }

            // Group Key: Use eventSlug if available, otherwise fallback to conditionId (single market)
            const key = m.eventSlug || m.conditionId;
            if (!events.has(key)) events.set(key, []);
            events.get(key)!.push(m);
        });

        events.forEach(group => {
            // Use the first market in the group for coordinates
            const m = group[0];

            // Pass tags for faster O(1) lookup, fall back to text search
            const base = getMarketCoordinates(m.question + " " + m.slug, m.tags);
            const key = `${base.lat},${base.lng}`;

            if (!locationGroups.has(key)) locationGroups.set(key, []);

            // Store the whole group
            locationGroups.get(key)!.push({
                ...m,
                baseCoords: base,
                isEvent: group.length > 1,
                marketCount: group.length,
                groupMarkets: group
            });
        });

        locationGroups.forEach((marketsAtLoc) => {
            const count = marketsAtLoc.length;
            marketsAtLoc.forEach((m, index) => {
                let finalLng = m.baseCoords.lng;
                let finalLat = m.baseCoords.lat;

                if (count > 1) {
                    const angle = index * 0.5;
                    const radius = 0.1 + (0.0005 * index);
                    const latOffset = radius * Math.sin(angle);
                    const lngOffset = (radius * Math.cos(angle)) / Math.cos(m.baseCoords.lat * (Math.PI / 180));
                    finalLng += lngOffset;
                    finalLat += latOffset;
                }

                features.push({
                    conditionId: m.conditionId,
                    geometry: { type: 'Point', coordinates: [finalLng, finalLat] }
                });
            });
        });
        return features;
    }, [marketMap.size, selectedTags]);

    // 2. Merge with Dynamic Data
    const points = useMemo(() => {
        return layoutFeatures.map(lf => {
            const m = marketMap.get(lf.conditionId);
            if (!m) return null;

            const isPinned = pinnedIds.has(m.conditionId);
            const isUp = m.yesPrice > 0.5;

            return {
                type: 'Feature',
                properties: {
                    cluster: false,
                    ...m,
                    isPinned,
                    color: isUp ? MAP_COLORS.bullish : MAP_COLORS.bearish,
                    strokeColor: isPinned ? MAP_COLORS.cyberGreen : [255, 255, 255, 50],
                    // Pass event properties
                    isEvent: lf.isEvent,
                    marketCount: lf.marketCount,
                },
                geometry: lf.geometry
            };
        }).filter(Boolean) as any[];
    }, [layoutFeatures, marketMap, pinnedIds]);

    // 3. Initialize Supercluster
    const index = useMemo(() => {
        const sc = new Supercluster({ radius: 80, maxZoom: 6 });
        sc.load(points);
        return sc;
    }, [points]);

    // 4. Get Clusters based on ViewState
    const [clusters, setClusters] = useState<any[]>([]);
    const [lastFrameTime, setLastFrameTime] = useState(0); // Trigger re-render for animation

    useEffect(() => {
        const bbox: [number, number, number, number] = [-180, -90, 180, 90];
        setClusters(index.getClusters(bbox, Math.floor(viewState.zoom)));
    }, [viewState.zoom, index]);

    // 5. Static heatmap data - Back to static for subtle look
    const heatmapData = useMemo(() => {
        return layoutFeatures.map(lf => ({
            position: lf.geometry.coordinates as [number, number],
            weight: 1
        }));
    }, [layoutFeatures]);



    // 7. Glow Data for subtle feedback
    const glowData = useMemo(() => {
        return getGlowData(marketMap, layoutFeatures, Date.now());
    }, [layoutFeatures, marketMap, lastFrameTime]); // This will update when addTrade updates marketMap or frame updates


    // ANIMATION LOOP: Syncs with Active Glows
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
            data: glowData,
            getPosition: (d: any) => d.position,
            filled: true,
            getFillColor: [...MAP_COLORS.cyberGreen, 255],
            stroked: false,
            radiusUnits: 'pixels',
            getRadius: (d: any) => {
                const age = Date.now() - d.timestamp;
                const progress = age / 5000; // 0 to 1 over 5s
                // Breathing radius
                return 15 + (Math.sin(progress * Math.PI * 8) * 5); // 15px +/- 5px
            },
            getOpacity: (d: any) => {
                const age = Date.now() - d.timestamp;
                const progress = age / 5000;
                // Blinking Fading Opacity
                // Base fade: 1 -> 0
                const fade = Math.max(0, 1 - progress);
                // Blink: 0 -> 1 -> 0 ... (8 times)
                const blink = 0.4 + 0.6 * Math.abs(Math.sin(progress * Math.PI * 8));

                return fade * blink * 0.8; // Max 0.8 opacity
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
            getLineColor: MAP_COLORS.cyberGreen,
            getLineWidth: 2,
            getRadius: 12,
            radiusScale: 1,
            radiusUnits: 'pixels',
            pickable: true,
            onClick: ({ object }: any) => {
                const expansionZoom = index.getClusterExpansionZoom(object.properties.cluster_id);
                flyTo(object.geometry.coordinates[0], object.geometry.coordinates[1], expansionZoom);
            }
        }),

        // Cluster Count Labels
        new TextLayer({
            id: 'cluster-counts',
            data: clusters.filter(f => f.properties.cluster),
            getPosition: (d: any) => d.geometry.coordinates,
            getText: (d: any) => `${d.properties.point_count_abbreviated}`,
            getSize: 10,
            getColor: MAP_COLORS.clusterText,
            fontFamily: 'JetBrains Mono'
        }),

        // Market Dots
        new ScatterplotLayer({
            id: 'market-dots',
            data: clusters.filter(f => !f.properties.cluster),
            getPosition: (d: any) => d.geometry.coordinates,
            getFillColor: (d: any) => d.properties.color,
            getLineColor: (d: any) => d.properties.strokeColor,
            getLineWidth: (d: any) => d.properties.isPinned ? 3 : 1,
            lineWidthUnits: 'pixels',
            getRadius: (d: any) => d.properties.isEvent ? 8 : 6, // Larger for events
            radiusUnits: 'pixels',
            stroked: true,
            pickable: true,
            onClick: (info: any) => {
                if (info.object) handleMarketClick(info.object.properties);
            },
            autoHighlight: true,
            highlightColor: [255, 255, 255, 100]
        })
    ], [clusters, index, flyTo, glowData, heatmapData]);

    return (
        <div className="w-full h-full bg-neutral-950 relative overflow-hidden">
            <DeckGL
                initialViewState={viewState}
                onViewStateChange={(e: any) => setViewState(e.viewState)}
                controller={true}
                layers={layers}
                getTooltip={({ object }: any) => {
                    const html = getTooltipHtml(object);
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
