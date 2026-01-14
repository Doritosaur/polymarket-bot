import { useEffect } from 'react';
import io from 'socket.io-client';
import { Globe, LogOut, Terminal } from "lucide-react";

import { LoginScreen } from './components/LoginScreen';
import { WhaleFeedPopover } from './components/WhaleFeedPopover';
import { PinnedFeed } from './components/PinnedFeed';
import { MapController } from './components/MapController';
import { CRTEffect } from './components/ui/crt-effect';
import { generateAsciiAvatar } from './utils/asciiAvatar';
import { Button } from './components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "./components/ui/dialog"
import { useMarketStore, type DisplayMarket } from './store/marketStore';
import { useAuthStore } from './store/authStore';
import { SOCKET_URL } from './config';

function App() {
    const { isAuthenticated, user, token, logout, socket, setSocket, setStatus } = useAuthStore();

    const {
        marketMap, setSnapshot, updatePrice, addTrade
    } = useMarketStore();

    const markets = Array.from(marketMap.values());

    // Only connect socket when authenticated (with JWT token)
    useEffect(() => {
        if (!isAuthenticated || !token) {
            // Close any existing connection if user logs out
            if (socket) {
                socket.close();
                setSocket(null as any);
            }
            return;
        }

        // Connect with JWT token in handshake
        const newSocket = io(SOCKET_URL, {
            auth: { token }
        });
        setSocket(newSocket);

        return () => {
            newSocket.close();
            setSocket(null as any);
        };
    }, [isAuthenticated, token]);

    useEffect(() => {
        if (!socket) return;

        // Pin Handlers (these still use socket)
        const onPinsResponse = (data: any) => {
            if (data.pins) {
                useMarketStore.getState().setPinnedIds(data.pins);
                console.log('SYSTEM', `Loaded ${data.pins.length} pinned markets`);
            }
        };

        const onPinToggled = (data: any) => {
            useMarketStore.getState().syncPin(data.conditionId, data.isPinned);
        };

        socket.on('pins_response', onPinsResponse);
        socket.on('pin_toggled', onPinToggled);
        // socket.on('tag_locations', onTagLocations); // Deprecated

        const onConnect = () => {
            setStatus('Connected');
            console.log('SYSTEM', 'Connected to Polymarket Bot');
            socket.emit('get_market_snapshot');

            // Fetch pins for authenticated user
            const { user } = useAuthStore.getState();
            if (user) {
                socket.emit('get_pins', { userId: user.id });
            }
        };

        const onDisconnect = () => {
            setStatus('Disconnected');
            console.log('SYSTEM', 'Disconnected from server');
        };

        const onConnectError = (error: Error) => {
            console.error('SYSTEM', 'Connection error:', error.message);
            setStatus('Auth Failed');
            // If token is invalid, force logout
            if (error.message.includes('Authentication') || error.message.includes('token')) {
                logout();
            }
        };

        const onEvent = (data: { type: string; payload: any, timestamp: number }) => {
            if (data.type !== 'MARKET_SNAPSHOT' && data.type !== 'trade_update' && data.type !== 'TRADE') {
                // console.log(data.type, data.payload);
            }

            if (data.type === 'MARKET_SNAPSHOT') {
                if (data.payload.markets) {
                    const mappedMarkets: DisplayMarket[] = data.payload.markets.map((m: any) => ({
                        conditionId: m.condition_id,
                        question: m.description || m.question || 'Unknown Market',
                        slug: m.slug,
                        eventSlug: m.event_slug,
                        image: m.image,
                        endDate: m.end_date,
                        yesAssetId: m.yes_asset_id,
                        noAssetId: m.no_asset_id,
                        yesPrice: m.yes_price || 0.5,
                        noPrice: m.no_price || 0.5,
                        history: [],
                        tags: m.tags || [], // Category tags from API
                        volume: m.volume || 0,
                        liquidity: m.liquidity || 0
                    }));
                    setSnapshot(mappedMarkets);
                }
            }

            if (data.type === 'trade_update' || data.type === 'TRADE') {
                const trade = data.payload;
                updatePrice(trade.asset_id || trade.assetId, parseFloat(trade.price), data.timestamp || Date.now());

                // Allow ALL trades for now (client-side filtering can be added later if needed)
                // previously: if (parseFloat(trade.size) > 500)
                addTrade({
                    id: Math.random().toString(),
                    price: parseFloat(trade.price),
                    size: parseFloat(trade.size || '0'),
                    side: trade.side,
                    timestamp: data.timestamp || Date.now(),
                    outcome: trade.outcome,
                    marketTitle: trade.market_slug || 'Unknown Market'
                });
            }
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);
        socket.on('event', onEvent);
        socket.on('market_snapshot', (payload) => onEvent({ type: 'MARKET_SNAPSHOT', payload, timestamp: Date.now() }));

        return () => {
            socket.off('pins_response', onPinsResponse);
            socket.off('pin_toggled', onPinToggled);
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.off('event', onEvent);
            socket.off('market_snapshot');
        };
    }, [socket]);

    if (!isAuthenticated) {
        return <LoginScreen />;
    }

    return (
        <div className="h-screen bg-black text-primary font-mono flex overflow-hidden selection:bg-primary selection:text-black">
            <CRTEffect />

            {/* Sidebar Navigation */}
            <aside className="w-16 flex flex-col items-center py-6 border-r-2 border-primary bg-black z-20">
                <div className="w-8 h-8 bg-primary flex items-center justify-center mb-8 shadow-[0_0_15px_rgba(0,255,159,0.3)]">
                    <Terminal className="w-5 h-5 text-black" />
                </div>

                <div className="flex flex-col gap-4">
                    <div className="p-2 bg-primary/10 rounded-none text-primary hover:bg-primary hover:text-black transition cursor-pointer border border-primary/50" title="Map View">
                        <Globe className="w-5 h-5" />
                    </div>
                </div>


                <div className="mt-auto flex flex-col items-center gap-4">
                    <div className="p-1 border border-primary/20 bg-black" title={user?.username}>
                        <pre className="text-[8px] leading-[8px] font-bold text-primary font-mono whitespace-pre select-none">
                            {generateAsciiAvatar(user?.username || 'GUEST')}
                        </pre>
                    </div>
                    <Dialog>
                        <DialogTrigger asChild>
                            <button className="p-2 text-primary/50 hover:text-destructive transition" title="Logout">
                                <LogOut className="w-5 h-5" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="bg-black border-2 border-primary text-primary font-mono sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold uppercase tracking-widest text-destructive">
                                    [!] TERMINATE_SESSION?
                                </DialogTitle>
                                <DialogDescription className="text-primary/70 font-mono">
                                    Are you sure you want to log out? Unsaved local configurations may be lost.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="flex gap-2 sm:gap-0 mt-4">
                                <DialogClose asChild>
                                    <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-black font-mono uppercase bg-black rounded-none">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button
                                    variant="destructive"
                                    onClick={logout}
                                    className="bg-destructive text-white hover:bg-destructive/90 font-mono uppercase rounded-none border border-destructive"
                                >
                                    Confirm_Exit
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </aside>
            <main className="flex-1 flex flex-col min-w-0 relative">
                {/* Header Overlay */}
                <header className="absolute top-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-sm border-b-2 border-primary px-8 flex items-center justify-between z-10 pointer-events-none">
                    <div className="pointer-events-auto">
                        <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2 font-mono">
                            FENT_GOBLIN // <span className="text-xs font-mono text-black bg-primary px-1 animate-pulse">LIVE_CONNECTION</span>
                        </h1>
                        <p className="text-xs text-primary/70 typewriter">Global Event Surveillance System v1.0</p>
                    </div>

                    <div className="flex items-center gap-4 pointer-events-auto">
                        <div className="text-right mr-4">
                            <p className="text-xs text-primary/70 uppercase tracking-widest">Monitored Zones</p>
                            <p className="text-lg font-mono font-bold text-primary">&gt; {new Set(markets.map(m => m.eventSlug || m.conditionId)).size}</p>
                        </div>
                        <WhaleFeedPopover />
                    </div>
                </header>

                {/* THE MAP */}
                <div className="flex-1 bg-black relative flex flex-col min-h-0">
                    <div className="flex-1 relative min-h-0 border-r-0 border-primary">
                        <MapController />
                    </div>
                    {/* Bottom Panel - Reserved for Extra Features */}
                    <div className="h-40 shrink-0 border-t-2 border-primary bg-black flex items-center justify-center">
                        <div className="text-primary/30 font-mono text-xs uppercase tracking-widest">
                            &gt; EXTRA_FEATURES_COMING_SOON...
                        </div>
                    </div>
                </div>
            </main>

            {/* Right Sidebar (Pinned Events) */}
            <aside className="w-80 bg-black shrink-0 z-20">
                <PinnedFeed />
            </aside>
        </div>
    );
}

export default App;