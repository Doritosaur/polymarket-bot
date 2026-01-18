// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Coordinates {
    lat: number;
    lng: number;
    country: string;
    state?: string;
    geoLevel: 'country' | 'state' | 'city';
}

export type GeoLevel = 'world' | 'country' | 'state' | 'city';

export interface LocationEntry {
    lat: number;
    lng: number;
    country: string;
    state?: string;
    geoLevel: 'country' | 'state' | 'city';
}

// ============================================================================
// CONFIGURATION DATA - Separated by Category for Maintainability
// ============================================================================

const COUNTRIES: Record<string, LocationEntry> = {
    'afghanistan': { lat: 33.9, lng: 67.7, country: 'Afghanistan', geoLevel: 'country' },
    'albania': { lat: 41.1, lng: 20.1, country: 'Albania', geoLevel: 'country' },
    'algeria': { lat: 28.0, lng: 1.6, country: 'Algeria', geoLevel: 'country' },
    'argentina': { lat: -38.4, lng: -63.6, country: 'Argentina', geoLevel: 'country' },
    'australia': { lat: -25.2, lng: 133.7, country: 'Australia', geoLevel: 'country' },
    'austria': { lat: 47.5, lng: 14.5, country: 'Austria', geoLevel: 'country' },
    'bangladesh': { lat: 23.6, lng: 90.3, country: 'Bangladesh', geoLevel: 'country' },
    'belgium': { lat: 50.5, lng: 4.4, country: 'Belgium', geoLevel: 'country' },
    'brazil': { lat: -14.2, lng: -51.9, country: 'Brazil', geoLevel: 'country' },
    'canada': { lat: 56.1, lng: -106.3, country: 'Canada', geoLevel: 'country' },
    'china': { lat: 35.8, lng: 104.1, country: 'China', geoLevel: 'country' },
    'colombia': { lat: 4.5, lng: -74.2, country: 'Colombia', geoLevel: 'country' },
    'denmark': { lat: 56.2, lng: 9.5, country: 'Denmark', geoLevel: 'country' },
    'egypt': { lat: 26.8, lng: 30.8, country: 'Egypt', geoLevel: 'country' },
    'finland': { lat: 61.9, lng: 25.7, country: 'Finland', geoLevel: 'country' },
    'france': { lat: 46.2, lng: 2.2, country: 'France', geoLevel: 'country' },
    'germany': { lat: 51.1, lng: 10.4, country: 'Germany', geoLevel: 'country' },
    'greece': { lat: 39.0, lng: 21.8, country: 'Greece', geoLevel: 'country' },
    'greenland': { lat: 71.7, lng: -42.6, country: 'Greenland', geoLevel: 'country' },
    'hungary': { lat: 47.1, lng: 19.5, country: 'Hungary', geoLevel: 'country' },
    'india': { lat: 20.5, lng: 78.9, country: 'India', geoLevel: 'country' },
    'indonesia': { lat: -0.7, lng: 113.9, country: 'Indonesia', geoLevel: 'country' },
    'iran': { lat: 32.4, lng: 53.6, country: 'Iran', geoLevel: 'country' },
    'iraq': { lat: 33.2, lng: 43.6, country: 'Iraq', geoLevel: 'country' },
    'ireland': { lat: 53.4, lng: -8.2, country: 'Ireland', geoLevel: 'country' },
    'israel': { lat: 31.0, lng: 34.8, country: 'Israel', geoLevel: 'country' },
    'italy': { lat: 41.9, lng: 12.5, country: 'Italy', geoLevel: 'country' },
    'japan': { lat: 36.2, lng: 138.2, country: 'Japan', geoLevel: 'country' },
    'kenya': { lat: -0.0, lng: 37.9, country: 'Kenya', geoLevel: 'country' },
    'lebanon': { lat: 33.8, lng: 35.8, country: 'Lebanon', geoLevel: 'country' },
    'malaysia': { lat: 4.2, lng: 101.9, country: 'Malaysia', geoLevel: 'country' },
    'mexico': { lat: 23.6, lng: -102.5, country: 'Mexico', geoLevel: 'country' },
    'morocco': { lat: 31.7, lng: -7.0, country: 'Morocco', geoLevel: 'country' },
    'netherlands': { lat: 52.1, lng: 5.2, country: 'Netherlands', geoLevel: 'country' },
    'new zealand': { lat: -40.9, lng: 174.8, country: 'New Zealand', geoLevel: 'country' },
    'nigeria': { lat: 9.0, lng: 8.6, country: 'Nigeria', geoLevel: 'country' },
    'norway': { lat: 60.4, lng: 8.4, country: 'Norway', geoLevel: 'country' },
    'pakistan': { lat: 30.3, lng: 69.3, country: 'Pakistan', geoLevel: 'country' },
    'palestine': { lat: 31.9, lng: 35.2, country: 'Palestine', geoLevel: 'country' },
    'philippines': { lat: 12.8, lng: 121.7, country: 'Philippines', geoLevel: 'country' },
    'poland': { lat: 51.9, lng: 19.1, country: 'Poland', geoLevel: 'country' },
    'portugal': { lat: 39.3, lng: -8.2, country: 'Portugal', geoLevel: 'country' },
    'russia': { lat: 61.5, lng: 105.3, country: 'Russia', geoLevel: 'country' },
    'singapore': { lat: 1.3, lng: 103.8, country: 'Singapore', geoLevel: 'country' },
    'south africa': { lat: -30.5, lng: 22.9, country: 'South Africa', geoLevel: 'country' },
    'south korea': { lat: 37.5, lng: 126.9, country: 'South Korea', geoLevel: 'country' },
    'spain': { lat: 40.4, lng: -3.7, country: 'Spain', geoLevel: 'country' },
    'sweden': { lat: 60.1, lng: 18.6, country: 'Sweden', geoLevel: 'country' },
    'switzerland': { lat: 46.8, lng: 8.2, country: 'Switzerland', geoLevel: 'country' },
    'syria': { lat: 34.8, lng: 38.9, country: 'Syria', geoLevel: 'country' },
    'taiwan': { lat: 23.6, lng: 120.9, country: 'Taiwan', geoLevel: 'country' },
    'thailand': { lat: 15.8, lng: 100.9, country: 'Thailand', geoLevel: 'country' },
    'turkey': { lat: 38.9, lng: 35.2, country: 'Turkey', geoLevel: 'country' },
    'uk': { lat: 55.3, lng: -3.4, country: 'UK', geoLevel: 'country' },
    'ukraine': { lat: 48.3, lng: 31.1, country: 'Ukraine', geoLevel: 'country' },
    'usa': { lat: 39.8, lng: -98.5, country: 'USA', geoLevel: 'country' },
    'venezuela': { lat: 6.4, lng: -66.5, country: 'Venezuela', geoLevel: 'country' },
    'vietnam': { lat: 14.0, lng: 108.2, country: 'Vietnam', geoLevel: 'country' },
};

