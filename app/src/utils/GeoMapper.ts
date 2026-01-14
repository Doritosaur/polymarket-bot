export interface Coordinates {
    lat: number;
    lng: number;
}

// Core location database - countries, regions, cities
const LOCATION_DB: Record<string, Coordinates> = {
    // === COUNTRIES ===
    'argentina': { lat: -38.4, lng: -63.6 },
    'australia': { lat: -25.2, lng: 133.7 },
    'brazil': { lat: -14.2, lng: -51.9 },
    'canada': { lat: 56.1, lng: -106.3 },
    'china': { lat: 35.8, lng: 104.1 },
    'england': { lat: 52.3, lng: -1.1 },
    'france': { lat: 46.2, lng: 2.2 },
    'germany': { lat: 51.1, lng: 10.4 },
    'greenland': { lat: 71.7, lng: -42.6 },
    'hungary': { lat: 47.1, lng: 19.5 },
    'india': { lat: 20.5, lng: 78.9 },
    'iran': { lat: 32.4, lng: 53.6 },
    'israel': { lat: 31.0, lng: 34.8 },
    'italy': { lat: 41.9, lng: 12.5 },
    'japan': { lat: 36.2, lng: 138.2 },
    'korea': { lat: 37.5, lng: 126.9 },
    'lebanon': { lat: 33.8, lng: 35.8 },
    'mexico': { lat: 23.6, lng: -102.5 },
    'netherlands': { lat: 52.1, lng: 5.2 },
    'pakistan': { lat: 30.3, lng: 69.3 },
    'palestine': { lat: 31.9, lng: 35.2 },
    'poland': { lat: 51.9, lng: 19.1 },
    'portugal': { lat: 39.3, lng: -8.2 },
    'russia': { lat: 61.5, lng: 105.3 },
    'saudi': { lat: 23.8, lng: 45.0 },
    'spain': { lat: 40.4, lng: -3.7 },
    'sweden': { lat: 60.1, lng: 18.6 },
    'syria': { lat: 34.8, lng: 38.9 },
    'taiwan': { lat: 23.6, lng: 120.9 },
    'turkey': { lat: 38.9, lng: 35.2 },
    'uk': { lat: 55.3, lng: -3.4 },
    'ukraine': { lat: 48.3, lng: 31.1 },
    'venezuela': { lat: 6.4, lng: -66.5 },
    'dutch': { lat: 52.1, lng: 5.2 },

    // === REGIONS ===
    'europe': { lat: 50.1, lng: 9.5 },
    'asia': { lat: 34.0, lng: 100.6 },
    'africa': { lat: 1.6, lng: 20.9 },
    'middle-east': { lat: 29.3, lng: 47.4 },
    'gaza': { lat: 31.5, lng: 34.4 },
    'crimea': { lat: 44.9, lng: 34.0 },
    'nato': { lat: 50.8, lng: 4.3 }, // Brussels

    // === US STATES/CITIES ===
    'california': { lat: 36.7, lng: -119.4 },
    'texas': { lat: 31.0, lng: -97.5 },
    'new-york': { lat: 40.7, lng: -74.0 },
    'nyc': { lat: 40.7, lng: -74.0 },
    'los-angeles': { lat: 34.0, lng: -118.2 },
    'washington': { lat: 38.9, lng: -77.0 },

    'dc': { lat: 38.9, lng: -77.0 },
    // Cities
    'london': { lat: 51.5, lng: -0.1 },
    'paris': { lat: 48.8, lng: 2.3 },
    'beijing': { lat: 39.9, lng: 116.4 },
    'moscow': { lat: 55.7, lng: 37.6 },
    'kiev': { lat: 50.4, lng: 30.5 },
    'tokyo': { lat: 35.6, lng: 139.6 },

    // === TOPIC HUBS (Restored) ===
    'politics': { lat: 38.9, lng: -77.0 },    // DC
    'trump': { lat: 38.9, lng: -77.0 },
    'biden': { lat: 38.9, lng: -77.0 },
    'congress': { lat: 38.9, lng: -77.0 },
    'senate': { lat: 38.9, lng: -77.0 },
    'house': { lat: 38.9, lng: -77.0 },
    'scotus': { lat: 38.9, lng: -77.0 },
    'fed': { lat: 38.9, lng: -77.0 },

    'crypto': { lat: 40.7, lng: -74.0 },      // NYC
    'bitcoin': { lat: 40.7, lng: -74.0 },
    'ethereum': { lat: 40.7, lng: -74.0 },
    'stocks': { lat: 40.7, lng: -74.0 },
    'finance': { lat: 40.7, lng: -74.0 },
    'economy': { lat: 40.7, lng: -74.0 },

    'ai': { lat: 37.7, lng: -122.4 },         // SF
    'openai': { lat: 37.7, lng: -122.4 },
    'tech': { lat: 37.4, lng: -122.1 },
    'apple': { lat: 37.3, lng: -122.0 },
    'google': { lat: 37.4, lng: -122.0 },
    'tesla': { lat: 30.2, lng: -97.7 },       // Austin
    'spacex': { lat: 25.9, lng: -97.1 },      // Boca Chica

    'nba': { lat: 40.7, lng: -74.0 },
    'nfl': { lat: 39.0, lng: -94.5 },
    'soccer': { lat: 51.5, lng: -0.1 },       // London
    'oscars': { lat: 34.0, lng: -118.2 },     // LA
    'movies': { lat: 34.0, lng: -118.2 },
};

