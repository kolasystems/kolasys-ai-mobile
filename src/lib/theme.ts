import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Legacy colour constants ──────────────────────────────────────────────────
// Kept so existing call sites (StatusBadge, etc.) keep working. New code should
// use `useTheme().colors`.
export const Colors = {
  primary: '#5B8DEF',
  primaryDark: '#4070D4',
  primaryLight: '#7AAAF5',
  dark: '#1A1A2E',
  darkSecondary: '#16213E',
  darkTertiary: '#0F3460',

  pending: '#F59E0B',
  processing: '#5B8DEF',
  ready: '#10B981',
  failed: '#EF4444',

  low: '#6B7280',
  medium: '#F59E0B',
  high: '#EF4444',
  urgent: '#DC2626',

  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
} as const;

// ─── Theme palette ────────────────────────────────────────────────────────────

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnAccent: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  accentPressed: string;
  success: string;
  warning: string;
  danger: string;
  // Header gradient (top-left → bottom-right)
  gradientStart: string;
  gradientEnd: string;
  // Full-screen background gradient for immersive screens (Record)
  bgGradientStart: string;
  bgGradientEnd: string;
  // Scrim used to fade gradient into surface
  scrim: string;
  // Shadows
  shadow: string;
}

const lightColors: ThemeColors = {
  background: '#F8F9FC',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#F3F4F6',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  textOnAccent: '#FFFFFF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  accent: '#5B8DEF',
  accentSoft: 'rgba(91, 141, 239, 0.12)',
  accentPressed: '#4070D4',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  gradientStart: '#5B8DEF',
  gradientEnd: '#667EEA',
  bgGradientStart: '#F8F9FC',
  bgGradientEnd: '#E9EEF9',
  scrim: 'rgba(248, 249, 252, 0.8)',
  shadow: 'rgba(17, 24, 39, 0.08)',
};

const darkColors: ThemeColors = {
  background: '#0F0F13',
  surface: '#1A1A24',
  surfaceRaised: '#23232F',
  surfaceMuted: '#1F1F2B',
  textPrimary: '#F9FAFB',
  textSecondary: '#C7CAD1',
  textMuted: '#6B7280',
  textOnAccent: '#FFFFFF',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  accent: '#5B8DEF',
  accentSoft: 'rgba(91, 141, 239, 0.22)',
  accentPressed: '#7AAAF5',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#F87171',
  gradientStart: '#667EEA',
  gradientEnd: '#764BA2',
  bgGradientStart: '#0F0F1F',
  bgGradientEnd: '#1A1033',
  scrim: 'rgba(15, 15, 19, 0.85)',
  shadow: 'rgba(0, 0, 0, 0.45)',
};

// ─── Context ──────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleDark: () => void;
}

const STORAGE_KEY = 'kolasys-theme';

const defaultValue: ThemeContextValue = {
  mode: 'system',
  isDark: false,
  colors: lightColors,
  setMode: () => {},
  toggleDark: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(defaultValue);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(() =>
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );

  // Hydrate persisted mode on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored);
        }
      } catch {
        // If storage fails, we stay on default 'system' — not fatal.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Track system scheme (only relevant when mode is 'system')
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  const toggleDark = useCallback(() => {
    setMode(isDark ? 'light' : 'dark');
  }, [isDark, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark,
      colors: isDark ? darkColors : lightColors,
      setMode,
      toggleDark,
    }),
    [mode, isDark, setMode, toggleDark],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// Also export palettes directly for static style sheets that can't hook.
export { lightColors, darkColors };
