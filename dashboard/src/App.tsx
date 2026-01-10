import { useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Terminal, Activity, Wifi, Command, Send, RefreshCcw } from "lucide-react";
import { useTerminalStore } from './store/terminalStore';

const SOCKET_URL = 'http://localhost:3000';

const COMMANDS = [
    { cmd: 'help', desc: 'List available commands' },
    { cmd: 'clear', desc: 'Clear terminal output' },
    { cmd: 'ping', desc: 'Check connectivity' },
    { cmd: 'status', desc: 'Show bot health stats' },
    { cmd: 'markets', desc: 'List active markets' },
];

function App() {
    const {
        socket, status, logs, inputValue,
        setSocket, setStatus, addLog, setInputValue, clearLogs
    } = useTerminalStore();

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        return () => {
            newSocket.close();
            setSocket(null);
        };
    }, []);

    useEffect(() => {
        if (!socket) return;

        const onConnect = () => {
            setStatus('Connected');
            addLog('SYSTEM', 'Connected to Polymarket Bot');
        };

        const onDisconnect = () => {
            setStatus('Disconnected');
            addLog('SYSTEM', 'Disconnected from server');
        };

        const onStatus = (data: { message: string }) => {
            addLog('SYSTEM', data.message);
        };

        const onEvent = (data: { type: string; payload: any }) => {
            addLog(data.type, JSON.stringify(data.payload, null, 2), data.payload);
        };

        const onCommandResponse = (data: { command: string; response?: any; error?: string }) => {
            if (data.error) {
                addLog('ERROR', `Error executing '${data.command}': ${data.error}`);
            } else {
                const output = typeof data.response === 'string'
                    ? data.response
                    : JSON.stringify(data.response, null, 2);
                addLog('RESPONSE', output);
            }
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('status', onStatus);
        socket.on('event', onEvent);
        socket.on('command_response', onCommandResponse);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('status', onStatus);
            socket.off('event', onEvent);
            socket.off('command_response', onCommandResponse);
        };
    }, [socket]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const handleCommand = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const cmd = inputValue.trim();
        addLog('INPUT', `> ${cmd}`);
        setInputValue('');

        if (cmd === 'clear') {
            clearLogs();
            return;
        }
        if (cmd === 'help') {
            const helpText = COMMANDS.map(c => `${c.cmd.padEnd(10)} - ${c.desc}`).join('\n');
            addLog('SYSTEM', `Available Commands:\n${helpText}`);
            return;
        }

        if (socket && status === 'Connected') {
            socket.emit('command', { command: cmd, id: Date.now() });
        } else {
            addLog('ERROR', 'Cannot send command: Disconnected');
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-50 font-sans selection:bg-neutral-800 flex flex-col md:flex-row">
            {/* Sidebar / Legend */}
            <aside className="w-full md:w-64 bg-neutral-900 border-b md:border-b-0 md:border-r border-neutral-800 p-6 flex flex-col gap-6 shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600/10 rounded-lg">
                        <Activity className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">Polymarket</h1>
                        <p className="text-xs text-neutral-400">OBSERVER v1.0</p>
                    </div>
                </div>

                <div className="flex-1 space-y-6">
                    <div>
                        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Wifi className="w-3 h-3" /> Status
                        </h3>
                        <Badge
                            variant={status === 'Connected' ? 'default' : 'destructive'}
                            className={`w-full justify-center py-1.5 text-xs uppercase tracking-wider ${status === 'Connected' ? 'bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border-emerald-900/50' : ''
                                }`}
                        >
                            {status}
                        </Badge>
                    </div>

                    <div>
                        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Command className="w-3 h-3" /> Commands
                        </h3>
                        <div className="grid gap-1">
                            {COMMANDS.map((cmd) => (
                                <button
                                    key={cmd.cmd}
                                    onClick={() => setInputValue(cmd.cmd)}
                                    className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-neutral-800 text-xs group transition-colors text-left"
                                >
                                    <code className="text-violet-400 font-mono bg-violet-950/30 px-1.5 py-0.5 rounded text-[10px]">{cmd.cmd}</code>
                                    <span className="text-neutral-500 text-[10px] group-hover:text-neutral-300">{cmd.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-neutral-800 text-xs text-neutral-600 flex justify-between">
                    <span>Uptime:</span>
                    <span className="font-mono">--:--:--</span>
                </div>
            </aside>

            {/* Main Terminal Area */}
            <main className="flex-1 flex flex-col h-[calc(100vh-theme(spacing.64))] md:h-screen overflow-hidden relative">
                <header className="absolute top-0 left-0 right-0 bg-neutral-950/80 backdrop-blur z-10 border-b border-neutral-900 px-6 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-neutral-400 text-sm">
                        <Terminal className="w-4 h-4" />
                        <span className="uppercase tracking-widest">Live Output</span>
                    </div>
                    <button
                        onClick={clearLogs}
                        className="text-neutral-600 hover:text-red-400 transition-colors p-1"
                        title="Clear Logs"
                    >
                        <RefreshCcw className="w-4 h-4" />
                    </button>
                </header>

                <div className="flex-1 overflow-hidden relative pt-12 pb-16">
                    <div
                        ref={scrollRef}
                        className="h-full overflow-y-auto px-6 font-mono text-sm space-y-1 pb-4"
                    >
                        {logs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-neutral-700 gap-2 select-none">
                                <Activity className="w-12 h-12 opacity-10" />
                                <p>Ready to connect...</p>
                            </div>
                        ) : (
                            logs.map((log) => (
                                <div key={log.id} className="group flex gap-3 hover:bg-neutral-900/50 -mx-4 px-4 py-0.5 rounded transition-colors break-words">
                                    <span className="text-neutral-300 shrink-0 select-none text-xs py-0.5 opacity-50 w-20">
                                        {log.timestamp}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <span className={`font-bold mr-3 text-xs uppercase tracking-wide inline-block w-20 text-right ${getTypeColor(log.type)}`}>
                                            {log.type}
                                        </span>
                                        <span className="text-neutral-300 whitespace-pre-wrap leading-relaxed">
                                            {log.message}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="shrink-0 p-4 border-t border-neutral-800 bg-neutral-900/30 backdrop-blur">
                    <form onSubmit={handleCommand} className="max-w-4xl mx-auto relative flex gap-2">
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-mono">{'>'}</span>
                            <Input
                                ref={inputRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Type a command (try 'help')..."
                                className="pl-8 bg-neutral-950 border-neutral-800 text-neutral-200 font-mono focus-visible:ring-violet-900/50"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!inputValue.trim()}
                            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>

            </main>
        </div>
    );
}

function getTypeColor(type: string) {
    switch (type) {
        case 'MARKET_ADDED': return 'text-emerald-500';
        case 'MARKET_REMOVED': return 'text-rose-500';
        case 'MARKET_SEARCHED': return 'text-cyan-400';
        case 'EVENT_SEARCHED': return 'text-fuchsia-400';
        case 'SYSTEM': return 'text-blue-500';
        case 'ERROR': return 'text-red-500';
        case 'WARN': return 'text-amber-500';
        case 'INPUT': return 'text-neutral-400';
        case 'RESPONSE': return 'text-violet-400';
        default: return 'text-neutral-500';
    }
}

export default App;