const COUNTRY_ALIASES: Record<string, string> = {
    'england': 'uk',
    'united states': 'usa',
    'korea': 'south korea',
    'dutch': 'netherlands',
    'saudi': 'saudi arabia',
};

const REGIONS: Record<string, LocationEntry> = {
    'europe': { lat: 50.1, lng: 9.5, country: 'Europe', geoLevel: 'country' },
    'asia': { lat: 34.0, lng: 100.6, country: 'Asia', geoLevel: 'country' },
    'africa': { lat: 1.6, lng: 20.9, country: 'Africa', geoLevel: 'country' },
    'middle east': { lat: 29.3, lng: 47.4, country: 'Middle East', geoLevel: 'country' },
    'nato': { lat: 50.8, lng: 4.3, country: 'Belgium', geoLevel: 'country' },
    'eu': { lat: 50.8, lng: 4.3, country: 'Belgium', geoLevel: 'country' },
};

const US_STATES: Record<string, LocationEntry> = {
    'california': { lat: 36.7, lng: -119.4, country: 'USA', state: 'California', geoLevel: 'state' },
    'texas': { lat: 31.0, lng: -97.5, country: 'USA', state: 'Texas', geoLevel: 'state' },
    'new york': { lat: 42.1, lng: -74.9, country: 'USA', state: 'New York', geoLevel: 'state' },
    'florida': { lat: 27.6, lng: -81.5, country: 'USA', state: 'Florida', geoLevel: 'state' },
    'georgia': { lat: 32.1, lng: -82.9, country: 'USA', state: 'Georgia', geoLevel: 'state' },
    'pennsylvania': { lat: 41.2, lng: -77.2, country: 'USA', state: 'Pennsylvania', geoLevel: 'state' },
    'ohio': { lat: 40.4, lng: -82.9, country: 'USA', state: 'Ohio', geoLevel: 'state' },
    'michigan': { lat: 44.3, lng: -85.6, country: 'USA', state: 'Michigan', geoLevel: 'state' },
    'arizona': { lat: 34.0, lng: -111.0, country: 'USA', state: 'Arizona', geoLevel: 'state' },
    'nevada': { lat: 38.8, lng: -116.4, country: 'USA', state: 'Nevada', geoLevel: 'state' },
    'wisconsin': { lat: 43.7, lng: -88.7, country: 'USA', state: 'Wisconsin', geoLevel: 'state' },
    'dc': { lat: 38.9, lng: -77.0, country: 'USA', state: 'DC', geoLevel: 'state' },
    'washington': { lat: 38.9, lng: -77.0, country: 'USA', state: 'DC', geoLevel: 'state' },
};

