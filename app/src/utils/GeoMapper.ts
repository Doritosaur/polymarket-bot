export interface Coordinates {
    lat: number;
    lng: number;
}

// Simple jitter logic is inline now

const LOCATIONS: Record<string, Coordinates> = {
    // North America
    'usa': { lat: 39.8, lng: -98.6 },
    'united states': { lat: 39.8, lng: -98.6 },
    'trump': { lat: 38.9, lng: -77.0 }, // DC
    'biden': { lat: 38.9, lng: -77.0 }, // DC
    'harris': { lat: 38.9, lng: -77.0 }, // DC
    'fed': { lat: 38.9, lng: -77.0 }, // DC
    'california': { lat: 36.7, lng: -119.4 },
    'texas': { lat: 31.0, lng: -97.5 },
    'new york': { lat: 40.7, lng: -74.0 },
    'canada': { lat: 56.1, lng: -106.3 },

    // Europe
    'uk': { lat: 55.3, lng: -3.4 },
    'london': { lat: 51.5, lng: -0.1 },
    'france': { lat: 46.2, lng: 2.2 },
    'paris': { lat: 48.8, lng: 2.3 },
    'germany': { lat: 51.1, lng: 10.4 },
    'ukraine': { lat: 48.3, lng: 31.1 },
    'russia': { lat: 61.5, lng: 105.3 },

    // Asia
    'china': { lat: 35.8, lng: 104.1 },
    'beijing': { lat: 39.9, lng: 116.4 },
    'japan': { lat: 36.2, lng: 138.2 },
    'india': { lat: 20.5, lng: 78.9 },
    'israel': { lat: 31.0, lng: 34.8 },
    'gaza': { lat: 31.5, lng: 34.4 },
    'iran': { lat: 32.4, lng: 53.6 },

    // South America
    'brazil': { lat: -14.2, lng: -51.9 },
    'argentina': { lat: -38.4, lng: -63.6 },

    // Default US Center for "Generic"
    'default': { lat: 39.8, lng: -98.6 }
};

const MAJOR_CITIES: Coordinates[] = [
    { lat: 40.7, lng: -74.0 }, // New York
    { lat: 51.5, lng: -0.1 },  // London
    { lat: 35.6, lng: 139.6 }, // Tokyo
    { lat: 22.3, lng: 114.1 }, // Hong Kong
    { lat: 1.3, lng: 103.8 },  // Singapore
    { lat: 48.8, lng: 2.3 },   // Paris
    { lat: 52.5, lng: 13.4 },  // Berlin
    { lat: 25.2, lng: 55.2 },  // Dubai
    { lat: -33.8, lng: 151.2 },// Sydney
    { lat: -23.5, lng: -46.6 },// Sao Paulo
    { lat: 19.4, lng: -99.1 }, // Mexico City
    { lat: 37.7, lng: -122.4 },// San Francisco
    { lat: 55.7, lng: 37.6 },  // Moscow
    { lat: 28.6, lng: 77.2 },  // New Delhi
    { lat: 31.2, lng: 121.4 }, // Shanghai
    { lat: 37.5, lng: 126.9 }, // Seoul
    { lat: 41.0, lng: 28.9 },  // Istanbul
    { lat: 6.5, lng: 3.3 },    // Lagos
    { lat: -1.2, lng: 36.8 },  // Nairobi
    { lat: -26.2, lng: 28.0 }, // Johannesburg
    { lat: 13.7, lng: 100.5 }, // Bangkok
    { lat: -6.2, lng: 106.8 }, // Jakarta
    { lat: 19.0, lng: 72.8 },  // Mumbai
    { lat: 30.0, lng: 31.2 },  // Cairo
    { lat: 40.4, lng: -3.7 },  // Madrid
    { lat: 41.9, lng: 12.4 },  // Rome
    { lat: 59.3, lng: 18.0 },  // Stockholm
    { lat: 43.6, lng: -79.3 }, // Toronto
    { lat: 34.0, lng: -118.2 },// Los Angeles
    { lat: 41.8, lng: -87.6 }, // Chicago
    { lat: 25.7, lng: -80.1 }, // Miami
];

export function getMarketCoordinates(text: string): Coordinates {
    const lower = text.toLowerCase();

    // Check for explicit matches
    for (const [key, coords] of Object.entries(LOCATIONS)) {
        if (lower.includes(key) && key !== 'default') {
            return coords;
        }
    }

    // Default: Check hash of text to pick a random MAJOR CITY
    // This distributes "Generic/Crypto/Pop Culture" markets across the world
    // making the map look active everywhere instead of one pile in Kansas.
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % MAJOR_CITIES.length;

    return MAJOR_CITIES[index];
}
