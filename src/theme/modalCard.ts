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
