import { useMemo, useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { useMarketStore } from "../store/marketStore";
import { getMarketCoordinates } from "../utils/GeoMapper";
import { useAuthStore } from "../store/authStore";
import Supercluster from 'supercluster';

// Use a direct GeoJSON source instead of TopoJSON
// Use a direct GeoJSON source instead of TopoJSON
const GEO_JSON_URL = "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson";

export function MapController() {
    const togglePin = useMarketStore(state => state.togglePin);
    const pinnedIds = useMarketStore(state => state.pinnedIds);
    const marketMap = useMarketStore(state => state.marketMap);

    // Auth Store for Socket Emission
    const user = useAuthStore(state => state.user);
    const socket = useAuthStore(state => state.socket);

    // View State for DeckGL
    const [viewState, setViewState] = useState({
        longitude: 0,
        latitude: 20,
        zoom: 1.5,
        pitch: 0,
        bearing: 0
    });

    const handlePinClick = (conditionId: string) => {
        // 1. Optimistic Local Update
        togglePin(conditionId);

        // 2. Persistent Backend Update
        if (socket && user) {
            socket.emit('toggle_pin', { userId: user.id, conditionId });
        }
    };

    // 1. Prepare Base Layout (Expensive Spiral Math) - Only re-calc when market list changes
    // Optimization: We serialize IDs to key dependency to avoid deep compare, or just map size if usually append-only?
    // Safer: depend on marketMap keys or structure.
    const layoutFeatures = useMemo(() => {
        const features: any[] = [];
        const locationGroups = new Map<string, any[]>();

        marketMap.forEach(m => {
            const base = getMarketCoordinates(m.question + " " + m.slug);
            const key = `${base.lat},${base.lng}`;
            if (!locationGroups.has(key)) locationGroups.set(key, []);
            locationGroups.get(key)!.push({ ...m, baseCoords: base });
        });

        locationGroups.forEach((marketsAtLoc) => {
            const count = marketsAtLoc.length;
            marketsAtLoc.forEach((m, index) => {
                let finalLng = m.baseCoords.lng;
                let finalLat = m.baseCoords.lat;

                // Spiral Layout
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
    }, [marketMap.size]); // Only re-calc format when count changes (approx)

    // 2. Merge with Dynamic Data (Fast) - Re-runs on store price updates
    const points = useMemo(() => {
        return layoutFeatures.map(lf => {
            const m = marketMap.get(lf.conditionId);
            if (!m) return null; // In case of sync race

            const isPinned = pinnedIds.has(m.conditionId);
            const isUp = m.yesPrice > 0.5;

            return {
                type: 'Feature',
                properties: {
                    cluster: false,
                    ...m, // contains prices
                    isPinned,
                    color: isUp ? [16, 185, 129] : [197, 0, 60],
                    strokeColor: isPinned ? [0, 255, 159] : [255, 255, 255, 50],
                    radius: m.yesPrice > 0.70 || m.yesPrice < 0.30 ? 80000 : 40000
                },
                geometry: lf.geometry
            };
        }).filter(Boolean) as any[];
    }, [layoutFeatures, marketMap, pinnedIds]);

    // 2. Initialize Supercluster
    const index = useMemo(() => {
        const sc = new Supercluster({
            radius: 80, // INCREASED Aggregation: Merges more points into fewer clusters
            maxZoom: 6
        });
        sc.load(points);
        return sc;
    }, [points]);

    // 3. Get Clusters based on ViewState
    const [clusters, setClusters] = useState<any[]>([]);

    useEffect(() => {
        // Simple bounding box for whole world to ensure simple updates
        // Optimized: we could calculate precise bbox from viewState, but global is safer for now
        const bbox: [number, number, number, number] = [-180, -90, 180, 90];
        setClusters(index.getClusters(bbox, Math.floor(viewState.zoom)));
    }, [viewState.zoom, index]);

    // Layers
    const layers = [
        // Background World Map
        new GeoJsonLayer({
            id: 'world-map',
            data: GEO_JSON_URL,
            filled: true,
            stroked: true,
            getFillColor: [10, 10, 10], // neutral-950/black
            getLineColor: [40, 40, 40], // neutral-800
            lineWidthMinPixels: 1,
        }),

        // Clustering Layer (Circles)
        new ScatterplotLayer({
            id: 'clusters',
            data: clusters.filter(f => f.properties.cluster),
            getPosition: (d: any) => d.geometry.coordinates,
            getFillColor: [30, 30, 30], // Dark grey background
            getLineColor: [0, 255, 159], // #00ff9f (Cyber Green)
            getLineWidth: 2,
            // MINIMAL CLUSTERS: Fixed tiny radius so they don't block the map
            getRadius: 12,
            radiusScale: 1,
            radiusUnits: 'pixels', // Fixed pixel size on screen
            pickable: true,
            onClick: ({ object }: any) => {
                const expansionZoom = index.getClusterExpansionZoom(object.properties.cluster_id);
                setViewState({
                    ...viewState,
                    zoom: expansionZoom,
                    longitude: object.geometry.coordinates[0],
                    latitude: object.geometry.coordinates[1],
                });
            }
        }),

        // Cluster Count Labels
        new TextLayer({
            id: 'cluster-counts',
            data: clusters.filter(f => f.properties.cluster),
            getPosition: (d: any) => d.geometry.coordinates,
            getText: (d: any) => `${d.properties.point_count_abbreviated}`,
            getSize: 10, // Small text
            getColor: [255, 255, 255],
            fontFamily: 'JetBrains Mono'
        }),

        // Leaf Layer (Individual Markets) - Only render non-clustered points
        new ScatterplotLayer({
            id: 'market-dots',
            data: clusters.filter(f => !f.properties.cluster),
            getPosition: (d: any) => d.geometry.coordinates,
            getFillColor: (d: any) => d.properties.color,
            getLineColor: (d: any) => d.properties.strokeColor,
            getLineWidth: (d: any) => d.properties.isPinned ? 3 : 1,
            lineWidthUnits: 'pixels',
            getRadius: 6, // Fixed pixel size for clarity
            radiusUnits: 'pixels',
            stroked: true,
            pickable: true,

            // Interaction
            onClick: (info: any) => {
                if (info.object) {
                    handlePinClick(info.object.properties.conditionId);
                }
            },

            // Highlight
            autoHighlight: true,
            highlightColor: [255, 255, 255, 100]
        })
    ];

    return (
        <div className="w-full h-full bg-neutral-950 relative overflow-hidden">
            <DeckGL
                initialViewState={viewState}
                onViewStateChange={(e: any) => setViewState(e.viewState)}
                controller={true}
                layers={layers}
                getTooltip={({ object }: any) => {
                    if (!object || object.properties?.cluster) return null;
                    const mp = object.properties; // Market Properties
                    return {
                        html: `
                        <div style="
                            background: rgba(23, 23, 23, 0.9);
                            backdrop-filter: blur(8px);
                            border: 1px solid #404040;
                            border-radius: 8px;
                            padding: 12px;
                            color: white;
                            font-family: 'JetBrains Mono', monospace;
                            width: 240px;
                            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
                        ">
                            ${mp.image ? `<img src="${mp.image}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px; margin-bottom: 8px; border: 1px solid #333;">` : ''}
                            <div style="font-weight: 600; font-size: 11px; color: #a3a3a3; margin-bottom: 2px;">MARKET</div>
                            <div style="font-size: 13px; line-height: 1.3; margin-bottom: 8px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                                ${mp.slug}
                            </div>
                            
                            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                                <div style="flex: 1; bg-color: #064e3b; padding: 4px; border-radius: 4px; border: 1px solid #059669; text-align: center;">
                                    <div style="font-size: 9px; color: #34d399; text-transform: uppercase;">YES</div>
                                    <div style="font-size: 14px; font-weight: bold; color: #fff;">${(mp.yesPrice * 100).toFixed(1)}%</div>
                                </div>
                                <div style="flex: 1; bg-color: #50071a; padding: 4px; border-radius: 4px; border: 1px solid #c5003c; text-align: center;">
                                    <div style="font-size: 9px; color: #c5003c; text-transform: uppercase;">NO</div>
                                    <div style="font-size: 14px; font-weight: bold; color: #fff;">${(mp.noPrice * 100).toFixed(1)}%</div>
                                </div>
                            </div>

                            <div class="${mp.isPinned ? 'text-primary' : 'text-neutral-500'}" style="
                                font-size: 10px; 
                                display: flex; 
                                align-items: center; 
                                gap: 4px; 
                                justify-content: center;
                                border-top: 1px solid #333;
                                padding-top: 4px;
                            ">
                                ${mp.isPinned ? '★ PINNED TO WATCHLIST' : 'CLICK TO PIN'}
                            </div>
                        </div>
                    `,
                        style: {
                            color: 'white'
                        }
                    };
                }}
            />
        </div>
    );
}
