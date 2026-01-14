import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useMarketStore } from '../store/marketStore';
import { getMarketCoordinates } from '../utils/GeoMapper';
import { Input } from '@/components/ui/input';
import Fuse from 'fuse.js';

interface MarketSearchProps {
    onSelectMarket: (lng: number, lat: number, zoom: number) => void;
}

export function MarketSearch({ onSelectMarket }: MarketSearchProps) {
    const marketMap = useMarketStore(s => s.marketMap);
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Create Fuse.js instance for fuzzy search
    const fuse = useMemo(() => {
        const markets = Array.from(marketMap.values());
        return new Fuse(markets, {
            keys: [
                { name: 'slug', weight: 0.3 },
                { name: 'eventSlug', weight: 0.2 }
            ],
            threshold: 0.4, // 0 = exact match, 1 = match anything
            includeScore: true,
            ignoreLocation: true, // Search entire string, not just beginning
            minMatchCharLength: 2
        });
    }, [marketMap]);

    // Fuzzy search results with Event Aggregation
    const results = useMemo(() => {
        if (!query.trim() || query.length < 2) return [];

        const searchResults = fuse.search(query);
        const aggregated = new Map<string, any[]>();

        // Group matches by Event Slug
        searchResults.forEach(r => {
            const m = r.item as any;
            const key = m.eventSlug || m.slug;
            if (!aggregated.has(key)) aggregated.set(key, []);
            aggregated.get(key)!.push(m);
        });

        // Convert back to array, select representative market, and limit
        return Array.from(aggregated.entries())
            .map(([key, markets]) => ({
                representative: markets[0],
                count: markets.length,
                key
            }))
            .slice(0, 8);
    }, [query, fuse]);

    const handleSelect = (item: { representative: any }) => {
        const market = item.representative;
        const coords = getMarketCoordinates(market.slug, market.tags);
        onSelectMarket(coords.lng, coords.lat, 20); // Zoom level 5 for focus
        setQuery('');
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Search Input with Icon */}
            <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-primary/50 pointer-events-none" />
                <Input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Search events..."
                    className="h-7 w-52 pl-9 pr-8 bg-black border-2 border-primary/50 hover:border-primary focus-visible:border-primary text-primary placeholder:text-primary/30 font-mono"
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery('');
                            inputRef.current?.focus();
                        }}
                        className="absolute right-3 text-primary/50 hover:text-primary transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>

            {/* Results Dropdown */}
            {isOpen && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-black border-2 border-primary max-h-64 overflow-y-auto z-50 font-mono">
                    {results.map((item) => (
                        <button
                            key={item.key}
                            onClick={() => handleSelect(item)}
                            className="w-full text-left px-3 py-2 hover:bg-primary/10 border-b border-primary/20 last:border-b-0 transition-colors"
                        >
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-primary/90 truncate pr-2">
                                    {item.representative.eventSlug || item.representative.slug}
                                </div>
                                {item.count > 1 && (
                                    <div className="text-[10px] text-primary/50 border border-primary/30 px-1 rounded bg-primary/5 shrink-0">
                                        {item.count} MKTS
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* No Results */}
            {isOpen && query.trim().length >= 2 && results.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-black border-2 border-primary/50 px-3 py-4 text-center z-50">
                    <span className="text-xs text-primary/50 font-mono">No markets found</span>
                </div>
            )}
        </div>
    );
}
