/**
 * SignalConfigPanel - User-configurable signal thresholds
 * Allows users to set alert thresholds for each signal type
 */
import { useState, useEffect } from 'react';
import { useSignalStore, SIGNAL_TYPES, SEVERITY_LEVELS, type SignalType, type Severity } from '../store/signalStore';
import { Settings, Save, RotateCcw } from 'lucide-react';
import { Badge } from './ui/badge';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from './ui/sheet';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

// Default thresholds
const DEFAULT_CONFIG = {
    whaleThreshold: 1000,
    velocityThreshold: 5,
    volumeMultiplier: 2,
    minSeverity: 'low' as Severity
};

// Signal type configurations
const SIGNAL_CONFIGS: Record<SignalType, { label: string, unit: string, min: number, max: number, step: number }> = {
    [SIGNAL_TYPES.WHALE_ACTIVITY]: {
        label: 'Whale Threshold',
        unit: 'USD',
        min: 100,
        max: 100000,
        step: 100
    },
    [SIGNAL_TYPES.PRICE_VELOCITY]: {
        label: 'Price Velocity',
        unit: '%/min',
        min: 1,
        max: 50,
        step: 0.5
    },
    [SIGNAL_TYPES.VOLUME_ANOMALY]: {
        label: 'Volume Multiplier',
        unit: 'x avg',
        min: 1.5,
        max: 10,
        step: 0.5
    },
    [SIGNAL_TYPES.REGIONAL_SURGE]: {
        label: 'Min Active Markets',
        unit: 'markets',
        min: 2,
        max: 20,
        step: 1
    },
    [SIGNAL_TYPES.MARKET_REVERSAL]: {
        label: 'Min Price Change',
        unit: '%',
        min: 1,
        max: 30,
        step: 1
    }
};

interface SignalConfigState {
    [key: string]: number;
}

export function SignalConfigPanel() {
    const { filters, setMinSeverity, setTypeFilter } = useSignalStore();
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState<SignalConfigState>({
        [SIGNAL_TYPES.WHALE_ACTIVITY]: DEFAULT_CONFIG.whaleThreshold,
        [SIGNAL_TYPES.PRICE_VELOCITY]: DEFAULT_CONFIG.velocityThreshold,
        [SIGNAL_TYPES.VOLUME_ANOMALY]: DEFAULT_CONFIG.volumeMultiplier,
        [SIGNAL_TYPES.REGIONAL_SURGE]: 3,
        [SIGNAL_TYPES.MARKET_REVERSAL]: 5
    });

    const handleSliderChange = (type: SignalType, value: number) => {
        setConfig(prev => ({ ...prev, [type]: value }));
    };

    const handleReset = () => {
        setConfig({
            [SIGNAL_TYPES.WHALE_ACTIVITY]: DEFAULT_CONFIG.whaleThreshold,
            [SIGNAL_TYPES.PRICE_VELOCITY]: DEFAULT_CONFIG.velocityThreshold,
            [SIGNAL_TYPES.VOLUME_ANOMALY]: DEFAULT_CONFIG.volumeMultiplier,
            [SIGNAL_TYPES.REGIONAL_SURGE]: 3,
            [SIGNAL_TYPES.MARKET_REVERSAL]: 5
        });
        setMinSeverity('low');
    };

    const handleSave = () => {
        // In a real app, this would persist to backend via API
        // For now, we just store in local state and could use localStorage
        localStorage.setItem('signalConfig', JSON.stringify(config));
        setIsOpen(false);
    };

    // Load saved config on mount
    useEffect(() => {
        const saved = localStorage.getItem('signalConfig');
        if (saved) {
            try {
                setConfig(JSON.parse(saved));
            } catch (e) {
                console.warn('Failed to load saved signal config');
            }
        }
    }, []);

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <button
                    className="p-2 text-primary/50 hover:text-primary hover:bg-primary/10 transition"
                    title="Signal Settings"
                >
                    <Settings className="w-5 h-5" />
                </button>
            </SheetTrigger>
            <SheetContent className="bg-black border-l-2 border-primary w-80 p-0">
                <SheetHeader className="px-4 py-3 border-b border-primary/30 bg-primary/10">
                    <SheetTitle className="text-primary font-mono uppercase tracking-wider flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Signal Config
                    </SheetTitle>
                    <SheetDescription className="text-primary/70 font-mono text-xs">
                        Configure alert thresholds for each signal type
                    </SheetDescription>
                </SheetHeader>

                <div className="p-4 space-y-8 h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin">
                    {/* Minimum Severity */}
                    <div className="space-y-2">
                        <label className="text-xs text-primary/70 uppercase tracking-wider">
                            Minimum Alert Severity
                        </label>
                        <div className="flex gap-1">
                            {SEVERITY_LEVELS.map(severity => (
                                <button
                                    key={severity}
                                    onClick={() => setMinSeverity(severity)}
                                    className={`
                                        flex-1 px-2 py-1.5 text-[10px] uppercase border rounded-none transition
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

                    {/* Signal Type Toggles */}
                    <div className="space-y-2">
                        <label className="text-xs text-primary/70 uppercase tracking-wider">
                            Enabled Signal Types
                        </label>
                        <div className="grid grid-cols-2 gap-1">
                            {Object.entries(SIGNAL_TYPES).map(([key, type]) => {
                                const isActive = filters.types.has(type);
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setTypeFilter(type, !isActive)}
                                        className={`
                                            px-2 py-1.5 text-[10px] border rounded-none transition
                                            ${isActive
                                                ? 'border-primary text-primary bg-primary/20'
                                                : 'border-primary/30 text-primary/50 hover:border-primary/50'
                                            }
                                        `}
                                    >
                                        {SIGNAL_CONFIGS[type].label.split(' ')[0]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Threshold Sliders */}
                    <div className="space-y-4">
                        <label className="text-xs text-primary/70 uppercase tracking-wider">
                            Thresholds
                        </label>

                        {Object.entries(SIGNAL_CONFIGS).map(([type, cfg]) => (
                            <div key={type} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-primary/80">{cfg.label}</span>
                                    <Badge variant="outline" className="text-[10px] border-primary text-primary">
                                        {config[type]} {cfg.unit}
                                    </Badge>
                                </div>
                                <Slider
                                    value={[config[type]]}
                                    min={cfg.min}
                                    max={cfg.max}
                                    step={cfg.step}
                                    onValueChange={(vals) => handleSliderChange(type as SignalType, vals[0])}
                                    className="w-full py-1"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-6 mt-auto border-t border-primary/20 bg-black/90 sticky bottom-0 z-10">
                        <Button
                            variant="outline"
                            onClick={handleReset}
                            className="flex-1 border-primary/50 text-primary hover:bg-primary/10 rounded-none"
                        >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reset
                        </Button>
                        <Button
                            onClick={handleSave}
                            className="flex-1 bg-primary text-black hover:bg-primary/90 rounded-none"
                        >
                            <Save className="w-3 h-3 mr-1" />
                            Save
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
