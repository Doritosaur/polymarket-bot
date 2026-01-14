// Unused imports removed - colors defined locally
import { TOOLTIP_THEME } from '@/config';
import type { DisplayMarket } from '../store/marketStore';

// --- Types ---
interface GlowData {
    position: [number, number];
    timestamp: number | undefined;
}

interface ArcData {
    source: [number, number];
    target: [number, number];
}

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
        const m = marketMap.get(lf.conditionId);
        if (!m) return;

        const timeSinceTrade = m.lastTradeTime ? now - m.lastTradeTime : 99999;
        const isGlowing = timeSinceTrade < 5000;

        if (isGlowing) {
            glows.push({
                position: lf.geometry.coordinates,
                timestamp: m.lastTradeTime,
            });
        }
    });
    return glows;
};

/**
 * Generates arc connection data between pinned markets.
 */
export const getArcData = (
    clusters: any[],
    pinnedIds: Set<string>
): ArcData[] => {
    const pinnedCoords: [number, number][] = [];

    clusters.filter(c => !c.properties.cluster).forEach(c => {
        if (pinnedIds.has(c.properties.conditionId)) {
            pinnedCoords.push(c.geometry.coordinates);
        }
    });

    const arcs: ArcData[] = [];
    for (let i = 0; i < pinnedCoords.length; i++) {
        for (let j = i + 1; j < pinnedCoords.length; j++) {
            arcs.push({ source: pinnedCoords[i], target: pinnedCoords[j] });
        }
    }
    return arcs;
};
/**
 * Generates the HTML string for the Map Tooltip, styled to match app components.
 */
export const getTooltipHtml = (object: any): string | null => {
    if (!object || object.properties?.cluster) return null;

    const mp = object.properties;
    const markets = mp.groupMarkets || [mp];

    // Use eventSlug as the main title
    const title = mp.eventSlug || mp.slug || 'Market';

    // Build list of markets matching MarketCard/WhaleFeed style
    const marketsHtml = markets.map((m: any, idx: number) => {
        const yesP = (m.yesPrice * 100).toFixed(1);
        const noP = (m.noPrice * 100).toFixed(1);
        const isUp = m.yesPrice > 0.5;
        const isLast = idx === markets.length - 1;
        return `
            <div style="
                display: flex; 
                align-items: flex-start; 
                gap: 8px; 
                padding: 8px 0; 
                ${!isLast ? `border-bottom: 1px solid rgba(16, 185, 129, 0.2);` : ''}
            ">
                <img src="${m.image}" 
                     style="
                         width: 32px; 
                         height: 32px; 
                         border-radius: 9999px;
                         background: #171717; 
                         object-fit: cover; 
                         flex-shrink: 0;
                     " 
                     onerror="this.style.display='none'"/>
                
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        font-size: 12px;
                        font-weight: 600; 
                        color: ${TOOLTIP_THEME.yesText};
                        opacity: 0.5; 
                        line-height: 1.3;
                        margin-bottom: 4px;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                    ">
                        ${m.slug}
                    </div>
                    <div style="display: flex; gap: 12px; align-items: baseline;">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 10px; color: ${TOOLTIP_THEME.yesText}; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Yes</span>
                            <span style="font-size: 12px; font-weight: 700; color: ${isUp ? TOOLTIP_THEME.yesText : TOOLTIP_THEME.noText};">${yesP}%</span>
                        </div>
                        <div style="display: flex; flex-direction: column; text-align: right;">
                            <span style="font-size: 10px; color: ${TOOLTIP_THEME.yesText}; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">No</span>
                            <span style="font-size: 12px; font-family: 'JetBrains Mono', monospace; color: ${TOOLTIP_THEME.noText};">${noP}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div style="
            background: ${TOOLTIP_THEME.background};
            border: 2px solid ${TOOLTIP_THEME.yesText};
            padding: 0;
            border-radius: 0;
            color: #fff;
            font-family: 'JetBrains Mono', 'Courier New', monospace;
            width: 320px;
            max-height: 400px;
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
                    font-size: 12px;
                    font-weight: 700; 
                    color: ${TOOLTIP_THEME.yesText};
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                ">
                    ${title}
                </div>
                <div style="
                    font-size: 10px;
                    color: ${TOOLTIP_THEME.yesText};
                    border: 1px solid ${TOOLTIP_THEME.yesText};
                    padding: 2px 6px;
                ">
                    ${markets.length} MKT${markets.length > 1 ? 'S' : ''}
                </div>
            </div>
            
            <!-- Markets List -->
            <div style="
                padding: 4px 12px; 
                max-height: 300px; 
                overflow-y: auto;
            ">
                ${marketsHtml}
            </div>

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
                <span style="${mp.isPinned ? `color: ${TOOLTIP_THEME.yesText};` : ''}">
                    ${mp.isPinned ? '★ PINNED' : ''}
                </span>
                <span style="color: ${TOOLTIP_THEME.yesText}; opacity: 0.8;">
                    [ CLICK TO ${mp.isPinned ? 'UNPIN' : 'PIN'} ]
                </span>
            </div>
        </div>
    `;
};