// Major cities for final fallback
// Major US cities for final fallback (Default to US origin)
const MAJOR_CITIES: Coordinates[] = [
    { lat: 40.7, lng: -74.0 },   // New York, NY
    { lat: 34.0, lng: -118.2 },  // Los Angeles, CA
    { lat: 41.8, lng: -87.6 },   // Chicago, IL
    { lat: 29.7, lng: -95.3 },   // Houston, TX
    { lat: 33.4, lng: -112.0 },  // Phoenix, AZ
    { lat: 39.9, lng: -75.1 },   // Philadelphia, PA
    { lat: 29.4, lng: -98.4 },   // San Antonio, TX
    { lat: 32.7, lng: -117.1 },  // San Diego, CA
    { lat: 32.7, lng: -96.7 },   // Dallas, TX
    { lat: 37.3, lng: -121.8 },  // San Jose, CA
    { lat: 30.2, lng: -97.7 },   // Austin, TX
    { lat: 30.3, lng: -81.6 },   // Jacksonville, FL
    { lat: 37.7, lng: -122.4 },  // San Francisco, CA
    { lat: 47.6, lng: -122.3 },  // Seattle, WA
    { lat: 39.7, lng: -104.9 },  // Denver, CO
    { lat: 38.9, lng: -77.0 },   // Washington, DC
    { lat: 42.3, lng: -71.0 },   // Boston, MA
    { lat: 36.1, lng: -86.7 },   // Nashville, TN
    { lat: 36.1, lng: -115.1 },  // Las Vegas, NV
    { lat: 25.7, lng: -80.1 },   // Miami, FL
];

// Simple hash for consistent distribution
function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
}

/**
 * SMART TAG PARSER: Extracts location from unknown tags
 * e.g., "canadian-election-2025" → finds "canada" → returns Canada coords
 * e.g., "india-pakistan" → finds "india" → returns India coords
 */
function parseTagForLocation(tag: string): Coordinates | null {
    const tagLower = tag.toLowerCase();

    // 1. Direct match first
    if (LOCATION_DB[tagLower]) {
        return LOCATION_DB[tagLower];
    }

    // 2. Search for location keywords within the tag
    // Sort by length DESC to match longer keywords first (e.g., "netherlands" before "land")
    const locationKeys = Object.keys(LOCATION_DB).sort((a, b) => b.length - a.length);

    for (const key of locationKeys) {
        if (key.length >= 3 && tagLower.includes(key)) {
            return LOCATION_DB[key];
        }
    }

    return null;
}

// Priority: City (Specificity 3) > District/Region (2) > Country (1)
// We infer specificity based on typical tag types or explicit overrides
function getSpecificity(tag: string): number {
    const lower = tag.toLowerCase();

    // Cities / Hubs
    if (['nyc', 'london', 'paris', 'tokyo', 'dc', 'washington', 'beijing', 'moscow', 'kiev'].some(c => lower.includes(c))) return 3;

    // Topics treated as hubs
    if (['crypto', 'tech', 'ai', 'finance', 'sports'].includes(lower)) return 3;

    // Regions
    if (['middle-east', 'gaza', 'crimea', 'europe', 'asia'].includes(lower)) return 2;

    // Countries (Default)
    return 1;
}

/**
 * Get coordinates for a market using dynamic tags (fast) with smart parsing fallback
 * Priority: City > District > Country > Topic > Country (Inferred)
 * @param text - Market description/slug for hash-based fallback
 * @param tags - Array of tags for location lookup
 * @param dynamicLocations - Dynamic map from DB (slug -> {lat, lng})
 */
export function getMarketCoordinates(text: string, tags?: string[], dynamicLocations?: Record<string, Coordinates>): Coordinates {
    // 1. FAST PATH: Check tags with priority logic
    if (tags && tags.length > 0) {
        let bestMatch: { coords: Coordinates, specificity: number } | null = null;

        for (const tag of tags) {
            let coords: Coordinates | null = null;
            let specificity = 1;

            // Check dynamic DB locations first
            if (dynamicLocations && dynamicLocations[tag]) {
                coords = dynamicLocations[tag];
                specificity = getSpecificity(tag);
            }
            // Fallback to static smart parser
            else {
                coords = parseTagForLocation(tag);
                if (coords) specificity = getSpecificity(tag);
            }

            if (coords) {
                // Update best match if this tag is more specific or first match
                if (!bestMatch || specificity > bestMatch.specificity) {
                    bestMatch = { coords, specificity };
                }
            }
        }

        if (bestMatch) return bestMatch.coords;
    }

    // Final fallback: Distribute to major cities using hash
    const index = hashString(text) % MAJOR_CITIES.length;
    return MAJOR_CITIES[index];
}
