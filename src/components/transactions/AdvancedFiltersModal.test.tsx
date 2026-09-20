import React from "react";
import { Text as RNText, TextInput, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { EMPTY_HISTORY_FILTERS, presetRange, type HistoryFilters } from "../../utils/historyFilters";
import { AdvancedFiltersModal } from "./AdvancedFiltersModal";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
// O calendário tem testes próprios: aqui basta escolher uma data.
jest.mock("../forms/CalendarPicker", () => ({
  CalendarPicker: (props: { onSelect: (date: Date) => void; visible: boolean }) => {
    mockCalendar.props = props;
    return null;
  },
}));

const mockCalendar: { props: { onSelect: (date: Date) => void; visible: boolean } | null } = { props: null };

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  mockCalendar.props = null;
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

type Props = React.ComponentProps<typeof AdvancedFiltersModal>;

function mount(over: Partial<Props> = {}) {
  const props: Props = {
    visible: true,
    value: EMPTY_HISTORY_FILTERS,
    categories: ["Alimentação", "Lazer", "Moradia"],
    onApply: jest.fn(),
    onClose: jest.fn(),
    ...over,
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<AdvancedFiltersModal {...props} />);
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

/** O botão com esse texto ou descrição de acessibilidade (o mais interno). */
function button(tree: ReactTestRenderer, label: string) {
  const matches = tree.root
    .findAllByType(TouchableOpacity)
    .filter(
      (node) =>
        node.props.accessibilityLabel === label || node.findAllByType(RNText).some((t) => flat(t.props.children) === label),
    );
  if (matches.length === 0) throw new Error(`botão "${label}" não encontrado`);
  return matches[matches.length - 1];
}

const hasButton = (tree: ReactTestRenderer, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .some((node) => node.props.accessibilityLabel === label || node.findAllByType(RNText).some((t) => flat(t.props.children) === label));

const field = (tree: ReactTestRenderer, label: string) => {
  const found = tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === label);
  if (!found) throw new Error(`campo "${label}" não encontrado`);
  return found;
};

const press = (tree: ReactTestRenderer, label: string) => act(() => button(tree, label).props.onPress());
const type = (tree: ReactTestRenderer, label: string, digits: string) => act(() => field(tree, label).props.onChangeText(digits));
const applied = (props: Props) => (props.onApply as jest.Mock).mock.calls[0][0] as HistoryFilters;

describe("filtros avançados: abrir", () => {
  it("fechado não desenha nada", () => {
    const { tree } = mount({ visible: false });

    expect(tree.toJSON()).toBeNull();
  });

  it("aberto sem filtros: mês selecionado, campos vazios e nenhuma categoria marcada", () => {
    const { tree } = mount();
    const text = textOf(tree);

    expect(text).toContain("Filtros avançados");
    expect(text).toContain("Mês selecionado");
    expect(text).toContain("Personalizado");
    expect(button(tree, "Período: Mês selecionado").props.accessibilityState.selected).toBe(true);
    expect(field(tree, "Valor mínimo").props.value).toBe("");
    expect(field(tree, "Valor máximo").props.value).toBe("");
    for (const name of ["Alimentação", "Lazer", "Moradia"]) {
      expect(button(tree, `Categoria ${name}`).props.accessibilityState.checked).toBe(false);
    }
    // Sem período personalizado não há datas nem atalhos.
    expect(hasButton(tree, "De: escolher data")).toBe(false);
  });

  it("abre já preenchido com os filtros em uso", () => {
    const { tree } = mount({
      value: { minAmount: 1250.5, maxAmount: 3000, categories: ["Lazer"], period: { from: "01/08/2026", to: "15/09/2026" } },
    });

    expect(field(tree, "Valor mínimo").props.value).toBe("1.250,50");
    expect(field(tree, "Valor máximo").props.value).toBe("3.000,00");
    expect(button(tree, "Categoria Lazer").props.accessibilityState.checked).toBe(true);
    expect(button(tree, "Categoria Moradia").props.accessibilityState.checked).toBe(false);
    expect(button(tree, "Período: Personalizado").props.accessibilityState.selected).toBe(true);
    expect(hasButton(tree, "De: 01/08/2026")).toBe(true);
    expect(hasButton(tree, "Até: 15/09/2026")).toBe(true);
  });
});

describe("filtros avançados: faixa de valor", () => {
  it("o campo mostra o valor como o app mostra e aplica em reais", () => {
    const { tree, props } = mount();

    type(tree, "Valor mínimo", "5000");
    type(tree, "Valor máximo", "125050");
    expect(field(tree, "Valor mínimo").props.value).toBe("50,00");
    expect(field(tree, "Valor máximo").props.value).toBe("1.250,50");
    press(tree, "Aplicar filtros");

    expect(applied(props)).toEqual({ minAmount: 50, maxAmount: 1250.5, categories: [], period: null });
  });

  it("só o mínimo: o máximo continua sem limite", () => {
    const { tree, props } = mount();

    type(tree, "Valor mínimo", "10000");
    press(tree, "Aplicar filtros");

    expect(applied(props)).toMatchObject({ minAmount: 100, maxAmount: null });
  });

  it("mínimo maior que o máximo: avisa e não deixa aplicar", () => {
    const { tree, props } = mount();

    type(tree, "Valor mínimo", "50000");
    type(tree, "Valor máximo", "10000");

    expect(textOf(tree)).toContain("O valor mínimo é maior que o máximo.");
    expect(button(tree, "Aplicar filtros").props.disabled).toBe(true);
    act(() => button(tree, "Aplicar filtros").props.onPress());
    expect(props.onApply).not.toHaveBeenCalled();
  });
});

describe("filtros avançados: várias categorias", () => {
  it("marca e desmarca quantas quiser e aplica todas", () => {
    const { tree, props } = mount();

    press(tree, "Categoria Alimentação");
    press(tree, "Categoria Moradia");
    press(tree, "Categoria Lazer");
    press(tree, "Categoria Moradia"); // desmarca
    expect(button(tree, "Categoria Alimentação").props.accessibilityState.checked).toBe(true);
    expect(button(tree, "Categoria Moradia").props.accessibilityState.checked).toBe(false);
    press(tree, "Aplicar filtros");

    expect(applied(props).categories).toEqual(["Alimentação", "Lazer"]);
  });

  it("'Desmarcar' limpa a seleção", () => {
    const { tree } = mount({ value: { ...EMPTY_HISTORY_FILTERS, categories: ["Lazer", "Moradia"] } });
    expect(textOf(tree)).toContain("Desmarcar (2)");

    press(tree, "Desmarcar todas as categorias");

    expect(button(tree, "Categoria Lazer").props.accessibilityState.checked).toBe(false);
    expect(hasButton(tree, "Desmarcar todas as categorias")).toBe(false);
  });

  it("sem categorias cadastradas, avisa", () => {
    const { tree } = mount({ categories: [] });

    expect(textOf(tree)).toContain("Nenhuma categoria cadastrada ainda.");
  });
});

describe("filtros avançados: período personalizado", () => {
  it("personalizado sem datas escolhidas: pede as duas datas e trava o aplicar", () => {
    const { tree } = mount();

    press(tree, "Período: Personalizado");

    expect(textOf(tree)).toContain("Escolha as duas datas do período.");
    expect(button(tree, "Aplicar filtros").props.disabled).toBe(true);
    expect(hasButton(tree, "De: escolher data")).toBe(true);
  });

  it("escolhe as duas datas no calendário e aplica", () => {
    const { tree, props } = mount();
    press(tree, "Período: Personalizado");

    press(tree, "De: escolher data");
    expect(mockCalendar.props?.visible).toBe(true);
    act(() => mockCalendar.props?.onSelect(new Date(2026, 7, 5)));
    press(tree, "Até: escolher data");
    act(() => mockCalendar.props?.onSelect(new Date(2026, 8, 15)));
    expect(hasButton(tree, "De: 05/08/2026")).toBe(true);
    expect(hasButton(tree, "Até: 15/09/2026")).toBe(true);
    press(tree, "Aplicar filtros");

    expect(applied(props).period).toEqual({ from: "05/08/2026", to: "15/09/2026" });
  });

  it("data final antes da inicial: avisa", () => {
    const { tree } = mount({ value: { ...EMPTY_HISTORY_FILTERS, period: { from: "20/09/2026", to: "20/09/2026" } } });

    press(tree, "Até: 20/09/2026");
    act(() => mockCalendar.props?.onSelect(new Date(2026, 8, 1)));

    expect(textOf(tree)).toContain("A data inicial é depois da final.");
    expect(button(tree, "Aplicar filtros").props.disabled).toBe(true);
  });

  it("os atalhos preenchem as duas datas", () => {
    const { tree, props } = mount();
    press(tree, "Período: Personalizado");

    press(tree, "Usar Últimos 30 dias");
    press(tree, "Aplicar filtros");

    expect(applied(props).period).toEqual(presetRange("last30"));
  });

  it("voltar para 'Mês selecionado' aplica sem período (as datas escolhidas ficam guardadas para o caso de voltar)", () => {
    const { tree, props } = mount({ value: { ...EMPTY_HISTORY_FILTERS, period: { from: "01/09/2026", to: "10/09/2026" } } });

    press(tree, "Período: Mês selecionado");
    press(tree, "Aplicar filtros");

    expect(applied(props).period).toBeNull();
  });
});

describe("filtros avançados: botões", () => {
  it("todos juntos numa só aplicação", () => {
    const { tree, props } = mount();
    type(tree, "Valor máximo", "20000");
    press(tree, "Categoria Lazer");
    press(tree, "Período: Personalizado");
    press(tree, "Usar Este ano");

    press(tree, "Aplicar filtros");

    expect(applied(props)).toEqual({
      minAmount: null,
      maxAmount: 200,
      categories: ["Lazer"],
      period: presetRange("thisYear"),
    });
  });

  it("'Limpar tudo' zera o formulário (sem aplicar até você confirmar)", () => {
    const { tree, props } = mount({
      value: { minAmount: 10, maxAmount: 20, categories: ["Lazer"], period: { from: "01/09/2026", to: "10/09/2026" } },
    });

    press(tree, "Limpar tudo");

    expect(field(tree, "Valor mínimo").props.value).toBe("");
    expect(button(tree, "Categoria Lazer").props.accessibilityState.checked).toBe(false);
    expect(button(tree, "Período: Mês selecionado").props.accessibilityState.selected).toBe(true);
    expect(props.onApply).not.toHaveBeenCalled();
    press(tree, "Aplicar filtros");
    expect(applied(props)).toEqual(EMPTY_HISTORY_FILTERS);
  });

  it("'Cancelar' fecha sem aplicar", () => {
    const { tree, props } = mount();
    type(tree, "Valor mínimo", "999");

    press(tree, "Cancelar");

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onApply).not.toHaveBeenCalled();
  });
});
