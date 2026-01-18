/**
 * SignalFeed - Real-time signal display component
 * Shows filtered signals with severity-based styling and fly-to-location functionality
 */
import { useState, useMemo, useEffect } from 'react';
import {
    useSignalStore,
    SIGNAL_TYPES,
    SEVERITY_LEVELS,
    type Signal,
    type SignalType,
    type Severity
} from '../store/signalStore';
import { Badge } from './ui/badge';
import {
    Zap,          // Velocity
    TrendingUp,   // Whale/Volume
    Users,        // Regional
    RefreshCw,    // Reversal
    AlertTriangle,
    Filter,
    Clock
} from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from './ui/popover';

// Signal type icons and colors
const SIGNAL_CONFIG: Record<SignalType, { icon: typeof Zap, color: string, label: string }> = {
    [SIGNAL_TYPES.VOLUME_ANOMALY]: {
        icon: TrendingUp,
        color: 'text-blue-400 bg-blue-400/20',
        label: 'Volume Spike'
    },
    [SIGNAL_TYPES.PRICE_VELOCITY]: {
        icon: Zap,
        color: 'text-orange-400 bg-orange-400/20',
        label: 'Price Velocity'
    },
    [SIGNAL_TYPES.REGIONAL_SURGE]: {
        icon: Users,
        color: 'text-purple-400 bg-purple-400/20',
        label: 'Regional Surge'
    },
    [SIGNAL_TYPES.WHALE_ACTIVITY]: {
        icon: TrendingUp,
        color: 'text-primary bg-primary/20',
        label: 'Whale Alert'
    },
    [SIGNAL_TYPES.MARKET_REVERSAL]: {
        icon: RefreshCw,
        color: 'text-yellow-400 bg-yellow-400/20',
        label: 'Reversal'
    }
};

// Severity colors
const SEVERITY_COLORS: Record<Severity, string> = {
    low: 'border-primary/30',
    medium: 'border-yellow-400/50',
    high: 'border-orange-400/70',
    critical: 'border-red-500 animate-pulse'
};

function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
}

function formatValue(type: SignalType, value: number): string {
    if (type === SIGNAL_TYPES.WHALE_ACTIVITY || type === SIGNAL_TYPES.VOLUME_ANOMALY) {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
        return `$${value.toFixed(0)}`;
    }
    if (type === SIGNAL_TYPES.PRICE_VELOCITY) {
        return `${value.toFixed(1)}%/min`;
    }
    if (type === SIGNAL_TYPES.REGIONAL_SURGE) {
        return `${value} markets`;
    }
    return value.toFixed(2);
}

interface SignalItemProps {
    signal: Signal;
    isNew: boolean;
    onFlyTo?: (lat: number, lng: number) => void;
}