const OTHER_STATES: Record<string, LocationEntry> = {
    'gaza': { lat: 31.5, lng: 34.4, country: 'Palestine', state: 'Gaza', geoLevel: 'state' },
    'crimea': { lat: 44.9, lng: 34.0, country: 'Ukraine', state: 'Crimea', geoLevel: 'state' },
};

const MAJOR_CITIES: Record<string, LocationEntry> = {
    // USA
    'nyc': { lat: 40.7, lng: -74.0, country: 'USA', state: 'New York', geoLevel: 'city' },
    'ny': { lat: 40.7, lng: -74.0, country: 'USA', state: 'New York', geoLevel: 'city' },
    'new york city': { lat: 40.7, lng: -74.0, country: 'USA', state: 'New York', geoLevel: 'city' },
    'san francisco': { lat: 37.7, lng: -122.4, country: 'USA', state: 'California', geoLevel: 'city' },
    'sf': { lat: 37.7, lng: -122.4, country: 'USA', state: 'California', geoLevel: 'city' },
    'la': { lat: 34.0, lng: -118.2, country: 'USA', state: 'California', geoLevel: 'city' },
    'los angeles': { lat: 34.0, lng: -118.2, country: 'USA', state: 'California', geoLevel: 'city' },

    // International
    'london': { lat: 51.5, lng: -0.1, country: 'UK', geoLevel: 'city' },
    'paris': { lat: 48.8, lng: 2.3, country: 'France', geoLevel: 'city' },
    'tokyo': { lat: 35.6, lng: 139.6, country: 'Japan', geoLevel: 'city' },
    'hong kong': { lat: 22.3, lng: 114.1, country: 'China', geoLevel: 'city' },
    'dubai': { lat: 25.2, lng: 55.2, country: 'UAE', geoLevel: 'city' },
    'beijing': { lat: 39.9, lng: 116.4, country: 'China', geoLevel: 'city' },
    'shanghai': { lat: 31.2, lng: 121.4, country: 'China', geoLevel: 'city' },
    'mumbai': { lat: 19.0, lng: 72.8, country: 'India', geoLevel: 'city' },
    'moscow': { lat: 55.7, lng: 37.6, country: 'Russia', geoLevel: 'city' },
    'kiev': { lat: 50.4, lng: 30.5, country: 'Ukraine', geoLevel: 'city' },
    'kyiv': { lat: 50.4, lng: 30.5, country: 'Ukraine', geoLevel: 'city' },
    'berlin': { lat: 52.5, lng: 13.4, country: 'Germany', geoLevel: 'city' },
    'madrid': { lat: 40.4, lng: -3.7, country: 'Spain', geoLevel: 'city' },
    'rome': { lat: 41.9, lng: 12.4, country: 'Italy', geoLevel: 'city' },
    'toronto': { lat: 43.6, lng: -79.3, country: 'Canada', geoLevel: 'city' },
    'sydney': { lat: -33.8, lng: 151.2, country: 'Australia', geoLevel: 'city' },
};

