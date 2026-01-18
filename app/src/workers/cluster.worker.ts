// Custom Hexagonal Spiral Layout Worker
// - Generates deterministic "districts" for cities to spread out density
// - Spirals markets around district centers so they don't overlap
// - Returns all points for Heatmap + Top 10 for Glowing Dots

export type MarketsUpdatedResponse = {
    id: number;
    type: 'MARKETS_UPDATED';
    payload: {
        points: any[];
        topPoints: any[];
    };
};

export type ClusterResponse = {
    id: number;
    type: 'CLUSTER_RESULT';
    payload: {
        clusters: any[];
    };
};

export type ExpansionZoomResponse = {
    id: number;
    type: 'EXPANSION_ZOOM_RESULT';
    payload: {
        zoom: number;
    };
};

// Utils for deterministic generation
function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

// Generate separate districts for a city coord to avoid massive blobs
function getDistrictCenter(lat: number, lng: number, seed: number): [number, number] {
    // Deterministic random regions within ~0.08 degrees (~8km) of city center
    const r = (seed % 100) / 100 * 0.08;
    const theta = (seed % 360) * (Math.PI / 180);

    return [
        lng + r * Math.cos(theta),
        lat + r * Math.sin(theta)
    ];
}

// Spiral layout for points within a district
function getSpiralPos(index: number, centerLng: number, centerLat: number): [number, number] {
    // Spiral logic: spacing increases with square root of index
    if (index === 0) return [centerLng, centerLat];

    const angle = index * 2.4; // Golden angle approx
    const radius = 0.008 * Math.sqrt(index); // Spread factor ~800m

    return [
        centerLng + radius * Math.cos(angle),
        centerLat + radius * Math.sin(angle)
    ];
}

let allPoints: any[] = [];

function processMarkets(markets: any[]): { points: any[], topPoints: any[] } {
    // 1. Group by city location (using coarse coords matching)
    const cities = new Map<string, any[]>();
    markets.forEach(m => {
        const key = `${m.baseCoords?.lat.toFixed(2)},${m.baseCoords?.lng.toFixed(2)}`;
        if (!cities.has(key)) cities.set(key, []);
        cities.get(key)!.push(m);
    });

    const points: any[] = [];

    // 2. Process each city
    cities.forEach((cityMarkets, key) => {
        const [latStr, lngStr] = key.split(',');
        const cityLat = parseFloat(latStr);
        const cityLng = parseFloat(lngStr);

        // Number of districts based on density (max 6)
        const districtCount = Math.min(Math.max(1, Math.floor(cityMarkets.length / 10)), 6);
        const districts = Array.from({ length: districtCount }, (_, i) => ({
            id: i,
            center: getDistrictCenter(cityLat, cityLng, hashString(key) + i * 999),
            markets: [] as any[]
        }));

        // 3. Distribute markets to districts
        cityMarkets.forEach(m => {
            const districtIdx = hashString(m.conditionId) % districtCount;
            districts[districtIdx].markets.push(m);
        });

        // 4. Spiral markets within districts
        districts.forEach(d => {
            d.markets.forEach((m, idx) => {
                const [lng, lat] = getSpiralPos(idx, d.center[0], d.center[1]);
                points.push({
                    type: 'Feature',
                    properties: {
                        cluster: false,
                        conditionId: m.conditionId,
                        isEvent: m.isEvent,
                        yesPrice: m.yesPrice,
                        country: m.country,
                        state: m.state,
                        tags: m.tags,
                        volume: parseFloat(m.volume) || 0,
                        logVolume: Math.log10(Math.max(parseFloat(m.volume) || 1, 1)), // Linearize magnitude for visualization
                        title: m.question || m.slug
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    }
                });
            });
        });
    });

    // Extract Top Markets - STRICT "One per City" Strategy
    // User Requirement: "Why am I seeing multiple markets from a city?"
    // Solution: Only show the HIGHEST VOLUME market (Champion) from each city.

    const cityChampions: any[] = [];

    cities.forEach((cityMarkets, key) => {
        if (cityMarkets.length === 0) return;

        // 1. Find the Champion (Max Volume)
        const champion = cityMarkets.reduce((prev, current) =>
            (parseFloat(current.volume || 0) > parseFloat(prev.volume || 0)) ? current : prev
        );

        // 2. Create Feature for Champion
        // Use the first district center (or original coord) to position strictly
        const [latStr, lngStr] = key.split(',');
        const cityLat = parseFloat(latStr);
        const cityLng = parseFloat(lngStr);
        // Add slight deterministic jitter so it doesn't overlap perfectly with map labels if any
        const center = getDistrictCenter(cityLat, cityLng, hashString(key));

        cityChampions.push({
            type: 'Feature',
            properties: {
                cluster: false,
                conditionId: champion.conditionId,
                isEvent: champion.isEvent,
                yesPrice: champion.yesPrice,
                country: champion.country,
                state: champion.state,
                tags: champion.tags,
                volume: parseFloat(champion.volume) || 0,
                title: champion.question || champion.slug
            },
            geometry: {
                type: 'Point',
                coordinates: center // Use the distinct city center
            }
        });
    });

    // 3. Sort Champions by Volume and take Top 70
    // This gives us the "Global Top 50 Cities" effectively
    const topPoints = cityChampions
        .sort((a, b) => b.properties.volume - a.properties.volume)
        .slice(0, 70);

    return { points, topPoints };
}

// Get visible points (simple bbox filter)
function getVisiblePoints(bbox: [number, number, number, number]): any[] {
    return allPoints.filter(p => {
        const [lng, lat] = p.geometry.coordinates;
        return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
    });
}

self.onmessage = (e: MessageEvent<any>) => {
    const { id, type, payload } = e.data;

    if (type === 'UPDATE_MARKETS') {
        const { markets } = payload;

        const result = processMarkets(markets);
        allPoints = result.points;

        self.postMessage({
            id,
            type: 'MARKETS_UPDATED',
            payload: result
        } as MarketsUpdatedResponse);
    }

    if (type === 'GET_CLUSTERS') {
        const { bbox } = payload;
        const result = getVisiblePoints(bbox);
        self.postMessage({ id, type: 'CLUSTER_RESULT', payload: { clusters: result } } as ClusterResponse);
    }

    if (type === 'GET_EXPANSION_ZOOM') {
        const { currentZoom } = payload;
        const nextZoom = Math.min(currentZoom + 2, 16);
        self.postMessage({ id, type: 'EXPANSION_ZOOM_RESULT', payload: { zoom: nextZoom } } as ExpansionZoomResponse);
    }
};
