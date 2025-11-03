import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SyncLog, SyncProgressMessage } from '../types/api';

interface SyncState {
  // Active syncs
  activeSyncs: Map<string, SyncProgressMessage>;
  setActiveSync: (service: string, progress: SyncProgressMessage) => void;
  clearActiveSync: (service: string) => void;

  // Sync history
  notesHistory: SyncLog[];
  remindersHistory: SyncLog[];
  passwordsHistory: SyncLog[];
  setNotesHistory: (history: SyncLog[]) => void;
  setRemindersHistory: (history: SyncLog[]) => void;
  setPasswordsHistory: (history: SyncLog[]) => void;

  // Real-time logs
  logs: Array<{ service: string; level: string; message: string; timestamp: string }>;
  addLog: (service: string, level: string, message: string) => void;
  clearLogs: () => void;

  // Schedule runs
  recentScheduleRuns: Array<{
    scheduleId: number;
    scheduleName: string;
    service: string;
    status: string;
    timestamp: string;
  }>;
  addScheduleRun: (
    scheduleId: number,
    scheduleName: string,
    service: string,
    status: string
  ) => void;
  clearScheduleRuns: () => void;
}

export const useSyncStore = create<SyncState>()(
  devtools((set) => ({
    // Active syncs
    activeSyncs: new Map(),
    setActiveSync: (service, progress) =>
      set((state) => {
        const newMap = new Map(state.activeSyncs);
        newMap.set(service, progress);
        return { activeSyncs: newMap };
      }),
    clearActiveSync: (service) =>
      set((state) => {
        const newMap = new Map(state.activeSyncs);
        newMap.delete(service);
        return { activeSyncs: newMap };
      }),

    // Sync history
    notesHistory: [],
    remindersHistory: [],
    passwordsHistory: [],
    setNotesHistory: (history) => set({ notesHistory: history }),
    setRemindersHistory: (history) => set({ remindersHistory: history }),
    setPasswordsHistory: (history) => set({ passwordsHistory: history }),

    // Real-time logs
    logs: [],
    addLog: (service, level, message) =>
      set((state) => ({
        logs: [
          ...state.logs,
          {
            service,
            level,
            message,
            timestamp: new Date().toISOString(),
          },
        ].slice(-100), // Keep only last 100 logs
      })),
    clearLogs: () => set({ logs: [] }),

    // Schedule runs
    recentScheduleRuns: [],
    addScheduleRun: (scheduleId, scheduleName, service, status) =>
      set((state) => ({
        recentScheduleRuns: [
          ...state.recentScheduleRuns,
          {
            scheduleId,
            scheduleName,
            service,
            status,
            timestamp: new Date().toISOString(),
          },
        ].slice(-20), // Keep only last 20 runs
      })),
    clearScheduleRuns: () => set({ recentScheduleRuns: [] }),
  }))
);
