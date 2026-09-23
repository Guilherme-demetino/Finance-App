import React from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { OnboardingEntryRow } from "./OnboardingEntryRow";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

describe("OnboardingEntryRow", () => {
  it("mostra título, subtítulo e o valor formatado", () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <OnboardingEntryRow
          icon="arrow-down-outline"
          color="#0f0"
          title="Salário"
          subtitle="Todo dia 5 • Salário"
          amountText="R$ 3.000,00"
          onRemove={jest.fn()}
        />,
      );
    });

    const text = textOf(tree);
    expect(text).toContain("Salário");
    expect(text).toContain("Todo dia 5 • Salário");
    expect(text).toContain("R$ 3.000,00");
  });

  it("tocar no X chama onRemove", () => {
    const onRemove = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <OnboardingEntryRow
          icon="card-outline"
          color="#f00"
          title="Celular"
          subtitle="8 parcelas restantes"
          amountText="R$ 100,00/mês"
          onRemove={onRemove}
        />,
      );
    });

    act(() => tree.root.findByType(TouchableOpacity).props.onPress());

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
