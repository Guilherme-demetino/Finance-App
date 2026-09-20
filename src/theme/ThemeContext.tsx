import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { resolvePalette, type ThemeColors } from "./palettes";
import {
  DEFAULT_PREFERENCES,
  isDarkTheme,
  type FontScale,
  type ThemeMode,
  type ThemePreferences,
} from "./preferences";

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  highContrast: boolean;
  fontScale: FontScale;
}

interface ThemeActions {
  setMode: (mode: ThemeMode) => void;
  setHighContrast: (value: boolean) => void;
  setFontScale: (value: FontScale) => void;
}

const DEFAULT_THEME: Theme = {
  colors: resolvePalette({ isDark: true, highContrast: false }),
  isDark: true,
  mode: DEFAULT_PREFERENCES.mode,
  highContrast: DEFAULT_PREFERENCES.highContrast,
  fontScale: DEFAULT_PREFERENCES.fontScale,
};

// Sem provider (testes, telas soltas) o app se comporta como sempre: escuro, letra padrão.
const ThemeContext = createContext<Theme>(DEFAULT_THEME);
const ThemeActionsContext = createContext<ThemeActions | null>(null);

interface ThemeProviderProps {
  initial?: ThemePreferences;
  /** Chamado a cada mudança, para salvar as preferências. */
  onChange?: (preferences: ThemePreferences) => void;
  children: ReactNode;
}

export function ThemeProvider({
  initial = DEFAULT_PREFERENCES,
  onChange,
  children,
}: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [preferences, setPreferences] = useState<ThemePreferences>(initial);

  const update = useCallback(
    (patch: Partial<ThemePreferences>) => {
      setPreferences((current) => {
        const next = { ...current, ...patch };
        onChange?.(next);
        return next;
      });
    },
    [onChange],
  );

  const isDark = isDarkTheme(preferences.mode, systemScheme);

  const theme = useMemo<Theme>(
    () => ({
      colors: resolvePalette({ isDark, highContrast: preferences.highContrast }),
      isDark,
      mode: preferences.mode,
      highContrast: preferences.highContrast,
      fontScale: preferences.fontScale,
    }),
    [isDark, preferences.highContrast, preferences.mode, preferences.fontScale],
  );

  const actions = useMemo<ThemeActions>(
    () => ({
      setMode: (mode) => update({ mode }),
      setHighContrast: (highContrast) => update({ highContrast }),
      setFontScale: (fontScale) => update({ fontScale }),
    }),
    [update],
  );

  return (
    <ThemeActionsContext.Provider value={actions}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </ThemeActionsContext.Provider>
  );
}

/** Cores e ajustes de acessibilidade atuais. Re-renderiza quando o tema muda. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Trocar tema, alto contraste e tamanho da fonte (usado na tela de aparência). */
export function useThemeActions(): ThemeActions {
  const actions = useContext(ThemeActionsContext);
  if (actions === null) {
    throw new Error("useThemeActions deve ser usado dentro de ThemeProvider");
  }
  return actions;
}
