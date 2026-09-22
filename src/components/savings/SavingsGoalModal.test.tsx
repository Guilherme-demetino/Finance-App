import React from "react";
import { Text as RNText, TextInput, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { SavingsGoalRow } from "../../types";
import { formatCurrencyInput } from "../../utils/currency";
import { SavingsGoalModal } from "./SavingsGoalModal";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-reanimated", () => jest.requireActual("../../test/reanimatedMock").createReanimatedMock());
// O calendário tem testes próprios.
jest.mock("../forms/CalendarPicker", () => ({ CalendarPicker: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

const GOAL: SavingsGoalRow = {
  id: 7,
  name: "Viagem",
  target_amount: 5000,
  saved_amount: 1250.5,
  deadline: "31/12/2026",
  created_date: "01/09/2026",
  start_amount: 0,
};

type Props = React.ComponentProps<typeof SavingsGoalModal>;

function mount(over: Partial<Props> = {}) {
  const props: Props = {
    visible: true,
    onClose: jest.fn(),
    onSave: jest.fn(),
    formatCurrency: formatCurrencyInput,
    ...over,
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<SavingsGoalModal {...props} />);
  });
  mounted.push(tree);
  return {
    tree,
    props,
    rerender: (next: Partial<Props>) => act(() => tree.update(<SavingsGoalModal {...props} {...next} />)),
  };
}

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

const field = (tree: ReactTestRenderer, label: string) => {
  const found = tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === label);
  if (!found) throw new Error(`campo "${label}" não encontrado`);
  return found;
};

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

const type = (tree: ReactTestRenderer, label: string, digits: string) => act(() => field(tree, label).props.onChangeText(digits));

describe("formulário de meta de economia: criar", () => {
  it("abre vazio, com o título e o botão de criar", () => {
    const { tree } = mount();
    const text = textOf(tree);

    expect(text).toContain("Nova meta de economia");
    expect(text).toContain("Já tem guardado? (opcional)");
    expect(text).toContain("Criar meta");
    expect(text).not.toContain("Salvar alterações");
    expect(field(tree, "Nome da meta").props.value).toBe("");
    expect(field(tree, "Valor da meta").props.value).toBe("");
    expect(field(tree, "Valor já guardado").props.value).toBe("");
  });

  it("sem nome ou sem valor: avisa e não salva", () => {
    const { tree, props } = mount();

    act(() => button(tree, "Criar meta").props.onPress());

    expect(textOf(tree)).toContain("Preencha o nome da meta e o valor que você quer juntar.");
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("salva com os valores em reais e sem prazo quando não escolhido", () => {
    const { tree, props } = mount();
    act(() => field(tree, "Nome da meta").props.onChangeText("  Reserva  "));
    type(tree, "Valor da meta", "250000");

    act(() => button(tree, "Criar meta").props.onPress());

    expect(props.onSave).toHaveBeenCalledWith({ name: "Reserva", targetAmount: 2500, savedAmount: 0, deadline: null });
  });
});

describe("formulário de meta de economia: editar", () => {
  it("abre preenchido com a meta, com o título e o botão de editar", () => {
    const { tree } = mount({ goal: GOAL });
    const text = textOf(tree);

    expect(text).toContain("Editar meta de economia");
    expect(text).toContain("Quanto já está guardado (R$)");
    expect(text).toContain("Salvar alterações");
    expect(text).not.toContain("Nova meta de economia");
    expect(text).not.toContain("Criar meta");
    expect(field(tree, "Nome da meta").props.value).toBe("Viagem");
    expect(field(tree, "Valor da meta").props.value).toBe("5.000,00");
    expect(field(tree, "Valor já guardado").props.value).toBe("1.250,50");
    expect(button(tree, "Prazo: 31/12/2026")).toBeDefined();
  });

  it("salvar sem mexer devolve os mesmos dados da meta", () => {
    const { tree, props } = mount({ goal: GOAL });

    act(() => button(tree, "Salvar alterações").props.onPress());

    expect(props.onSave).toHaveBeenCalledWith({ name: "Viagem", targetAmount: 5000, savedAmount: 1250.5, deadline: "31/12/2026" });
  });

  it("muda nome, valor da meta e quanto já está guardado", () => {
    const { tree, props } = mount({ goal: GOAL });
    act(() => field(tree, "Nome da meta").props.onChangeText("Viagem ao Japão"));
    type(tree, "Valor da meta", "900050");
    type(tree, "Valor já guardado", "200000");

    act(() => button(tree, "Salvar alterações").props.onPress());

    expect(props.onSave).toHaveBeenCalledWith({ name: "Viagem ao Japão", targetAmount: 9000.5, savedAmount: 2000, deadline: "31/12/2026" });
  });

  it("dá para tirar o prazo", () => {
    const { tree, props } = mount({ goal: GOAL });

    act(() => button(tree, "Remover prazo").props.onPress());
    act(() => button(tree, "Salvar alterações").props.onPress());

    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ deadline: null }));
  });

  it("meta sem nada guardado: o campo abre vazio e salva como zero", () => {
    const { tree, props } = mount({ goal: { ...GOAL, saved_amount: 0, deadline: null } });

    expect(field(tree, "Valor já guardado").props.value).toBe("");
    act(() => button(tree, "Salvar alterações").props.onPress());

    expect(props.onSave).toHaveBeenCalledWith({ name: "Viagem", targetAmount: 5000, savedAmount: 0, deadline: null });
  });

  it("apagar o nome ou o valor da meta: avisa e não salva", () => {
    const { tree, props } = mount({ goal: GOAL });
    act(() => field(tree, "Nome da meta").props.onChangeText("   "));

    act(() => button(tree, "Salvar alterações").props.onPress());

    expect(textOf(tree)).toContain("Preencha o nome da meta e o valor que você quer juntar.");
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("já guardado acima da meta é permitido (a meta foi batida)", () => {
    const { tree, props } = mount({ goal: GOAL });
    type(tree, "Valor já guardado", "600000");

    act(() => button(tree, "Salvar alterações").props.onPress());

    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ savedAmount: 6000, targetAmount: 5000 }));
  });

  it("reabrir com outra meta (ou sem meta) refaz o formulário do zero", () => {
    const { tree, rerender } = mount({ goal: GOAL });
    rerender({ visible: false });

    rerender({ visible: true, goal: { ...GOAL, id: 8, name: "Carro", target_amount: 30000, saved_amount: 0, deadline: null } });
    expect(field(tree, "Nome da meta").props.value).toBe("Carro");
    expect(field(tree, "Valor da meta").props.value).toBe("30.000,00");

    rerender({ visible: false });
    rerender({ visible: true, goal: null });
    expect(field(tree, "Nome da meta").props.value).toBe("");
    expect(textOf(tree)).toContain("Nova meta de economia");
  });

  it("fechado não mostra o formulário", () => {
    const { tree } = mount({ visible: false, goal: GOAL });

    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });
});
