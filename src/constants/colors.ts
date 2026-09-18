/**
 * Paleta de cores do app. Único lugar onde os tons devem ser definidos —
 * o resto do código referencia esses tokens em vez de hex literais soltos.
 */
export const colors = {
  // Superfícies, do mais escuro (fundo de tela) ao mais claro (cards/inputs)
  background: "#121212",
  surface: "#1E1E1E",
  surfaceAlt: "#2A2A2A",

  // Bordas
  border: "#333333",
  borderSubtle: "#444444",

  // Texto
  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textMuted: "#888888",
  textPlaceholder: "#666666",
  textFaint: "#555555",

  // Semânticas
  income: "#10B981",
  expense: "#EF4444",
  accent: "#3B82F6",

  // Paleta de categorias
  categoryOrange: "#F97316",
  categoryAmber: "#F59E0B",
  categoryPurple: "#8B5CF6",
  categoryPink: "#EC4899",
  categoryIndigo: "#6366F1",
  categoryNeutral: "#A8A29E",

  shadow: "#000000",
} as const;
