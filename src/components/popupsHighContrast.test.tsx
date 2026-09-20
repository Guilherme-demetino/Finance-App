import React from "react";
import { StyleSheet } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { Release } from "../constants/changelog";
import {
  DARK_COLORS,
  HIGH_CONTRAST_DARK_COLORS,
  HIGH_CONTRAST_LIGHT_COLORS,
  LIGHT_COLORS,
  type ThemeColors,
} from "../theme/palettes";
import { ThemeProvider } from "../theme";
import type { ThemePreferences } from "../theme";
import { ConfirmModal } from "./ConfirmModal";
import { CustomAlert } from "./CustomAlert";
import { ReleaseNotesModal } from "./ReleaseNotesModal";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RELEASES: Release[] = [{ id: 1, date: "20/09/2026", title: "Novidade", items: ["Algo mudou."] }];

const CASES: [string, ThemePreferences, ThemeColors, boolean][] = [
  ["escuro", { mode: "dark", highContrast: false, fontScale: 1 }, DARK_COLORS, false],
  ["claro", { mode: "light", highContrast: false, fontScale: 1 }, LIGHT_COLORS, false],
  ["escuro com alto contraste", { mode: "dark", highContrast: true, fontScale: 1 }, HIGH_CONTRAST_DARK_COLORS, true],
  ["claro com alto contraste", { mode: "light", highContrast: true, fontScale: 1 }, HIGH_CONTRAST_LIGHT_COLORS, true],
];

const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

function mount(preferences: ThemePreferences, node: React.ReactNode) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<ThemeProvider initial={preferences}>{node}</ThemeProvider>);
  });
  mounted.push(tree);
  return tree;
}

/** Estilos (já achatados) de todos os elementos nativos da tela. */
function styles(tree: ReactTestRenderer): Record<string, unknown>[] {
  return tree.root
    .findAll((n) => typeof n.type === "string")
    .map((n) => StyleSheet.flatten(n.props.style) as Record<string, unknown> | undefined)
    .filter((style): style is Record<string, unknown> => !!style);
}

const popups: [string, () => React.ReactNode][] = [
  ["novidades da atualização", () => <ReleaseNotesModal releases={RELEASES} onClose={() => {}} />],
  ["alerta", () => <CustomAlert visible title="Aviso" message="Texto" onClose={() => {}} />],
  ["confirmação", () => <ConfirmModal visible title="Título" message="Mensagem" onConfirm={() => {}} onCancel={() => {}} />],
];

describe.each(popups)("pop-up de %s", (_popup, render) => {
  it.each(CASES)("no tema %s: véu atrás e cartão com o visual do tema", (_name, preferences, palette, highContrast) => {
    const all = styles(mount(preferences, render()));

    // O véu que cobre a tela de trás usa a cor do tema (não um preto fixo).
    expect(all.some((style) => style.backgroundColor === palette.scrim && style.flex === 1)).toBe(true);

    const card = all.find((style) => style.borderRadius === 16 && style.borderColor !== undefined);
    expect(card).toBeDefined();
    if (highContrast) {
      // Borda grossa na cor do texto e fundo um tom acima do da tela: o cartão não se perde no fundo.
      expect(card).toMatchObject({
        backgroundColor: palette.surfaceAlt,
        borderWidth: 2,
        borderColor: palette.textPrimary,
      });
    } else {
      expect(card).toMatchObject({ backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border });
    }
  });
});