// Topic-based semantic mappings (industry hubs)
const TOPIC_HUBS: Record<string, LocationEntry> = {
    // Politics & Government
    'politics': { lat: 38.9, lng: -77.0, country: 'USA', state: 'DC', geoLevel: 'city' },
    'white house': { lat: 38.9, lng: -77.0, country: 'USA', state: 'DC', geoLevel: 'city' },
    'elections': { lat: 38.9, lng: -77.0, country: 'USA', state: 'DC', geoLevel: 'city' },
    'congress': { lat: 38.9, lng: -77.0, country: 'USA', state: 'DC', geoLevel: 'city' },

    // Finance
    'finance': { lat: 40.7, lng: -74.0, country: 'USA', state: 'New York', geoLevel: 'city' },
    'wall street': { lat: 40.7, lng: -74.0, country: 'USA', state: 'New York', geoLevel: 'city' },
    'stock': { lat: 40.7, lng: -74.0, country: 'USA', state: 'New York', geoLevel: 'city' },
    'stocks': { lat: 40.7, lng: -74.0, country: 'USA', state: 'New York', geoLevel: 'city' },

    // Crypto
    'crypto': { lat: 37.7, lng: -122.4, country: 'USA', state: 'California', geoLevel: 'city' },
    'bitcoin': { lat: 37.7, lng: -122.4, country: 'USA', state: 'California', geoLevel: 'city' },
    'ethereum': { lat: 37.7, lng: -122.4, country: 'USA', state: 'California', geoLevel: 'city' },

    // Tech
    'tech': { lat: 37.7, lng: -122.4, country: 'USA', state: 'California', geoLevel: 'city' },
    'ai': { lat: 37.7, lng: -122.4, country: 'USA', state: 'California', geoLevel: 'city' },
    'silicon valley': { lat: 37.4, lng: -122.1, country: 'USA', state: 'California', geoLevel: 'city' },

    // Entertainment
    'hollywood': { lat: 34.0, lng: -118.2, country: 'USA', state: 'California', geoLevel: 'city' },
    'movies': { lat: 34.0, lng: -118.2, country: 'USA', state: 'California', geoLevel: 'city' },
    'entertainment': { lat: 34.0, lng: -118.2, country: 'USA', state: 'California', geoLevel: 'city' },

    // Sports
    'nba': { lat: 40.7, lng: -74.0, country: 'USA', state: 'New York', geoLevel: 'city' },
    'nfl': { lat: 40.7, lng: -74.0, country: 'USA', state: 'New York', geoLevel: 'city' },
    'soccer': { lat: 51.5, lng: -0.1, country: 'UK', geoLevel: 'city' },
    'football': { lat: 51.5, lng: -0.1, country: 'UK', geoLevel: 'city' },
};

// ============================================================================
// COMPILED LOCATION MAP (Built at module load)
// ============================================================================

export const LOCATION_MAP: Record<string, LocationEntry> = {
    ...COUNTRIES,
    ...REGIONS,
    ...US_STATES,
    ...OTHER_STATES,
    ...MAJOR_CITIES,
    ...TOPIC_HUBS,
};

// Apply aliases
Object.entries(COUNTRY_ALIASES).forEach(([alias, target]) => {
    const targetLocation = COUNTRIES[target];
    if (targetLocation) {
        LOCATION_MAP[alias] = targetLocation;
    }
});

// ============================================================================
// FALLBACK GLOBAL HUBS
// ============================================================================

export const GLOBAL_HUBS: readonly Coordinates[] = [
    { lat: 40.7, lng: -74.0, country: 'USA', state: 'New York', geoLevel: 'city' },
    { lat: 51.5, lng: -0.1, country: 'UK', geoLevel: 'city' },
    { lat: 35.6, lng: 139.6, country: 'Japan', geoLevel: 'city' },
    { lat: 22.3, lng: 114.1, country: 'China', geoLevel: 'city' },
    { lat: 1.3, lng: 103.8, country: 'Singapore', geoLevel: 'city' },
    { lat: 48.8, lng: 2.3, country: 'France', geoLevel: 'city' },
    { lat: 31.2, lng: 121.4, country: 'China', geoLevel: 'city' },
    { lat: 25.2, lng: 55.2, country: 'UAE', geoLevel: 'city' },
    { lat: -33.8, lng: 151.2, country: 'Australia', geoLevel: 'city' },
    { lat: 43.6, lng: -79.3, country: 'Canada', geoLevel: 'city' },
    { lat: 19.0, lng: 72.8, country: 'India', geoLevel: 'city' },
    { lat: -23.5, lng: -46.6, country: 'Brazil', geoLevel: 'city' },
    { lat: 55.7, lng: 37.6, country: 'Russia', geoLevel: 'city' },
    { lat: 37.5, lng: 126.9, country: 'South Korea', geoLevel: 'city' },
    { lat: 52.5, lng: 13.4, country: 'Germany', geoLevel: 'city' },
] as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

