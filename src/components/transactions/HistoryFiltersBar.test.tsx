import React from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { EMPTY_HISTORY_FILTERS, type HistoryFilters } from "../../utils/historyFilters";
import { HistoryFiltersBar } from "./HistoryFiltersBar";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

type Props = React.ComponentProps<typeof HistoryFiltersBar>;

function mount(filters: HistoryFilters, over: Partial<Props> = {}) {
  const props: Props = {
    filters,
    summary: { count: 3, income: 3000, expense: 170.5 },
    onOpen: jest.fn(),
    onClear: jest.fn(),
    onClearAll: jest.fn(),
    ...over,
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<HistoryFiltersBar {...props} />);
  });
  mounted.push(tree);
  return { tree, props };
}

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

const byLabel = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === label);

const ALL: HistoryFilters = {
  minAmount: 50,
  maxAmount: 500,
  categories: ["Alimentação", "Lazer"],
  period: { from: "01/09/2026", to: "20/09/2026" },
};

describe("barra de filtros do histórico", () => {
  it("sem filtros: só o botão Filtros, sem etiquetas nem resumo", () => {
    const { tree } = mount(EMPTY_HISTORY_FILTERS);

    expect(textOf(tree)).toBe("Filtros");
    expect(byLabel(tree, "Filtros avançados")).toBeDefined();
    expect(byLabel(tree, "Limpar todos os filtros")).toBeUndefined();
  });

  it("abre o modal de filtros", () => {
    const { tree, props } = mount(EMPTY_HISTORY_FILTERS);

    act(() => byLabel(tree, "Filtros avançados")?.props.onPress());

    expect(props.onOpen).toHaveBeenCalledTimes(1);
  });

  it("com filtros: conta os grupos ativos, mostra uma etiqueta para cada e o resumo", () => {
    const { tree } = mount(ALL);
    const text = textOf(tree);

    expect(text).toContain("Filtros (3)");
    expect(byLabel(tree, "Filtros avançados, 3 ativos")).toBeDefined();
    expect(text).toContain("Valor: R$ 50,00 a R$ 500,00");
    expect(text).toContain("Categorias: Alimentação, Lazer");
    expect(text).toContain("Período: 01/09/2026 a 20/09/2026");
    expect(text).toContain("3 transações");
    expect(text).toContain("Receitas R$ 3.000,00");
    expect(text).toContain("Despesas R$ 170,50");
  });

  it("cada etiqueta remove só o seu filtro", () => {
    const { tree, props } = mount(ALL);

    act(() => byLabel(tree, "Remover filtro: Valor: R$ 50,00 a R$ 500,00")?.props.onPress());
    act(() => byLabel(tree, "Remover filtro: Categorias: Alimentação, Lazer")?.props.onPress());
    act(() => byLabel(tree, "Remover filtro: Período: 01/09/2026 a 20/09/2026")?.props.onPress());

    expect((props.onClear as jest.Mock).mock.calls.map(([kind]) => kind)).toEqual(["value", "categories", "period"]);
  });

  it("'Limpar filtros' tira todos de uma vez", () => {
    const { tree, props } = mount({ ...EMPTY_HISTORY_FILTERS, maxAmount: 10 });

    act(() => byLabel(tree, "Limpar todos os filtros")?.props.onPress());

    expect(props.onClearAll).toHaveBeenCalledTimes(1);
  });

  it("resumo no singular e sem totais quando nada apareceu", () => {
    expect(textOf(mount(ALL, { summary: { count: 1, income: 0, expense: 20 } }).tree)).toContain("1 transação");
    const empty = textOf(mount(ALL, { summary: { count: 0, income: 0, expense: 0 } }).tree);

    expect(empty).toContain("0 transações");
    expect(empty).not.toContain("Receitas");
  });

  it("período que não carregou: avisa no lugar do resumo", () => {
    const { tree } = mount(ALL, { hasError: true });
    const text = textOf(tree);

    expect(text).toContain("Não foi possível carregar as transações desse período. Tente de novo.");
    expect(text).not.toContain("transações ·");
    expect(text).not.toContain("Receitas");
  });

  it("três ou mais categorias viram só a contagem", () => {
    const { tree } = mount({ ...EMPTY_HISTORY_FILTERS, categories: ["A", "B", "C"] });

    expect(textOf(tree)).toContain("3 categorias");
    expect(textOf(tree)).toContain("Filtros (1)");
  });
});
