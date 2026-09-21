import React from "react";
import { Text as RNText, TextInput, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { CategoryBudgetItem } from "../hooks/useCategoryBudgets";
import { formatCurrencyInput } from "../utils/currency";
import { CategoryBudgetsCard } from "./CategoryBudgetsCard";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
// O formulário de categoria tem o banco por trás e testes próprios.
jest.mock("./forms/CategoryModal", () => ({ CategoryModal: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

const item = (over: Partial<CategoryBudgetItem> = {}): CategoryBudgetItem => ({
  id: 1,
  category: "Alimentação",
  color: "#F97316",
  spent: 300,
  goal: 500,
  ...over,
});

type Props = React.ComponentProps<typeof CategoryBudgetsCard>;

function mount(items: CategoryBudgetItem[], over: Partial<Props> = {}) {
  const props: Props = {
    items,
    isLoading: false,
    onSaveGoal: jest.fn(),
    onRemoveGoal: jest.fn(),
    onCategoryCreated: jest.fn(),
    onDeleteCategory: jest.fn(),
    formatCurrency: formatCurrencyInput,
    ...over,
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<CategoryBudgetsCard {...props} />);
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

const byLabel = (tree: ReactTestRenderer, label: string) => tree.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === label);

function byText(tree: ReactTestRenderer, label: string) {
  const matches = tree.root
    .findAllByType(TouchableOpacity)
    .filter((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === label));
  if (matches.length === 0) throw new Error(`botão "${label}" não encontrado`);
  return matches[matches.length - 1];
}

const input = (tree: ReactTestRenderer, category: string) => {
  const found = tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === `Valor da meta de ${category}`);
  if (!found) throw new Error(`campo da meta de ${category} não encontrado`);
  return found;
};

const edit = (tree: ReactTestRenderer, category: string) => act(() => byLabel(tree, `Editar meta de ${category}`)?.props.onPress());
const type = (tree: ReactTestRenderer, category: string, digits: string) => act(() => input(tree, category).props.onChangeText(digits));

describe("cartão Metas por Categoria: editar", () => {
  it("cada categoria tem o botão Editar, e a lixeira só nas que existem na tabela", () => {
    const { tree } = mount([item(), item({ id: 2, category: "Lazer", goal: null }), item({ id: null, category: "Outros", goal: null })]);

    expect(textOf(tree).match(/Editar/g)).toHaveLength(3);
    for (const name of ["Alimentação", "Lazer", "Outros"]) expect(byLabel(tree, `Editar meta de ${name}`)).toBeDefined();
    expect(byLabel(tree, "Excluir categoria Alimentação")).toBeDefined();
    expect(byLabel(tree, "Excluir categoria Outros")).toBeUndefined(); // id nulo: não dá para excluir
  });

  it("Editar abre o campo já preenchido com a meta atual, e o botão vira Fechar", () => {
    const { tree } = mount([item()]);

    edit(tree, "Alimentação");

    expect(input(tree, "Alimentação").props.value).toBe("500,00");
    expect(textOf(tree)).toContain("Fechar");
    expect(byLabel(tree, "Fechar a edição da meta de Alimentação")).toBeDefined();
  });

  it("categoria sem meta abre o campo vazio", () => {
    const { tree } = mount([item({ goal: null })]);

    edit(tree, "Alimentação");

    expect(input(tree, "Alimentação").props.value).toBe("");
    expect(textOf(tree)).not.toContain("Remover meta"); // não há meta para remover
  });

  it("salva o novo valor em reais e fecha o editor", () => {
    const { tree, props } = mount([item()]);
    edit(tree, "Alimentação");
    type(tree, "Alimentação", "125050");

    act(() => byLabel(tree, "Salvar meta de Alimentação")?.props.onPress());

    expect(props.onSaveGoal).toHaveBeenCalledWith("Alimentação", 1250.5);
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it("Fechar sai sem salvar", () => {
    const { tree, props } = mount([item()]);
    edit(tree, "Alimentação");
    type(tree, "Alimentação", "999900");

    act(() => byLabel(tree, "Fechar a edição da meta de Alimentação")?.props.onPress());

    expect(props.onSaveGoal).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it("salvar vazio ou zero avisa e mantém o editor aberto (antes fechava em silêncio)", () => {
    const { tree, props } = mount([item()]);
    edit(tree, "Alimentação");
    type(tree, "Alimentação", "");

    act(() => byLabel(tree, "Salvar meta de Alimentação")?.props.onPress());

    expect(props.onSaveGoal).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Digite um valor maior que zero, ou use "Remover meta".');
    expect(input(tree, "Alimentação")).toBeDefined();

    // Ao digitar de novo o aviso some.
    type(tree, "Alimentação", "100");
    expect(textOf(tree)).not.toContain("Digite um valor maior que zero");
  });

  it("categoria sem meta e valor vazio: pede o valor", () => {
    const { tree } = mount([item({ goal: null })]);
    edit(tree, "Alimentação");

    act(() => byLabel(tree, "Salvar meta de Alimentação")?.props.onPress());

    expect(textOf(tree)).toContain("Digite o valor da meta.");
  });

  it("o toque na área tracejada (sem meta) também abre o editor", () => {
    const { tree } = mount([item({ goal: null, spent: 40 })]);

    act(() => byText(tree, "R$ 40,00 gastos • toque para definir uma meta").props.onPress());

    expect(input(tree, "Alimentação")).toBeDefined();
  });

  it("abrir a edição de outra categoria fecha a anterior", () => {
    const { tree } = mount([item(), item({ id: 2, category: "Lazer", goal: 200 })]);

    edit(tree, "Alimentação");
    edit(tree, "Lazer");

    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
    expect(input(tree, "Lazer").props.value).toBe("200,00");
  });
});

describe("cartão Metas por Categoria: remover meta", () => {
  it("'Remover meta' pede confirmação e só então remove a meta daquela categoria", () => {
    const { tree, props } = mount([item(), item({ id: 2, category: "Lazer", goal: 200 })]);
    edit(tree, "Alimentação");

    act(() => byLabel(tree, "Remover meta de Alimentação")?.props.onPress());
    expect(props.onRemoveGoal).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Remover a meta de "Alimentação" deste mês?');

    act(() => byText(tree, "Remover").props.onPress());

    expect(props.onRemoveGoal).toHaveBeenCalledTimes(1);
    expect(props.onRemoveGoal).toHaveBeenCalledWith("Alimentação");
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0); // o editor fecha
  });

  it("cancelar a confirmação não remove nada e mantém o editor", () => {
    const { tree, props } = mount([item()]);
    edit(tree, "Alimentação");
    act(() => byLabel(tree, "Remover meta de Alimentação")?.props.onPress());

    act(() => byText(tree, "Cancelar").props.onPress());

    expect(props.onRemoveGoal).not.toHaveBeenCalled();
    expect(input(tree, "Alimentação")).toBeDefined();
  });
});

describe("cartão Metas por Categoria: o resto continua igual", () => {
  it("mostra o gasto contra a meta e quanto falta", () => {
    const { tree } = mount([item({ spent: 300, goal: 500 })]);
    const text = textOf(tree);

    expect(text).toContain("R$ 300,00 de R$ 500,00");
    expect(text).toContain("R$ 200,00 restantes");
  });

  it("acima da meta mostra quanto passou", () => {
    expect(textOf(mount([item({ spent: 620, goal: 500 })]).tree)).toContain("R$ 120,00 acima");
  });

  it("excluir categoria continua pedindo confirmação", () => {
    const { tree, props } = mount([item()]);

    act(() => byLabel(tree, "Excluir categoria Alimentação")?.props.onPress());
    expect(props.onDeleteCategory).not.toHaveBeenCalled();
    act(() => byText(tree, "Excluir").props.onPress());

    expect(props.onDeleteCategory).toHaveBeenCalledWith(1);
  });

  it("sem categorias, explica", () => {
    expect(textOf(mount([]).tree)).toContain("Crie categorias de despesa para poder definir metas.");
  });
});