class LRUCache<K, V> {
    private cache = new Map<K, V>();
    private maxSize: number;

    constructor(maxSize: number = 1000) {
        this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recent)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key: K, value: V): void {
        // Remove if exists to re-add at end
        this.cache.delete(key);
        this.cache.set(key, value);

        // Evict oldest if over capacity
        if (this.cache.size > this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    clear(): void {
        this.cache.clear();
    }
}

const cache = new LRUCache<string, Coordinates>(1000);

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getSpecificity(geoLevel: string): number {
    const levels = { city: 3, state: 2, country: 1 };
    return levels[geoLevel as keyof typeof levels] || 0;
}

function normalizeText(text: string): string {
    return text.toLowerCase().replace(/[^\w\s-]/g, '');
}

function extractTokens(text: string): string[] {
    return normalizeText(text).split(/\s+/).filter(t => t.length >= 3);
}

function findBestMatch(
    candidates: Array<{ coords: LocationEntry; specificity: number }>
): LocationEntry | null {
    return candidates.reduce<LocationEntry | null>((best, curr) => {
        if (!best || curr.specificity > getSpecificity(best.geoLevel)) {
            return curr.coords;
        }
        return best;
    }, null);
}

// ============================================================================
// MAIN GEO RESOLUTION FUNCTION
// ============================================================================

export function getMarketCoordinates(
    text: string,
    tags?: string[],
    dynamicLocations?: Record<string, Coordinates>
): Coordinates {
    // 1. Check cache
    const cacheKey = `${text}|${tags?.join(',')}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const candidates: Array<{ coords: LocationEntry; specificity: number }> = [];

    // 2. Priority 1: Check tags
    if (tags) {
        for (const tag of tags) {
            const normalized = tag.toLowerCase();

            // Dynamic overrides (highest priority)
            if (dynamicLocations?.[normalized]) {
                const coords = dynamicLocations[normalized];
                candidates.push({
                    coords,
                    specificity: getSpecificity(coords.geoLevel)
                });
            }

            // Static location map
            if (LOCATION_MAP[normalized]) {
                candidates.push({
                    coords: LOCATION_MAP[normalized],
                    specificity: getSpecificity(LOCATION_MAP[normalized].geoLevel)
                });
            }
        }
    }

    // 3. Priority 2: Check text tokens
    const tokens = extractTokens(text);

    // Single tokens
    for (const token of tokens) {
        if (LOCATION_MAP[token]) {
            candidates.push({
                coords: LOCATION_MAP[token],
                specificity: getSpecificity(LOCATION_MAP[token].geoLevel)
            });
        }
    }

    // Bigrams (for multi-word locations)
    for (let i = 0; i < tokens.length - 1; i++) {
        const bigram = `${tokens[i]} ${tokens[i + 1]}`;
        if (LOCATION_MAP[bigram]) {
            candidates.push({
                coords: LOCATION_MAP[bigram],
                specificity: getSpecificity(LOCATION_MAP[bigram].geoLevel)
            });
        }
    }

    // 4. Resolve best match or fallback
    const bestMatch = findBestMatch(candidates);
    const result: Coordinates = bestMatch || GLOBAL_HUBS[hashString(text) % GLOBAL_HUBS.length];

    // 5. Cache and return
    cache.set(cacheKey, result);
    return result;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export function addDynamicLocation(key: string, coords: Coordinates): void {
    LOCATION_MAP[key.toLowerCase()] = coords;
    cache.clear(); // Invalidate cache
}

export function removeDynamicLocation(key: string): void {
    delete LOCATION_MAP[key.toLowerCase()];
    cache.clear();
}

export function getAllCountries(): string[] {
    return Array.from(new Set(
        Object.values(LOCATION_MAP).map(loc => loc.country)
    )).sort();
}

export function getLocationsByCountry(country: string): LocationEntry[] {
    return Object.values(LOCATION_MAP).filter(loc =>
        loc.country.toLowerCase() === country.toLowerCase()
    );
}

export function clearCache(): void {
    cache.clear();
}

export function getCacheStats(): { size: number; maxSize: number } {
    return {
        size: (cache as any).cache.size,
        maxSize: 1000
    };
}
