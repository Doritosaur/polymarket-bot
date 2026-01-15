import { useMemo } from 'react';
import { useMarketStore } from "../store/marketStore";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function TagFilter() {
    const { marketMap, selectedTags, toggleTag, clearTags } = useMarketStore();

    // Compute unique tags and their counts
    const tagCounts = useMemo(() => {
        const counts = new Map<string, number>();
        marketMap.forEach(m => {
            if (m.tags && Array.isArray(m.tags)) {
                m.tags.forEach(tag => {
                    const normalizedTag = tag.trim();
                    if (normalizedTag) {
                        counts.set(normalizedTag, (counts.get(normalizedTag) || 0) + 1);
                    }
                });
            }
        });

        // Convert to array and sort by count (descending)
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50); // Limit to top 50 tags to avoid clutter
    }, [marketMap.size]); // Re-compute only when market count changes

    if (tagCounts.length === 0) return null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={`
                        h-7 text-xs px-3
                        border-primary/50 text-primary/50 bg-black/80 backdrop-blur-md hover:bg-primary/10 hover:text-primary
                        data-[state=open]:bg-primary/10 data-[state=open]:text-primary
                        ${selectedTags.size > 0 ? 'bg-primary/20 shadow-[0_0_10px_rgba(0,255,159,0.3)]' : ''}
                    `}
                >
                    <Filter className="w-3 h-3 mr-2" />
                    FILTERS {selectedTags.size > 0 && `(${selectedTags.size})`}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-black/90 border-primary backdrop-blur-md p-0" align="end">
                <div className="flex flex-col max-h-[400px]">
                    {/* Header */}
                    <div className="p-3 border-b border-primary/30 flex items-center justify-between bg-primary/10 shrink-0">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary font-mono">
                            Filter_Zones //
                        </span>
                        {selectedTags.size > 0 && (
                            <button
                                onClick={clearTags}
                                className="text-[10px] font-mono text-destructive hover:text-white border border-destructive px-2 py-0.5 uppercase flex items-center gap-1 transition-colors"
                            >
                                <X className="w-3 h-3" /> Clear
                            </button>
                        )}
                    </div>

                    {/* Tags Container */}
                    <div className="overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-black/50">
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
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
