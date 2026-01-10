import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Socket } from 'socket.io-client';

export interface LogEvent {
    id: number;
    timestamp: string;
    type: string;
    message: string;
    payload?: any;
}

interface TerminalState {
    socket: Socket | null;
    status: 'Connected' | 'Disconnected';
    logs: LogEvent[];
    inputValue: string;

    // Actions
    setSocket: (socket: Socket | null) => void;
    setStatus: (status: 'Connected' | 'Disconnected') => void;
    addLog: (type: string, message: string, payload?: any) => void;
    setInputValue: (value: string) => void;
    clearLogs: () => void;
}

// Custom storage with debounce to prevent performance issues with frequent log updates
const debounce = (fn: Function, ms: number) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function (this: any, ...args: any[]) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
};

// Debounce the setItem call to run at most once every 1000ms
const debouncedSetItem = debounce((name: string, value: string) => {
    try {
        localStorage.setItem(name, value);
    } catch (e) {
        console.warn('Failed to save terminal logs to localStorage:', e);
    }
}, 1000);

const debouncedStorage = {
    getItem: (name: string) => localStorage.getItem(name),
    setItem: debouncedSetItem,
    removeItem: (name: string) => localStorage.removeItem(name),
};

export const useTerminalStore = create<TerminalState>()(
    persist(
        (set) => ({
            socket: null,
            status: 'Disconnected',
            logs: [],
            inputValue: '',

            setSocket: (socket) => set({ socket }),
            setStatus: (status) => set({ status }),

            addLog: (type, message, payload) => set((state) => {
                const timestamp = new Date().toLocaleTimeString();
                const newLog: LogEvent = {
                    id: Date.now(),
                    timestamp,
                    type,
                    message,
                    payload
                };
                // Keep last 200 logs
                return { logs: [...state.logs, newLog].slice(-200) };
            }),

            setInputValue: (inputValue) => set({ inputValue }),
            clearLogs: () => set({ logs: [] }),
        }),
        {
            name: 'terminal-storage',
            storage: createJSONStorage(() => debouncedStorage),
            partialize: (state) => ({ logs: state.logs }), // Only persist logs
        }
    )
);
