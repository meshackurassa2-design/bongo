import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SunoAudioData, SunoTaskStatus } from '../lib/sunoApi';

export interface AISongTask {
  taskId: string;
  title: string;
  status: SunoTaskStatus;
  createdAt: number;
  tracks?: SunoAudioData[];
  taskType?: 'GENERATE' | 'VOCAL_REMOVAL';
}

export interface Persona {
  id: string; // Suno Persona ID
  name: string;
  description: string;
  createdAt: number;
}

interface AIStore {
  tasks: AISongTask[];
  personas: Persona[];
  addTask: (taskId: string, title: string, taskType?: 'GENERATE' | 'VOCAL_REMOVAL') => void;
  updateTask: (taskId: string, status: SunoTaskStatus, tracks?: SunoAudioData[]) => void;
  updateTrack: (taskId: string, trackId: string, updates: Partial<SunoAudioData>) => void;
  removeTask: (taskId: string) => void;
  addPersona: (persona: Persona) => void;
  removePersona: (id: string) => void;
}

export const useAIStore = create<AIStore>()(
  persist(
    (set) => ({
      tasks: [],
      personas: [],
      addTask: (taskId, title, taskType) => set((state) => ({
        tasks: [{ taskId, title, status: 'PENDING', createdAt: Date.now(), taskType: taskType || 'GENERATE' }, ...state.tasks]
      })),
      updateTask: (taskId, status, tracks) => set((state) => ({
        tasks: state.tasks.map(t => t.taskId === taskId ? { ...t, status, tracks: tracks || t.tracks } : t)
      })),
      updateTrack: (taskId, trackId, updates) => set((state) => ({
        tasks: state.tasks.map(t => {
          if (t.taskId !== taskId || !t.tracks) return t;
          return {
            ...t,
            tracks: t.tracks.map(trk => trk.id === trackId ? { ...trk, ...updates } : trk)
          };
        })
      })),
      removeTask: (taskId) => set((state) => ({
        tasks: state.tasks.filter(t => t.taskId !== taskId)
      })),
      addPersona: (persona) => set((state) => ({
        personas: [persona, ...state.personas]
      })),
      removePersona: (id) => set((state) => ({
        personas: state.personas.filter(p => p.id !== id)
      })),
    }),
    {
      name: 'ai-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
