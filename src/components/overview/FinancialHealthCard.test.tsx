import React from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { Circle } from "react-native-svg";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { ThemeProvider } from "../../theme";
import { DARK_COLORS, HIGH_CONTRAST_LIGHT_COLORS, LIGHT_COLORS } from "../../theme/palettes";
import { computeFinancialHealth, type FinancialHealth } from "../../utils/financialHealth";
import { FinancialHealthCard } from "./FinancialHealthCard";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = new Date(2026, 8, 19, 10, 0);
const mounted: ReactTestRenderer[] = [];

const health = (over: Partial<Parameters<typeof computeFinancialHealth>[0]> = {}): FinancialHealth =>
  computeFinancialHealth({
    income: 5000,
    expense: 3000,
    budget: 4000,
    pendingDebts: [],
    includeDebts: true,
    today: TODAY,
    ...over,
  });

function mount(value: FinancialHealth, mode: "dark" | "light" = "dark", highContrast = false) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ThemeProvider initial={{ mode, highContrast, fontScale: 1 }}>
        <FinancialHealthCard health={value} />
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

const toggle = (tree: ReactTestRenderer) => tree.root.findByType(TouchableOpacity);
const ring = (tree: ReactTestRenderer) => tree.root.findAllByType(Circle);

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

describe("cartão Saúde Financeira", () => {
  it("mês saudável: nota, estado e a frase de tudo em ordem", () => {
    const text = textOf(mount(health()));

    expect(text).toContain("Saúde Financeira");
    expect(text).toContain("Saldo, orçamento e dívidas do mês numa nota só");
    expect(text).toContain("100");
    expect(text).toContain("Saudável");
    expect(text).toContain("As finanças do mês estão em ordem.");
  });

  it("o anel enche na proporção da nota, na cor do estado", () => {
    const tree = mount(health({ income: 1000, expense: 1250, budget: null }));
    const [track, progress] = ring(tree);

    const circumference = 2 * Math.PI * ((84 - 9) / 2);
    expect(progress.props.strokeDasharray).toBe(`${(circumference * 60) / 100} ${circumference}`);
    expect(track.props.stroke).toBe(DARK_COLORS.surfaceAlt);
    expect(progress.props.stroke).toBe(DARK_COLORS.categoryAmber);
    expect(textOf(tree)).toContain("Atenção");
  });

  it("em risco usa a cor de despesa e o texto Em risco", () => {
    const tree = mount(health({ income: 1000, expense: 1500, budget: null }));

    expect(ring(tree)[1].props.stroke).toBe(DARK_COLORS.expense);
    expect(textOf(tree)).toContain("Em risco");
    expect(textOf(tree)).toContain("Você gastou 50% a mais do que recebeu no mês.");
  });

  it("sem dados: traço no lugar da nota, anel vazio e sem botão de detalhes", () => {
    const tree = mount(health({ income: 0, expense: 0 }));
    const text = textOf(tree);

    expect(text).toContain("–");
    expect(text).toContain("Sem dados");
    expect(text).toContain("Registre receitas e despesas para ver a nota do mês.");
    expect(ring(tree)).toHaveLength(1);
    expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(0);
  });

  it("nota zero também não desenha o arco", () => {
    // Só a área do saldo existe e vale zero: nada para desenhar no anel.
    expect(ring(mount(health({ income: 0, expense: 300, budget: null, includeDebts: false })))).toHaveLength(1);
  });

  it("detalhes começam recolhidos; expandir mostra cada área, o porquê, os avisos e o método", () => {
    const tree = mount(health({ budget: null, includeDebts: false }));
    expect(textOf(tree)).not.toContain("Saldo do mês");
    expect(toggle(tree).props.accessibilityState).toEqual({ expanded: false });

    act(() => toggle(tree).props.onPress());
    const text = textOf(tree);

    expect(text).toContain("Ocultar detalhes");
    expect(text).toContain("Saldo do mês | 100/100");
    expect(text).toContain("Sobrou 40% da receita do mês.");
    expect(text).toContain("Defina o orçamento do mês para ele entrar na nota.");
    expect(text).toContain("As dívidas em aberto só entram na nota do mês atual.");
    expect(text).toContain("saldo do mês (peso 40), orçamento (30) e dívidas a pagar (30)");
    expect(text).toContain("A partir de 75 o mês é saudável, de 50 a 74 pede atenção e abaixo de 50 está em risco.");
    expect(toggle(tree).props.accessibilityState).toEqual({ expanded: true });

    act(() => toggle(tree).props.onPress());
    expect(textOf(tree)).not.toContain("Saldo do mês |");
  });

  it("todas as áreas com nota e frase quando há orçamento e dívida", () => {
    const tree = mount(
      health({
        budget: 3200,
        pendingDebts: [
          {
            id: 1,
            person: "Maria",
            amount: 500,
            type: "borrowed",
            description: null,
            date: "01/09/2026",
            status: "pending",
            settled_date: null,
            due_date: "10/09/2026",
          },
        ],
      }),
    );
    act(() => toggle(tree).props.onPress());
    const text = textOf(tree);

    expect(text).toContain("Orçamento | 73/100");
    expect(text).toContain("Você já usou 93% do orçamento: perto do limite.");
    expect(text).toContain("Dívidas a pagar | 80/100");
    expect(text).toContain("Você deve R$ 500,00 (10% da receita do mês), 1 vencida.");
  });

  it("leitor de tela: a nota, o estado e a frase num só bloco", () => {
    const tree = mount(health({ income: 1000, expense: 1250, budget: null }));
    const group = tree.root.findAll((n) => typeof n.type === "string" && n.props.accessible === true)[0];

    expect(group.props.accessibilityLabel).toBe(
      "Saúde financeira: nota 60 de 100, Atenção. Você gastou 25% a mais do que recebeu no mês.",
    );
    expect(
      mount(health({ income: 0, expense: 0 })).root.findAll((n) => typeof n.type === "string" && n.props.accessible === true)[0]
        .props.accessibilityLabel,
    ).toBe("Saúde financeira: Sem dados. Registre receitas e despesas para ver a nota do mês.");
  });

  it.each([
    ["claro", "light", false, LIGHT_COLORS],
    ["alto contraste claro", "light", true, HIGH_CONTRAST_LIGHT_COLORS],
  ] as const)("no tema %s usa as cores da paleta", (_name, mode, highContrast, palette) => {
    const tree = mount(health(), mode, highContrast);

    expect(ring(tree)[1].props.stroke).toBe(palette.income);
    expect(ring(tree)[0].props.stroke).toBe(palette.surfaceAlt);
  });
});
