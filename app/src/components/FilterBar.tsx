import { useMemo } from 'react';
import { useMarketStore } from "../store/marketStore";
import { Badge } from "@/components/ui/badge";
import { Filter, X, Activity, BarChart3 } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export function FilterBar() {
    const {
        marketMap,
        selectedTags,
        toggleTag,
        clearTags,
        minVolume,
        setMinVolume,
        tradeThreshold,
        setTradeThreshold
    } = useMarketStore();

    // Allowed main categories (Canonical names)
    const ALLOWED_TAGS_Y = useMemo(() => [
        'Politics', 'Sports', 'Crypto', 'Finance', 'Geopolitics',
        'Earnings', 'Tech', 'Culture', 'World', 'Economy',
        'Climate & Science', 'Elections'
    ], []);

    // Compute unique tags and their counts
    const tagCounts = useMemo(() => {
        const counts = new Map<string, number>();

        // Helper to find canonical tag
        const findCanonical = (tag: string) =>
            ALLOWED_TAGS_Y.find(t => t.toUpperCase() === tag.toUpperCase());

        marketMap.forEach(m => {
            if (minVolume > 0 && (m.volume || 0) < minVolume) return;

            if (m.tags && Array.isArray(m.tags)) {
                m.tags.forEach(tag => {
                    const originalTag = tag.trim();
                    const canonical = findCanonical(originalTag);

                    if (canonical) {
                        counts.set(canonical, (counts.get(canonical) || 0) + 1);
                    }
                });
            }
        });
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1]);
    }, [marketMap, minVolume, ALLOWED_TAGS_Y]);

    const activeFilterCount = selectedTags.size + (minVolume > 0 ? 1 : 0);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={`
                        h-7 text-xs px-3
                        border-primary/50 text-primary/50 bg-black/80 backdrop-blur-md hover:bg-primary/10 hover:text-primary
                        data-[state=open]:bg-primary/10 data-[state=open]:text-primary
                        ${activeFilterCount > 0 ? 'bg-primary/20 shadow-[0_0_10px_rgba(0,255,159,0.3)]' : ''}
                    `}
                >
                    <Filter className="w-3 h-3 mr-2" />
                    FILTERS {activeFilterCount > 0 && `(${activeFilterCount})`}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-black/95 border-primary backdrop-blur-md p-0" align="end">
                <div className="flex flex-col max-h-[600px]">
                    {/* Header */}
                    <div className="p-3 border-b border-primary/30 flex items-center justify-between bg-primary/10 shrink-0">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary font-mono">
                            Map_Filters //
                        </span>
                        {(selectedTags.size > 0 || minVolume > 0) && (
                            <button
                                onClick={() => { clearTags(); setMinVolume(0); }}
                                className="text-[10px] font-mono text-destructive hover:text-white border border-destructive px-2 py-0.5 uppercase flex items-center gap-1 transition-colors"
                            >
                                <X className="w-3 h-3" /> Reset All
                            </button>
                        )}
                    </div>

                    <div className="p-4 space-y-6 overflow-y-auto scrollbar-thin">

                        {/* 1. Market Volume Filter */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-primary/70 uppercase tracking-wider flex items-center gap-2">
                                    <BarChart3 className="w-3 h-3" /> Min Market Volume
                                </label>
                                <Badge variant="outline" className="text-[10px] border-primary text-primary font-mono">
                                    ${minVolume.toLocaleString()}
                                </Badge>
                            </div>
                            <Slider
                                value={[minVolume]}
                                min={0}
                                max={1000000}
                                step={10000}
                                onValueChange={(vals) => setMinVolume(vals[0])}
                                className="w-full"
                            />
                            <div className="flex justify-between text-[10px] text-primary/40 font-mono">
                                <span>$0</span>
                                <span>$1M+</span>
                            </div>
                        </div>

                        {/* 2. Trade Alert Threshold */}
                        <div className="space-y-3 pt-4 border-t border-primary/20">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-primary/70 uppercase tracking-wider flex items-center gap-2">
                                    <Activity className="w-3 h-3" /> Min Trade Alert
                                </label>
                                <Badge variant="outline" className="text-[10px] border-primary text-primary font-mono">
                                    ${tradeThreshold.toLocaleString()}
                                </Badge>
                            </div>
                            <Slider
                                value={[tradeThreshold]}
                                min={100}
                                max={10000}
                                step={100}
                                onValueChange={(vals) => setTradeThreshold(vals[0])}
                                className="w-full"
                            />
                        </div>

                        {/* 3. Tags Filter */}
                        <div className="space-y-3 pt-4 border-t border-primary/20">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-primary/70 uppercase tracking-wider flex items-center gap-2">
                                    Tags // ({tagCounts.length})
                                </label>
                                {selectedTags.size > 0 && (
                                    <button
                                        onClick={clearTags}
                                        className="text-[10px] font-mono text-primary/50 hover:text-primary px-1"
                                    >
                                        Clear Tags
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {tagCounts.map(([tag, count]) => {
                                    const isSelected = selectedTags.has(tag);
                                    return (
                                        <Badge
                                            key={tag}
                                            variant="outline"
                                            onClick={() => toggleTag(tag)}
                                            className={`
                                                cursor-pointer select-none transition-all duration-200 font-mono text-[10px]
                                                ${isSelected
                                                    ? 'bg-primary text-black border-primary font-bold shadow-[0_0_10px_rgba(0,255,159,0.5)]'
                                                    : 'bg-transparent text-primary/70 border-primary/30 hover:border-primary hover:text-primary'
                                                }
                                            `}
                                        >
                                            {tag} <span className="ml-1 opacity-50">({count})</span>
                                        </Badge>
                                    )
                                })}
                                {tagCounts.length === 0 && (
                                    <span className="text-xs text-primary/30 italic">No tags available for current selection</span>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
