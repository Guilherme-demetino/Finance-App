import React from "react";
import { Switch, Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { ThemeProvider, useTheme } from "../theme";
import type { ThemePreferences } from "../theme";
import AppearanceScreen from "./appearance";

const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mounted: ReactTestRenderer[] = [];
const seen = {} as { theme: ReturnType<typeof useTheme> };

function ThemeSpy() {
  const theme = useTheme();
  Object.assign(seen, { theme });
  return null;
}

function mount(initial?: ThemePreferences, onChange: (p: ThemePreferences) => void = () => {}) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ThemeProvider initial={initial} onChange={onChange}>
        <ThemeSpy />
        <AppearanceScreen />
      </ThemeProvider>,
    );
  });
  mounted.push(tree);
  return tree;
}

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

/** Botão pelo texto de um dos filhos. */
function button(tree: ReactTestRenderer, label: string) {
  const found = tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === label));
  if (!found) throw new Error(`botão "${label}" não encontrado`);
  return found;
}

beforeEach(() => Object.values(mockRouter).forEach((fn) => fn.mockReset()));

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

describe("tela Aparência e acessibilidade", () => {
  it("mostra as três seções e a pré-visualização", () => {
    const text = textOf(mount());

    expect(text).toContain("Aparência e acessibilidade");
    expect(text).toContain("Tema");
    expect(text).toContain("Escuro | Fundo escuro");
    expect(text).toContain("Claro | Fundo claro");
    expect(text).toContain("Automático | Segue o tema do Android");
    expect(text).toContain("Alto contraste");
    expect(text).toContain("Tamanho da letra");
    expect(text).toContain("Padrão | 100%");
    expect(text).toContain("Grande | 115%");
    expect(text).toContain("Maior | 130%");
    expect(text).toContain("Pré-visualização");
    expect(text).toContain("Soma-se ao tamanho de letra definido nas configurações do Android.");
  });

  it("marca a opção atual como selecionada (leitores de tela)", () => {
    const tree = mount({ mode: "light", highContrast: false, fontScale: 1.15 });
    const selected = (label: string) =>
      button(tree, label).props.accessibilityState.selected as boolean;

    expect(selected("Claro")).toBe(true);
    expect(selected("Escuro")).toBe(false);
    expect(selected("Grande")).toBe(true);
    expect(selected("Padrão")).toBe(false);
  });

  it("trocar o tema vale na hora e é salvo", () => {
    const onChange = jest.fn();
    const tree = mount(undefined, onChange);
    expect(seen.theme.isDark).toBe(true);

    act(() => button(tree, "Claro").props.onPress());
    expect(seen.theme.isDark).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith({ mode: "light", highContrast: false, fontScale: 1 });

    act(() => button(tree, "Automático").props.onPress());
    expect(seen.theme.mode).toBe("system");
    expect(onChange).toHaveBeenLastCalledWith({ mode: "system", highContrast: false, fontScale: 1 });
  });

  it("o interruptor liga e desliga o alto contraste", () => {
    const onChange = jest.fn();
    const tree = mount(undefined, onChange);
    const toggle = tree.root.findByType(Switch);
    expect(toggle.props.value).toBe(false);

    act(() => toggle.props.onValueChange(true));
    expect(seen.theme.highContrast).toBe(true);
    expect(tree.root.findByType(Switch).props.value).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith({ mode: "dark", highContrast: true, fontScale: 1 });

    act(() => tree.root.findByType(Switch).props.onValueChange(false));
    expect(seen.theme.highContrast).toBe(false);
  });

  it("trocar o tamanho da letra vale na hora e é salvo", () => {
    const onChange = jest.fn();
    const tree = mount(undefined, onChange);

    act(() => button(tree, "Maior").props.onPress());

    expect(seen.theme.fontScale).toBe(1.3);
    expect(onChange).toHaveBeenLastCalledWith({ mode: "dark", highContrast: false, fontScale: 1.3 });
  });

  it("'Restaurar padrão' volta tudo ao normal e fica travado quando já está no padrão", () => {
    const onChange = jest.fn();
    const tree = mount({ mode: "light", highContrast: true, fontScale: 1.3 }, onChange);
    expect(button(tree, "Restaurar padrão").props.disabled).toBe(false);

    act(() => button(tree, "Restaurar padrão").props.onPress());

    expect(seen.theme).toMatchObject({ mode: "dark", highContrast: false, fontScale: 1 });
    expect(button(tree, "Restaurar padrão").props.disabled).toBe(true);
  });

  it("o botão de voltar volta para a tela anterior, ou para o painel se não houver", () => {
    const tree = mount();
    const back = tree.root.findAllByType(TouchableOpacity)[0];

    mockRouter.canGoBack.mockReturnValue(true);
    act(() => back.props.onPress());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);

    mockRouter.canGoBack.mockReturnValue(false);
    act(() => back.props.onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith("/dashboard");
  });
});
