import React from "react";
import { StyleSheet, View } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import {
  DARK_COLORS,
  HIGH_CONTRAST_DARK_COLORS,
  HIGH_CONTRAST_LIGHT_COLORS,
  LIGHT_COLORS,
} from "./palettes";
import type { ThemePreferences } from "./preferences";
import { Text, TextInput } from "./Text";
import { makeStyles } from "./makeStyles";
import { ThemeProvider, useTheme, useThemeActions } from "./ThemeContext";

const mockScheme: { value: "light" | "dark" | null } = { value: "dark" };
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: () => mockScheme.value,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Seen = {
  theme: ReturnType<typeof useTheme>;
  actions: ReturnType<typeof useThemeActions>;
};

function createProbe() {
  const seen = {} as Seen;
  function Probe() {
    seen.theme = useTheme();
    seen.actions = useThemeActions();
    return null;
  }
  return { seen, Probe };
}

const mounted: ReactTestRenderer[] = [];

function mount(node: React.ReactNode) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<>{node}</>);
  });
  mounted.push(tree);
  return tree;
}

const withProvider = (
  initial: ThemePreferences | undefined,
  onChange: ((p: ThemePreferences) => void) | undefined,
  children: React.ReactNode,
) => (
  <ThemeProvider initial={initial} onChange={onChange}>
    {children}
  </ThemeProvider>
);

beforeEach(() => {
  mockScheme.value = "dark";
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
});

describe("ThemeProvider", () => {
  it("começa no escuro, sem alto contraste e com letra padrão", () => {
    const { seen, Probe } = createProbe();
    mount(withProvider(undefined, undefined, <Probe />));

    expect(seen.theme).toMatchObject({ isDark: true, mode: "dark", highContrast: false, fontScale: 1 });
    expect(seen.theme.colors).toBe(DARK_COLORS);
  });

  it("sem provider, useTheme devolve o escuro (o app não quebra)", () => {
    const seen = {} as { theme: ReturnType<typeof useTheme> };
    function Probe() {
      seen.theme = useTheme();
      return null;
    }
    mount(<Probe />);
    expect(seen.theme.colors).toBe(DARK_COLORS);
  });

  it("trocar para claro e para alto contraste muda a paleta e avisa quem salva", () => {
    const onChange = jest.fn();
    const { seen, Probe } = createProbe();
    mount(withProvider(undefined, onChange, <Probe />));

    act(() => seen.actions.setMode("light"));
    expect(seen.theme.colors).toBe(LIGHT_COLORS);
    expect(onChange).toHaveBeenLastCalledWith({ mode: "light", highContrast: false, fontScale: 1 });

    act(() => seen.actions.setHighContrast(true));
    expect(seen.theme.colors).toBe(HIGH_CONTRAST_LIGHT_COLORS);
    expect(onChange).toHaveBeenLastCalledWith({ mode: "light", highContrast: true, fontScale: 1 });

    act(() => seen.actions.setMode("dark"));
    expect(seen.theme.colors).toBe(HIGH_CONTRAST_DARK_COLORS);

    act(() => seen.actions.setFontScale(1.3));
    expect(seen.theme.fontScale).toBe(1.3);
    expect(onChange).toHaveBeenLastCalledWith({ mode: "dark", highContrast: true, fontScale: 1.3 });
  });

  it("começa com as preferências salvas", () => {
    const { seen, Probe } = createProbe();
    mount(withProvider({ mode: "light", highContrast: true, fontScale: 1.15 }, undefined, <Probe />));

    expect(seen.theme).toMatchObject({ isDark: false, highContrast: true, fontScale: 1.15 });
    expect(seen.theme.colors).toBe(HIGH_CONTRAST_LIGHT_COLORS);
  });

  it("'Automático' segue o tema do sistema, inclusive quando ele muda", () => {
    const { seen, Probe } = createProbe();
    mockScheme.value = "light";
    const tree = mount(withProvider({ mode: "system", highContrast: false, fontScale: 1 }, undefined, <Probe />));
    expect(seen.theme.isDark).toBe(false);

    mockScheme.value = "dark";
    act(() => {
      tree.update(withProvider({ mode: "system", highContrast: false, fontScale: 1 }, undefined, <Probe />));
    });
    // o provider guarda o estado inicial; o sistema é lido a cada render
    expect(seen.theme.isDark).toBe(true);
  });

  it("'Automático' sem informação do sistema fica escuro", () => {
    const { seen, Probe } = createProbe();
    mockScheme.value = null;
    mount(withProvider({ mode: "system", highContrast: false, fontScale: 1 }, undefined, <Probe />));
    expect(seen.theme.isDark).toBe(true);
  });

  it("as ações mantêm a mesma identidade entre renders", () => {
    const { seen, Probe } = createProbe();
    mount(withProvider(undefined, undefined, <Probe />));
    const first = seen.actions;

    act(() => seen.actions.setFontScale(1.15));

    expect(seen.actions.setMode).toBe(first.setMode);
  });

  it("useThemeActions fora do provider dá erro claro", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    function Bad() {
      useThemeActions();
      return null;
    }
    expect(() => mount(<Bad />)).toThrow("ThemeProvider");
    jest.restoreAllMocks();
  });
});

