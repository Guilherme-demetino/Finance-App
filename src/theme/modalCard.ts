import type { Theme } from "./ThemeContext";

/**
 * O cartão de um pop-up. No alto contraste ele ganha borda grossa na cor do texto e fundo um
 * tom acima do da tela: sem isso, o cartão (quase preto) se perdia no fundo preto e o pop-up
 * parecia parte da própria tela.
 */
export function modalCard({ colors, highContrast }: Theme) {
  return highContrast
    ? { backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: colors.textPrimary }
    : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border };
}

/**
 * O véu atrás de um pop-up. Nos temas normais é preto com a força que cada pop-up já tinha
 * (`normalAlpha`); no alto contraste é o véu do tema (claro no escuro, que deixa a tela de trás
 * aparecer).
 */
export function modalScrim({ colors, highContrast }: Theme, normalAlpha: number): string {
  return highContrast ? colors.scrim : `rgba(0,0,0,${normalAlpha})`;
}
