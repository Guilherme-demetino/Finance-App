/**
 * Paletas do app: escuro, claro e as versões de alto contraste de cada um.
 * Único lugar onde os tons são definidos: o resto do código lê as cores pelo
 * useTheme() em vez de hex soltos, para o tema poder trocar em tempo real.
 */

export interface ThemeColors {
  // Superfícies, do fundo de tela aos cards/inputs
  background: string;
  surface: string;
  surfaceAlt: string;

  // Bordas
  border: string;
  borderSubtle: string;

  // Texto
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textPlaceholder: string;
  textFaint: string;
  /** Texto e ícones sobre um fundo colorido cheio (botão azul, marcador verde...). */
  textOnColor: string;

  // Semânticas
  income: string;
  expense: string;
  accent: string;

  // Paleta de categorias (a mesma em todos os temas: identifica a categoria)
  categoryOrange: string;
  categoryAmber: string;
  categoryPurple: string;
  categoryPink: string;
  categoryIndigo: string;
  categoryCyan: string;
  categoryNeutral: string;

  shadow: string;

  /**
   * Véu que escurece (ou clareia) a tela atrás de um pop-up. No alto contraste escuro o véu
   * preto sumiria no fundo preto: lá ele é claro, para a tela de trás e o cartão aparecerem.
   */
  scrim: string;
}

/** Cores de categoria: fixas, iguais em todos os temas (ficam salvas nas categorias criadas pelo usuário). */
export const CATEGORY_COLORS = {
  categoryOrange: "#F97316",
  categoryAmber: "#F59E0B",
  categoryPurple: "#8B5CF6",
  categoryPink: "#EC4899",
  categoryIndigo: "#6366F1",
  categoryCyan: "#06B6D4",
  categoryNeutral: "#A8A29E",
} as const;

/** Cores de acento originais do app, usadas como cor inicial ao criar categorias. */
export const ACCENT_COLORS = {
  income: "#10B981",
  expense: "#EF4444",
  accent: "#3B82F6",
} as const;

export const DARK_COLORS: ThemeColors = {
  background: "#121212",
  surface: "#1E1E1E",
  surfaceAlt: "#2A2A2A",

  border: "#333333",
  borderSubtle: "#444444",

  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textMuted: "#888888",
  textPlaceholder: "#666666",
  textFaint: "#555555",
  textOnColor: "#FFFFFF",

  ...ACCENT_COLORS,
  ...CATEGORY_COLORS,
  shadow: "#000000",
  scrim: "rgba(0,0,0,0.8)",
};

export const LIGHT_COLORS: ThemeColors = {
  background: "#F3F4F6",
  surface: "#FFFFFF",
  surfaceAlt: "#E9ECF1",

  border: "#D1D5DB",
  borderSubtle: "#BFC5CE",

  textPrimary: "#111827",
  textSecondary: "#4B5563",
  textMuted: "#5B6472",
  textPlaceholder: "#6B7280",
  textFaint: "#8A93A1",
  textOnColor: "#FFFFFF",

  income: "#047857",
  expense: "#DC2626",
  accent: "#2563EB",
  ...CATEGORY_COLORS,
  shadow: "#000000",
  scrim: "rgba(0,0,0,0.8)",
};

export const HIGH_CONTRAST_DARK_COLORS: ThemeColors = {
  background: "#000000",
  surface: "#0A0A0A",
  surfaceAlt: "#1A1A1A",

  border: "#9CA3AF",
  borderSubtle: "#6B7280",

  textPrimary: "#FFFFFF",
  textSecondary: "#E5E7EB",
  textMuted: "#D1D5DB",
  textPlaceholder: "#B8BFCB",
  textFaint: "#A0A7B3",
  textOnColor: "#000000",

  income: "#34D399",
  expense: "#FF7B7B",
  accent: "#7DB3FF",
  ...CATEGORY_COLORS,
  shadow: "#000000",
  scrim: "rgba(255,255,255,0.22)",
};

export const HIGH_CONTRAST_LIGHT_COLORS: ThemeColors = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceAlt: "#EEEEEE",

  border: "#000000",
  borderSubtle: "#4B5563",

  textPrimary: "#000000",
  textSecondary: "#1F2937",
  textMuted: "#374151",
  textPlaceholder: "#4B5563",
  textFaint: "#5B6472",
  textOnColor: "#FFFFFF",

  income: "#065F46",
  expense: "#B91C1C",
  accent: "#1D4ED8",
  ...CATEGORY_COLORS,
  shadow: "#000000",
  scrim: "rgba(0,0,0,0.6)",
};

export function resolvePalette(options: {
  isDark: boolean;
  highContrast: boolean;
}): ThemeColors {
  if (options.highContrast) {
    return options.isDark ? HIGH_CONTRAST_DARK_COLORS : HIGH_CONTRAST_LIGHT_COLORS;
  }
  return options.isDark ? DARK_COLORS : LIGHT_COLORS;
}
