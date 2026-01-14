import Supercluster from 'supercluster';

// Define Message Types
export type ClusterRequest = {
    id: number;
    type: 'CLUSTER';
    payload: {
        markets: any[]; // Minimized market objects
        zoom: number;
        bbox: [number, number, number, number];
    };
};

export type ClusterResponse = {
    id: number;
    type: 'CLUSTER_RESULT';
    payload: {
        clusters: any[];
    };
};

export type MarketsUpdatedResponse = {
    id: number;
    type: 'MARKETS_UPDATED';
    payload: {
        points: any[];
    };
};

export type ExpansionZoomResponse = {
    id: number;
    type: 'EXPANSION_ZOOM_RESULT';
    payload: {
        zoom: number;
    };
};

// State
let index: Supercluster | null = null;
let currentPoints: any[] = [];

// Helper: Get Coordinates (Simplified version of GeoMapper)
// Ideally pass coordinates IN from main thread to avoid duplicating GeoMapper logic.
// Main thread already calculates baseCoords.

self.onmessage = (e: MessageEvent<any>) => {
    const { id, type, payload } = e.data;

    if (type === 'UPDATE_MARKETS') {
        const { markets } = payload;

        // 1. Jitter & Point Generation
        const locationGroups = new Map<string, any[]>();
        markets.forEach((m: any) => {
            const key = `${m.baseCoords.lat},${m.baseCoords.lng}`;
            if (!locationGroups.has(key)) locationGroups.set(key, []);
            locationGroups.get(key)!.push(m);
        });

        const points: any[] = [];

        locationGroups.forEach((eventsAtLoc) => {
            const spreadFactor = 0.0005;
            const goldenAngle = 137.508;

            eventsAtLoc.forEach((m, index) => {
                let lng = m.baseCoords.lng;
                let lat = m.baseCoords.lat;

                if (index > 0) {
                    const i = index;
                    const r = spreadFactor * Math.sqrt(i);
                    const theta = i * goldenAngle * (Math.PI / 180);
                    const deltaX = r * Math.cos(theta);
                    const deltaY = r * Math.sin(theta);

                    const latRad = lat * (Math.PI / 180);
                    const aspect = 1 / Math.cos(latRad);

                    lng += deltaX * aspect;
                    lat += deltaY;
                }

                points.push({
                    type: 'Feature',
                    properties: {
                        cluster: false,
                        conditionId: m.conditionId,
                        isEvent: m.isEvent,
                        groupMarkets: m.groupMarkets
                    },
                    geometry: { type: 'Point', coordinates: [lng, lat] }
                });
            });
        });

        currentPoints = points;
        index = new Supercluster({ radius: 80, maxZoom: 6 });
        index.load(currentPoints);

        // Ack with points for main thread visualization (Glows/Heatmap)
        self.postMessage({
            id,
            type: 'MARKETS_UPDATED',
            payload: { points }
        } as MarketsUpdatedResponse);
    }

    if (type === 'GET_CLUSTERS') {
        const { zoom, bbox } = payload;
        if (!index) {
            self.postMessage({ id, type: 'CLUSTER_RESULT', payload: { clusters: [] } } as ClusterResponse);
            return;
        }

        const clusters = index.getClusters(bbox, Math.floor(zoom));
        self.postMessage({ id, type: 'CLUSTER_RESULT', payload: { clusters } } as ClusterResponse);
    }

    if (type === 'GET_EXPANSION_ZOOM') {
        const { clusterId } = payload;
        if (!index) return;

        const zoom = index.getClusterExpansionZoom(clusterId);
        self.postMessage({ id, type: 'EXPANSION_ZOOM_RESULT', payload: { zoom } } as ExpansionZoomResponse);
    }
};
