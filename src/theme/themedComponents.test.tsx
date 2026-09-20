import React from "react";
import { StyleSheet } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { AutoBackupModal } from "../components/profile/AutoBackupModal";
import { ConfirmModal } from "../components/ConfirmModal";
import { CustomAlert } from "../components/CustomAlert";
import {
  DARK_COLORS,
  HIGH_CONTRAST_DARK_COLORS,
  HIGH_CONTRAST_LIGHT_COLORS,
  LIGHT_COLORS,
  type ThemeColors,
} from "./palettes";
import { ThemeProvider } from "./ThemeContext";
import type { ThemePreferences } from "./preferences";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const CASES: [string, ThemePreferences, ThemeColors][] = [
  ["escuro", { mode: "dark", highContrast: false, fontScale: 1 }, DARK_COLORS],
  ["claro", { mode: "light", highContrast: false, fontScale: 1 }, LIGHT_COLORS],
  ["escuro com alto contraste", { mode: "dark", highContrast: true, fontScale: 1 }, HIGH_CONTRAST_DARK_COLORS],
  ["claro com alto contraste", { mode: "light", highContrast: true, fontScale: 1 }, HIGH_CONTRAST_LIGHT_COLORS],
];

const mounted: ReactTestRenderer[] = [];

function mount(preferences: ThemePreferences, node: React.ReactNode) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<ThemeProvider initial={preferences}>{node}</ThemeProvider>);
  });
  mounted.push(tree);
  return tree;
}

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
});

/** Todas as cores (fundo, texto, borda) que aparecem nos elementos nativos da tela. */
function colorsIn(tree: ReactTestRenderer): Set<string> {
  const found = new Set<string>();
  for (const node of tree.root.findAll((n) => typeof n.type === "string")) {
    const style = StyleSheet.flatten(node.props.style) as Record<string, unknown> | undefined;
    if (!style) continue;
    for (const key of ["backgroundColor", "color", "borderColor"]) {
      const value = style[key];
      if (typeof value === "string") found.add(value.toUpperCase());
    }
  }
  return found;
}

const autoBackupProps = {
  visible: true,
  settings: { folderUri: "content://x", folderName: "Backups", lastAt: null, lastError: null, manualAt: null },
  isBusy: false,
  onClose: () => {},
  onChooseFolder: () => {},
  onBackupNow: () => {},
  onDisable: () => {},
};

describe.each(CASES)("componentes no tema %s", (_name, preferences, palette) => {
  it("o cartão, o texto e a borda usam as cores da paleta", () => {
    const used = colorsIn(mount(preferences, <AutoBackupModal {...autoBackupProps} />));

    expect(used).toContain(palette.surface.toUpperCase());
    expect(used).toContain(palette.textPrimary.toUpperCase());
    expect(used).toContain(palette.textMuted.toUpperCase());
    expect(used).toContain(palette.accent.toUpperCase());
  });

  it("nenhuma cor de fundo, texto ou borda vem de outra paleta", () => {
    const used = colorsIn(
      mount(
        preferences,
        <>
          <AutoBackupModal {...autoBackupProps} />
          <ConfirmModal visible title="Título" message="Mensagem" onConfirm={() => {}} onCancel={() => {}} />
          <CustomAlert visible title="Aviso" message="Texto" onClose={() => {}} />
        </>,
      ),
    );

    const others = CASES.filter(([, , colors]) => colors !== palette).map(([, , colors]) => colors);
    const mine = new Set(Object.values(palette).map((c) => c.toUpperCase()));
    for (const other of others) {
      for (const key of ["background", "surface", "surfaceAlt", "textPrimary", "textSecondary", "textMuted", "border"] as const) {
        const value = other[key].toUpperCase();
        if (!mine.has(value)) expect(used).not.toContain(value);
      }
    }
  });

  it("o botão de confirmar destrutivo usa a cor de texto própria para fundo colorido", () => {
    const tree = mount(
      preferences,
      <ConfirmModal visible destructive title="Apagar" message="Certeza?" confirmLabel="Sim, apagar" onConfirm={() => {}} onCancel={() => {}} />,
    );

    const label = tree.root.findAll(
      (n) => typeof n.type === "string" && [n.props.children].flat(Infinity).join("") === "Sim, apagar",
    )[0];
    expect((StyleSheet.flatten(label.props.style) as { color: string }).color.toUpperCase()).toBe(
      palette.textOnColor.toUpperCase(),
    );
  });

  it("o botão principal da tela do backup também", () => {
    const tree = mount(preferences, <AutoBackupModal {...autoBackupProps} />);

    const label = tree.root.findAll(
      (n) => typeof n.type === "string" && [n.props.children].flat(Infinity).join("") === "Trocar pasta",
    )[0];
    expect((StyleSheet.flatten(label.props.style) as { color: string }).color.toUpperCase()).toBe(
      palette.textOnColor.toUpperCase(),
    );
  });
});
