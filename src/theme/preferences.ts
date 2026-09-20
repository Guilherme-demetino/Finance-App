/** Preferências de aparência e acessibilidade (lógica pura; o armazenamento fica em preferencesStorage.ts). */

export type ThemeMode = "system" | "light" | "dark";
export type FontScale = 1 | 1.15 | 1.3;

export interface ThemePreferences {
  mode: ThemeMode;
  highContrast: boolean;
  fontScale: FontScale;
}

/**
 * O padrão é o escuro, que é como o app sempre foi: quem já usa não vê o visual
 * mudar sozinho depois de uma atualização. "Automático" segue o tema do sistema.
 */
export const DEFAULT_PREFERENCES: ThemePreferences = {
  mode: "dark",
  highContrast: false,
  fontScale: 1,
};

export const FONT_SCALE_OPTIONS: { value: FontScale; label: string }[] = [
  { value: 1, label: "Padrão" },
  { value: 1.15, label: "Grande" },
  { value: 1.3, label: "Maior" },
];

/** Chaves da tabela app_meta. */
export const PREFERENCE_KEYS = {
  mode: "theme_mode",
  highContrast: "theme_high_contrast",
  fontScale: "theme_font_scale",
} as const;

const MODES: ThemeMode[] = ["system", "light", "dark"];

export interface RawPreferences {
  mode: string | null;
  highContrast: string | null;
  fontScale: string | null;
}

/** Lê os valores salvos; qualquer coisa estranha volta para o padrão em vez de quebrar. */
export function parsePreferences(raw: RawPreferences): ThemePreferences {
  const mode = MODES.find((candidate) => candidate === raw.mode);
  const fontScale = FONT_SCALE_OPTIONS.find(
    (option) => String(option.value) === raw.fontScale,
  );

  return {
    mode: mode ?? DEFAULT_PREFERENCES.mode,
    highContrast: raw.highContrast === "1",
    fontScale: fontScale?.value ?? DEFAULT_PREFERENCES.fontScale,
  };
}

/** O tema escuro vale para "escuro" e, em "automático", quando o sistema não pede claro. */
export function isDarkTheme(mode: ThemeMode, systemScheme: string | null | undefined): boolean {
  if (mode === "system") return systemScheme !== "light";
  return mode === "dark";
}
