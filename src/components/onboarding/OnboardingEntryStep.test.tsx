import React from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { OnboardingEntryStep } from "./OnboardingEntryStep";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

describe("OnboardingEntryStep", () => {
  it("sem itens: só mostra o botão de adicionar", () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<OnboardingEntryStep entries={[]} addLabel="Adicionar receita/despesa fixa" onAdd={jest.fn()} />);
    });

    expect(textOf(tree)).toContain("Adicionar receita/despesa fixa");
  });

  it("mostra uma linha por item", () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <OnboardingEntryStep
          entries={[
            { id: "1", icon: "arrow-down-outline", color: "#0f0", title: "Salário", subtitle: "Todo dia 5", amountText: "R$ 3.000,00", onRemove: jest.fn() },
            { id: "2", icon: "arrow-up-outline", color: "#f00", title: "Aluguel", subtitle: "Todo dia 10", amountText: "R$ 1.200,00", onRemove: jest.fn() },
          ]}
          addLabel="Adicionar receita/despesa fixa"
          onAdd={jest.fn()}
        />,
      );
    });

    const text = textOf(tree);
    expect(text).toContain("Salário");
    expect(text).toContain("Aluguel");
  });

  it("tocar em adicionar chama onAdd", () => {
    const onAdd = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<OnboardingEntryStep entries={[]} addLabel="Adicionar dívida ou empréstimo" onAdd={onAdd} />);
    });

    act(() => tree.root.findByType(TouchableOpacity).props.onPress());

    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
