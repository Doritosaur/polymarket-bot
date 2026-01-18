// Maps Zone IDs to Country Names
export const ZONE_MAPPING: Record<string, string[]> = {
    'north-america': ['USA', 'Canada', 'Mexico', 'United States'],
    'south-america': ['Brazil', 'Argentina', 'Colombia', 'Venezuela'],
    'europe': ['UK', 'France', 'Germany', 'Spain', 'Italy', 'Netherlands', 'Switzerland', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Ukraine', 'Russia', 'Portugal', 'Greece', 'Belgium', 'Austria', 'Ireland', 'Hungary', 'Albania'],
    'africa': ['Nigeria', 'South Africa', 'Egypt', 'Kenya', 'Morocco', 'Algeria'],
    'asia': ['China', 'Japan', 'India', 'South Korea', 'Indonesia', 'Thailand', 'Vietnam', 'Philippines', 'Malaysia', 'Singapore', 'Taiwan', 'Pakistan', 'Bangladesh', 'Afghanistan'],
    'middle-east': ['UAE', 'Saudi Arabia', 'Israel', 'Iran', 'Iraq', 'Turkey', 'Syria', 'Lebanon'],
    'oceania': ['Australia', 'New Zealand'],
};

export function isCountryInZone(country: string, zoneId: string): boolean {
    if (!country || !zoneId) return false;
    const countries = ZONE_MAPPING[zoneId];
    return countries ? countries.includes(country) : false;
}
