import { Card, CardContent } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import type { DisplayMarket } from "../store/marketStore";

interface MarketCardProps {
    market: DisplayMarket;
}

export function MarketCard({ market }: MarketCardProps) {
    const isUp = market.yesPrice > 0.5; // Simple bullish/bearish check
    const color = isUp ? "#10b981" : "#ef4444"; // Emerald vs Red

    return (
        <Card className="bg-neutral-900 border-neutral-800 overflow-hidden hover:border-neutral-700 transition-colors group">
            {/* Compact Header */}
            <div className="p-3 pb-1 flex gap-2">
                <img
                    src={market.image}
                    alt="Market Icon"
                    className="w-8 h-8 rounded-full object-cover bg-neutral-800 shrink-0"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-tight text-neutral-100 line-clamp-2" title={market.question}>
                        {market.question}
                    </h3>
                    <p className="text-[10px] text-neutral-500 truncate mt-0.5">{market.slug}</p>
                </div>
            </div>

            <CardContent className="p-3 pt-0">
                <div className="flex items-end justify-between mb-2">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Yes</span>
                        <span className={`text-lg font-bold tracking-tight ${isUp ? 'text-emerald-400' : 'text-neutral-200'}`}>
                            {(market.yesPrice * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">No</span>
                        <span className="text-sm text-neutral-500 font-mono">
                            {(market.noPrice * 100).toFixed(1)}%
                        </span>
                    </div>
                </div>

                {/* Compact Sparkline Chart */}
                <div className="h-10 -mx-3 -mb-3 opacity-50 grayscale group-hover:grayscale-0 transition-all duration-500">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={market.history}>
                            <defs>
                                <linearGradient id={`gradient-${market.conditionId}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <YAxis domain={[0, 1]} hide />
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke={color}
                                fill={`url(#gradient-${market.conditionId})`}
                                strokeWidth={1.5}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
