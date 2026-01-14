// Unused imports removed - colors defined locally
import { TOOLTIP_THEME } from '@/config';
import type { DisplayMarket } from '../store/marketStore';

// --- Types ---
interface GlowData {
    position: [number, number];
    timestamp: number | undefined;
}



export const formatMoney = (amount: number) => {
    if (!amount) return '$0';
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${Math.round(amount)}`;
};

// --- Data Helpers ---

/**
 * Generates data for the Glow Layer based on market activity.
 */
export const getGlowData = (
    marketMap: Map<string, DisplayMarket>,
    layoutFeatures: any[],
    now: number
): GlowData[] => {
    const glows: GlowData[] = [];

    layoutFeatures.forEach(lf => {
        const props = lf.properties || lf; // Handle GeoJSON or flat objects
        const group = props.groupMarkets || [{ conditionId: props.conditionId }];

        let newestTradeTime = 0;

        for (const item of group) {
            const m = marketMap.get(item.conditionId);
            if (m && m.lastTradeTime && m.lastTradeTime > newestTradeTime) {
                newestTradeTime = m.lastTradeTime;
            }
        }

        const timeSinceTrade = now - newestTradeTime;
        const isGlowing = timeSinceTrade < 5000;

        if (isGlowing) {
            glows.push({
                position: lf.geometry.coordinates,
                timestamp: newestTradeTime,
            });
        }
    });
    return glows;
};


/**
 * Generates the HTML string for the Map Tooltip, styled to match app components.
 */
export const getTooltipHtml = (object: any): string | null => {
    if (!object || object.properties?.cluster) return null;

    const mp = object.properties;
    const markets = mp.groupMarkets || [mp];
    const marketCount = markets.length;

    // Use eventSlug as the main title
    const title = mp.eventSlug || mp.slug || 'Market';

    // Calculate aggregate stats
    const avgYes = markets.reduce((sum: number, m: any) => sum + (m.yesPrice || 0), 0) / marketCount;
    const avgYesP = (avgYes * 100).toFixed(0);
    const avgNoP = ((1 - avgYes) * 100).toFixed(0);
    const isUp = avgYes > 0.5;

    const totalVolume = markets.reduce((sum: number, m: any) => sum + (m.volume || 0), 0);
    const totalLiquidity = markets.reduce((sum: number, m: any) => sum + (m.liquidity || 0), 0);

    // For single market, show its slug; for multi-market events, show count
    const contentHtml = marketCount > 1
        ? `
            <div style="
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 10px; color: ${TOOLTIP_THEME.yesText}; opacity: 0.6; text-transform: uppercase;">Markets</span>
                    <span style="font-size: 14px; font-weight: 700; color: ${TOOLTIP_THEME.yesText};">${marketCount}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 10px; color: ${TOOLTIP_THEME.yesText}; opacity: 0.6; text-transform: uppercase;">Volume</span>
                    <span style="font-size: 14px; font-weight: 700; color: ${TOOLTIP_THEME.yesText};">${formatMoney(totalVolume)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 10px; color: ${TOOLTIP_THEME.yesText}; opacity: 0.6; text-transform: uppercase;">Liquidity</span>
                    <span style="font-size: 14px; font-weight: 700; color: ${TOOLTIP_THEME.yesText};">${formatMoney(totalLiquidity)}</span>
                </div>
                <div style="height: 1px; background: rgba(16, 185, 129, 0.2); margin: 4px 0;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 10px; color: ${TOOLTIP_THEME.yesText}; opacity: 0.6; text-transform: uppercase;">Avg YES</span>
                    <span style="font-size: 14px; font-weight: 700; color: ${isUp ? TOOLTIP_THEME.yesText : TOOLTIP_THEME.noText};">${avgYesP}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 10px; color: ${TOOLTIP_THEME.yesText}; opacity: 0.6; text-transform: uppercase;">Avg NO</span>
                    <span style="font-size: 14px; font-weight: 700; color: ${TOOLTIP_THEME.noText};">${avgNoP}%</span>
                </div>
            </div>
        `
        : `
            <div style="padding: 12px;">
                <div style="font-size: 11px; color: ${TOOLTIP_THEME.yesText}; opacity: 0.7; margin-bottom: 8px; line-clamp: 2; overflow: hidden;">
                    ${markets[0].slug}
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size: 9px; color: ${TOOLTIP_THEME.yesText}; opacity: 0.5; text-transform: uppercase;">VOL</span>
                        <span style="font-size: 12px; font-weight: 700; color: ${TOOLTIP_THEME.yesText};">${formatMoney(totalVolume)}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end;">
                        <span style="font-size: 9px; color: ${TOOLTIP_THEME.yesText}; opacity: 0.5; text-transform: uppercase;">LIQ</span>
                        <span style="font-size: 12px; font-weight: 700; color: ${TOOLTIP_THEME.yesText};">${formatMoney(totalLiquidity)}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 16px;">
                    <div>
                        <span style="font-size: 10px; color: ${TOOLTIP_THEME.yesText}; opacity: 0.5; text-transform: uppercase;">YES</span>
                        <div style="font-size: 14px; font-weight: 700; color: ${isUp ? TOOLTIP_THEME.yesText : TOOLTIP_THEME.textSecondary};">${avgYesP}%</div>
                    </div>
                    <div>
                        <span style="font-size: 10px; color: ${TOOLTIP_THEME.yesText}; opacity: 0.5; text-transform: uppercase;">NO</span>
                        <div style="font-size: 14px; font-weight: 700; color: ${TOOLTIP_THEME.noText};">${avgNoP}%</div>
                    </div>
                </div>
            </div>
        `;

    return `
        <div style="
            background: ${TOOLTIP_THEME.background};
            border: 2px solid ${TOOLTIP_THEME.yesText};
            padding: 0;
            border-radius: 0;
            color: #fff;
            font-family: 'JetBrains Mono', 'Courier New', monospace;
            width: 240px;
            overflow: hidden;
        ">
            <!-- Header -->
            <div style="
                padding: 10px 12px;
                border-bottom: 1px solid rgba(16, 185, 129, 0.3);
                background: rgba(16, 185, 129, 0.1);
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                <div style="
                    font-size: 11px;
                    font-weight: 700; 
                    color: ${TOOLTIP_THEME.yesText};
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                ">
                    ${title}
                </div>
                ${marketCount > 1 ? `
                    <div style="
                        font-size: 10px;
                        color: ${TOOLTIP_THEME.yesText};
                        border: 1px solid ${TOOLTIP_THEME.yesText};
                        padding: 2px 6px;
                    ">
                        ${marketCount} MKTS
                    </div>
                ` : ''}
            </div>
            
            <!-- Content -->
            ${contentHtml}

            <!-- Footer -->
            <div style="
                padding: 8px 12px;
                border-top: 1px solid rgba(16, 185, 129, 0.2);
                font-size: 10px; 
                color: ${TOOLTIP_THEME.textSecondary}; 
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span style="${mp.isPinned ? `color: ${TOOLTIP_THEME.pinned};` : ''}">
                    ${mp.isPinned ? '★ PINNED' : ''}
                </span>
                <span style="color: ${TOOLTIP_THEME.yesText}; opacity: 0.8;">
                    [ CLICK FOR DETAILS ]
                </span>
            </div>
        </div>
    `;
};
