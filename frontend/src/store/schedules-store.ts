import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Schedule } from '../types/api';

interface SchedulesState {
  schedules: Schedule[];
  setSchedules: (schedules: Schedule[]) => void;
  addSchedule: (schedule: Schedule) => void;
  updateSchedule: (id: number, schedule: Schedule) => void;
  removeSchedule: (id: number) => void;

  // Selected schedule for editing
  selectedSchedule: Schedule | null;
  setSelectedSchedule: (schedule: Schedule | null) => void;

  // Filters
  serviceFilter: string | null;
  setServiceFilter: (service: string | null) => void;
  enabledFilter: boolean | null;
  setEnabledFilter: (enabled: boolean | null) => void;

  // UI state
  isCreating: boolean;
  setIsCreating: (creating: boolean) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
}

export const useSchedulesStore = create<SchedulesState>()(
  devtools((set) => ({
    schedules: [],
    setSchedules: (schedules) => set({ schedules }),
    addSchedule: (schedule) =>
      set((state) => ({ schedules: [...state.schedules, schedule] })),
    updateSchedule: (id, schedule) =>
      set((state) => ({
        schedules: state.schedules.map((s) => (s.id === id ? schedule : s)),
      })),
    removeSchedule: (id) =>
      set((state) => ({
        schedules: state.schedules.filter((s) => s.id !== id),
      })),

    // Selected schedule
    selectedSchedule: null,
    setSelectedSchedule: (schedule) => set({ selectedSchedule: schedule }),

    // Filters
    serviceFilter: null,
    setServiceFilter: (service) => set({ serviceFilter: service }),
    enabledFilter: null,
    setEnabledFilter: (enabled) => set({ enabledFilter: enabled }),

    // UI state
    isCreating: false,
    setIsCreating: (creating) => set({ isCreating: creating }),
    isEditing: false,
    setIsEditing: (editing) => set({ isEditing: editing }),
  }))
);