describe("Text e TextInput aplicam o tamanho da letra", () => {
  // O elemento nativo (o último com esse testID) é quem recebe o estilo já escalado.
  const hostStyle = (tree: ReactTestRenderer, testID: string) => {
    const nodes = tree.root.findAll((node) => node.props.testID === testID && typeof node.type === "string");
    return StyleSheet.flatten(nodes[nodes.length - 1].props.style);
  };
  const fontSizeOf = (tree: ReactTestRenderer, testID: string) => hostStyle(tree, testID)?.fontSize;

  function Sample() {
    return (
      <>
        <Text testID="text" style={{ fontSize: 20, lineHeight: 30 }}>
          oi
        </Text>
        <TextInput testID="input" style={{ fontSize: 10 }} />
        <Text testID="plain">sem tamanho</Text>
      </>
    );
  }

  it("letra padrão não mexe em nada", () => {
    const tree = mount(withProvider(undefined, undefined, <Sample />));
    expect(fontSizeOf(tree, "text")).toBe(20);
    expect(fontSizeOf(tree, "input")).toBe(10);
  });

  it.each([
    [1.15, 23, 11.5],
    [1.3, 26, 13],
  ])("escala %s", (scale, expectedText, expectedInput) => {
    const tree = mount(
      withProvider({ mode: "dark", highContrast: false, fontScale: scale as 1.15 | 1.3 }, undefined, <Sample />),
    );

    expect(fontSizeOf(tree, "text")).toBeCloseTo(expectedText, 5);
    expect(fontSizeOf(tree, "input")).toBeCloseTo(expectedInput, 5);
    expect(hostStyle(tree, "text")?.lineHeight).toBeCloseTo(30 * scale, 5);
    // texto sem tamanho definido parte do padrão do React Native (14)
    expect(fontSizeOf(tree, "plain")).toBeCloseTo(14 * scale, 5);
  });

  it("trocar o tamanho com o app aberto atualiza o texto na hora", () => {
    const { seen, Probe } = createProbe();
    const tree = mount(
      withProvider(
        undefined,
        undefined,
        <>
          <Probe />
          <Sample />
        </>,
      ),
    );
    expect(fontSizeOf(tree, "text")).toBe(20);

    act(() => seen.actions.setFontScale(1.3));

    expect(fontSizeOf(tree, "text")).toBeCloseTo(26, 5);
  });
});

describe("makeStyles", () => {
  const useBoxStyles = makeStyles(({ colors }) => ({
    box: { backgroundColor: colors.surface, borderColor: colors.border },
  }));

  function Box() {
    const styles = useBoxStyles();
    return <View testID="box" style={styles.box} />;
  }

  const bg = (tree: ReactTestRenderer) =>
    StyleSheet.flatten(tree.root.findByProps({ testID: "box" }).props.style)?.backgroundColor;

  it("usa as cores do tema atual e acompanha as trocas", () => {
    const { seen, Probe } = createProbe();
    const tree = mount(
      withProvider(
        undefined,
        undefined,
        <>
          <Probe />
          <Box />
        </>,
      ),
    );
    expect(bg(tree)).toBe(DARK_COLORS.surface);

    act(() => seen.actions.setMode("light"));
    expect(bg(tree)).toBe(LIGHT_COLORS.surface);

    act(() => seen.actions.setHighContrast(true));
    expect(bg(tree)).toBe(HIGH_CONTRAST_LIGHT_COLORS.surface);
  });

  it("não refaz os estilos se o tema não mudou", () => {
    const factory = jest.fn(({ colors }: { colors: typeof DARK_COLORS }) => ({
      box: { backgroundColor: colors.surface },
    }));
    const useStyles = makeStyles(factory);
    const seen = {} as { styles: ReturnType<typeof useStyles> };
    function Probe() {
      seen.styles = useStyles();
      return null;
    }
    const tree = mount(withProvider(undefined, undefined, <Probe />));
    const first = seen.styles;

    act(() => {
      tree.update(withProvider(undefined, undefined, <Probe />));
    });

    expect(seen.styles).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
