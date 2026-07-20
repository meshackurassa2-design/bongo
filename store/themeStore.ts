import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES } from '../constants';

export type ThemeType = 'luxury' | 'love' | 'ocean' | 'cyberpunk' | 'forest';

interface ThemeState {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  COLORS: typeof THEMES.luxury;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'luxury',
      COLORS: THEMES.luxury,
      setTheme: (theme: ThemeType) => set({ theme, COLORS: THEMES[theme] }),
    }),
    {
      name: 'bongo-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
