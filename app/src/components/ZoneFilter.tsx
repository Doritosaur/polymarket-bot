import { useState } from 'react';
import { Globe, X } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Major geographical zones with their approximate bounding boxes
const ZONES = [
    { id: 'north-america', name: 'North America', lng: -100, lat: 40, zoom: 3 },
    { id: 'south-america', name: 'South America', lng: -60, lat: -15, zoom: 3 },
    { id: 'europe', name: 'Europe', lng: 10, lat: 50, zoom: 4 },
    { id: 'africa', name: 'Africa', lng: 20, lat: 0, zoom: 3 },
    { id: 'asia', name: 'Asia', lng: 100, lat: 35, zoom: 3 },
    { id: 'middle-east', name: 'Middle East', lng: 45, lat: 30, zoom: 4 },
    { id: 'oceania', name: 'Oceania', lng: 140, lat: -25, zoom: 4 },
    { id: 'global', name: 'Global View', lng: 0, lat: 20, zoom: 1.5 },
];

interface ZoneFilterProps {
    onSelectZone: (lng: number, lat: number, zoom: number) => void;
}

export function ZoneFilter({ onSelectZone }: ZoneFilterProps) {
    const [selectedZone, setSelectedZone] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (zone: typeof ZONES[0]) => {
        setSelectedZone(zone.id);
        onSelectZone(zone.lng, zone.lat, zone.zoom);
        setIsOpen(false);
    };

    const handleReset = () => {
        setSelectedZone(null);
        onSelectZone(0, 20, 1.5); // Reset to default view
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={`
                        h-7 text-xs px-3 font-mono
                        border-primary/50 text-primary bg-black/80 backdrop-blur-md hover:bg-primary/20 hover:text-white
                        ${selectedZone ? 'bg-primary/20 shadow-[0_0_10px_rgba(0,255,159,0.3)]' : ''}
                    `}
                >
                    <Globe className="w-3 h-3 mr-2" />
                    {selectedZone
                        ? ZONES.find(z => z.id === selectedZone)?.name.toUpperCase()
                        : 'ZONES'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-black/90 border-primary backdrop-blur-md p-0" align="end">
                <div className="flex flex-col">
                    {/* Header */}
                    <div className="p-3 border-b border-primary/30 flex items-center justify-between bg-primary/10">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary font-mono">
                            Region_Zones //
                        </span>
                        {selectedZone && (
                            <button
                                onClick={handleReset}
                                className="text-[10px] font-mono text-destructive hover:text-white border border-destructive px-2 py-0.5 uppercase flex items-center gap-1 transition-colors"
                            >
                                <X className="w-3 h-3" /> Reset
                            </button>
                        )}
                    </div>

                    {/* Zone List */}
                    <div className="p-3">
                        <div className="flex flex-wrap gap-2">
                            {ZONES.map((zone) => {
                                const isSelected = selectedZone === zone.id;
                                return (
                                    <Badge
                                        key={zone.id}
                                        variant="outline"
                                        onClick={() => handleSelect(zone)}
                                        className={`
                                            cursor-pointer select-none transition-all duration-200 font-mono text-[10px]
                                            ${isSelected
                                                ? 'bg-primary text-black border-primary font-bold shadow-[0_0_10px_rgba(0,255,159,0.5)]'
                                                : 'bg-transparent text-primary/70 border-primary/30 hover:border-primary hover:text-primary'
                                            }
                                        `}
                                    >
                                        {zone.name}
                                    </Badge>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