function SignalItem({ signal, isNew, onFlyTo }: SignalItemProps) {
    const config = SIGNAL_CONFIG[signal.type];
    const Icon = config.icon;
    const severityColor = SEVERITY_COLORS[signal.severity];

    const handleClick = () => {
        if (signal.coordinates && onFlyTo) {
            onFlyTo(signal.coordinates.lat, signal.coordinates.lng);
        }
    };

    return (
        <div
            className={`
                p-3 border-l-2 ${severityColor} bg-black/50 
                cursor-pointer hover:bg-primary/10 transition-all
                ${isNew ? 'ring-1 ring-primary/50' : ''}
            `}
            onClick={handleClick}
        >
            <div className="flex items-start gap-3">
                <div className={`p-1.5 rounded ${config.color}`}>
                    <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className={`text-[10px] ${config.color} border-current`}>
                            {config.label}
                        </Badge>
                        <span className="text-[10px] text-primary/50 shrink-0">
                            {formatTimeAgo(signal.timestamp)}
                        </span>
                    </div>

                    <p className="text-xs text-primary/80 mt-1 truncate">
                        {signal.metadata.marketTitle || signal.region}
                    </p>

                    <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold text-primary">
                            {formatValue(signal.type, signal.value)}
                        </span>
                        {signal.metadata.direction && (
                            <span className={`text-[10px] ${signal.metadata.direction === 'up' || signal.metadata.direction === 'bullish'
                                ? 'text-green-400'
                                : signal.metadata.direction === 'down' || signal.metadata.direction === 'bearish'
                                    ? 'text-red-400'
                                    : 'text-primary/50'
                                }`}>
                                {signal.metadata.direction.toUpperCase()}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function SignalFeed() {
    const signals = useSignalStore(state => state.signals);
    const newSignals = useSignalStore(state => state.newSignals);
    const filters = useSignalStore(state => state.filters);
    const setTypeFilter = useSignalStore(state => state.setTypeFilter);
    const setMinSeverity = useSignalStore(state => state.setMinSeverity);
    const clearFilters = useSignalStore(state => state.clearFilters);
    const clearOldSignals = useSignalStore(state => state.clearOldSignals);
    const signalDuration = useSignalStore(state => state.signalDuration);
    const setSignalDuration = useSignalStore(state => state.setSignalDuration);

    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Get filtered signals
    const filteredSignals = useMemo(() => {
        const { types, minSeverity, regions } = filters;
        const severityIndex = SEVERITY_LEVELS.indexOf(minSeverity);

        return signals.filter(signal => {
            if (!types.has(signal.type)) return false;
            const signalSeverityIndex = SEVERITY_LEVELS.indexOf(signal.severity);
            if (signalSeverityIndex < severityIndex) return false;
            if (regions.size > 0 && !regions.has(signal.region)) return false;
            return true;
        });
    }, [signals, filters]);

    // Cleanup old signals periodically
    useEffect(() => {
        const interval = setInterval(() => {
            clearOldSignals();
        }, 60000);
        return () => clearInterval(interval);
    }, [clearOldSignals]);

    const handleFlyTo = (lat: number, lng: number) => {
        // Dispatch custom event for MapController to handle
        window.dispatchEvent(new CustomEvent('flyToLocation', {
            detail: { lat, lng, zoom: 5 }
        }));
    };

    const activeFiltersCount =
        (Object.values(SIGNAL_TYPES).length - filters.types.size) +
        (filters.minSeverity !== 'low' ? 1 : 0) +
        filters.regions.size;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-primary/20 flex justify-between items-center bg-primary/5">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold text-primary uppercase tracking-wider">Signals</span>
                    {filteredSignals.length > 0 && (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary">
                            {filteredSignals.length}
                        </Badge>
                    )}
                </div>

                <div className="flex gap-2">
                    {/* Duration Selector */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="p-1.5 hover:bg-primary/20 rounded transition text-primary/70 hover:text-primary">
                                <Clock className="w-4 h-4" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 bg-black/95 border border-primary/30 p-2 backdrop-blur-md">
                            <div className="space-y-1">
                                <div className="text-xs font-bold text-primary/50 px-2 py-1 mb-1">DURATION</div>
                                {[2, 5, 10].map(mins => (
                                    <button
                                        key={mins}
                                        onClick={() => setSignalDuration(mins * 60000)}
                                        className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-primary/20 transition flex justify-between items-center ${signalDuration === mins * 60000 ? 'text-primary bg-primary/10' : 'text-primary/70'
                                            }`}
                                    >
                                        <span>{mins} Minutes</span>
                                        {signalDuration === mins * 60000 && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Filter Selector */}
                    <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <PopoverTrigger asChild>
                            <button className="relative p-1.5 hover:bg-primary/20 rounded transition">
                                <Filter className="w-4 h-4 text-primary" />
                                {activeFiltersCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary text-black text-[8px] font-bold rounded-full flex items-center justify-center">
                                        {activeFiltersCount}
                                    </span>
                                )}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 bg-black border-2 border-primary p-3" align="end">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-primary uppercase tracking-wider">Filters</span>
                                    <button
                                        onClick={clearFilters}
                                        className="text-[10px] text-primary/50 hover:text-primary"
                                    >
                                        Reset
                                    </button>
                                </div>

                                {/* Signal Type Filters */}
                                <div className="space-y-2">
                                    <span className="text-[10px] text-primary/70 uppercase">Signal Types</span>
                                    <div className="flex flex-wrap gap-1">
                                        {Object.entries(SIGNAL_TYPES).map(([key, type]) => {
                                            const isActive = filters.types.has(type);
                                            const config = SIGNAL_CONFIG[type];
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => setTypeFilter(type, !isActive)}
                                                    className={`
                                                    px-2 py-0.5 text-[10px] border rounded-none transition
                                                    ${isActive
                                                            ? 'border-primary text-primary bg-primary/20'
                                                            : 'border-primary/30 text-primary/50 hover:border-primary/50'
                                                        }
                                                `}
                                                >
                                                    {config.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Severity Filter */}
                                <div className="space-y-2">
                                    <span className="text-[10px] text-primary/70 uppercase">Min Severity</span>
                                    <div className="flex gap-1">
                                        {SEVERITY_LEVELS.map(severity => (
                                            <button
                                                key={severity}
                                                onClick={() => setMinSeverity(severity)}
                                                className={`
                                                flex-1 px-2 py-1 text-[10px] uppercase border rounded-none transition
                                                ${filters.minSeverity === severity
                                                        ? 'border-primary text-primary bg-primary/20'
                                                        : 'border-primary/30 text-primary/50 hover:border-primary/50'
                                                    }
                                            `}
                                            >
                                                {severity}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Signal List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredSignals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-primary/40 p-4">
                        <AlertTriangle className="w-8 h-8 mb-2" />
                        <p className="text-xs text-center">No signals detected</p>
                        <p className="text-[10px] text-center mt-1">Waiting for market activity...</p>
                    </div>
                ) : (
                    <div className="divide-y divide-primary/10">
                        {filteredSignals.map(signal => (
                            <SignalItem
                                key={signal.id}
                                signal={signal}
                                isNew={newSignals.has(signal.id)}
                                onFlyTo={handleFlyTo}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
