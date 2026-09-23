import React from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { InstallmentRecurrenceFields } from "./InstallmentRecurrenceFields";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

function button(tree: ReactTestRenderer, label: string) {
  const found = tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === label));
  if (!found) throw new Error(`botão "${label}" não encontrado`);
  return found;
}

function baseProps(over: Partial<React.ComponentProps<typeof InstallmentRecurrenceFields>> = {}) {
  return {
    isRecurring: false,
    setIsRecurring: jest.fn(),
    recurringMonths: 12,
    setRecurringMonths: jest.fn(),
    installmentCount: 1,
    setInstallmentCount: jest.fn(),
    numericAmount: 100,
    hasValidAmount: true,
    ...over,
  };
}

function mount(over: Partial<React.ComponentProps<typeof InstallmentRecurrenceFields>> = {}) {
  const props = baseProps(over);
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<InstallmentRecurrenceFields {...props} />);
  });
  mounted.push(tree);
  return { tree, props };
}

describe("InstallmentRecurrenceFields", () => {
  it("nem recorrente nem parcelado: não mostra as opções de meses/parcelas nem os avisos", () => {
    const { tree } = mount();

    expect(textOf(tree)).not.toContain("meses");
    expect(textOf(tree)).not.toContain("valor total");
  });

  it("ligar 'Recorrente' zera o parcelamento", () => {
    const { tree, props } = mount({ installmentCount: 3 });

    act(() => button(tree, "Recorrente").props.onPress());

    expect(props.setIsRecurring).toHaveBeenCalledWith(true);
    expect(props.setInstallmentCount).toHaveBeenCalledWith(1);
  });

  it("recorrente: mostra as opções de meses e o aviso de repetição", () => {
    const { tree } = mount({ isRecurring: true, recurringMonths: 6 });

    expect(textOf(tree)).toContain("6 meses");
    expect(textOf(tree)).toContain("pelos próximos 6 meses");
  });

  it("escolher um número de meses chama setRecurringMonths", () => {
    const { tree, props } = mount({ isRecurring: true });

    act(() => button(tree, "3 meses").props.onPress());

    expect(props.setRecurringMonths).toHaveBeenCalledWith(3);
  });

  it("ligar 'Parcelar' desliga a recorrência e começa em 2x", () => {
    const { tree, props } = mount();

    act(() => button(tree, "Parcelar").props.onPress());

    expect(props.setInstallmentCount).toHaveBeenCalledWith(2);
    expect(props.setIsRecurring).toHaveBeenCalledWith(false);
  });

  it("clicar em 'Parcelar' de novo, já parcelado, volta para 1x", () => {
    const { tree, props } = mount({ installmentCount: 3 });

    act(() => button(tree, "Parcelar").props.onPress());

    expect(props.setInstallmentCount).toHaveBeenCalledWith(1);
  });

  it("parcelado: mostra as opções de parcelas e o valor de cada uma", () => {
    const { tree } = mount({ installmentCount: 2, numericAmount: 100 });

    expect(textOf(tree)).toContain("2x de");
    expect(textOf(tree)).toContain("valor total");
  });

  it("parcelado mas sem valor válido: não mostra o resumo do valor", () => {
    const { tree } = mount({ installmentCount: 2, hasValidAmount: false });

    expect(textOf(tree)).not.toContain("valor total");
  });

  it("escolher um número de parcelas chama setInstallmentCount", () => {
    const { tree, props } = mount({ installmentCount: 2 });

    act(() => button(tree, "4x").props.onPress());

    expect(props.setInstallmentCount).toHaveBeenCalledWith(4);
  });
});
