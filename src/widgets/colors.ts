/**
 * Cores fixas (a paleta escura padrão do app — ver theme/palettes.ts). Os widgets de tela inicial rodam fora
 * da árvore React (tarefa headless do Android) e não têm acesso ao ThemeContext, então não dá para usar useTheme().
 */
export const WIDGET_COLORS = {
  surface: "#1E1E1E",
  border: "#333333",
  textPrimary: "#FFFFFF",
  textMuted: "#888888",
  income: "#10B981",
  expense: "#EF4444",
} as const;
