import React from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { GoalEditButton } from "./GoalEditButton";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

function mount(props: React.ComponentProps<typeof GoalEditButton>) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<GoalEditButton {...props} />);
  });
  mounted.push(tree);
  return tree;
}

describe("botão Editar das metas", () => {
  it("mostra o texto Editar (não só o ícone) e descreve a ação para leitores de tela", () => {
    const tree = mount({ label: "Editar meta Viagem", onPress: jest.fn() });
    const button = tree.root.findByType(TouchableOpacity);

    expect(tree.root.findByType(RNText).props.children).toBe("Editar");
    expect(button.props.accessibilityLabel).toBe("Editar meta Viagem");
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityState).toEqual({ expanded: false });
  });

  it("aberto vira Fechar", () => {
    const tree = mount({ label: "Fechar a edição", onPress: jest.fn(), isOpen: true });

    expect(tree.root.findByType(RNText).props.children).toBe("Fechar");
    expect(tree.root.findByType(TouchableOpacity).props.accessibilityState).toEqual({ expanded: true });
  });

  it("toque chama onPress, e a área de toque é maior que o botão", () => {
    const onPress = jest.fn();
    const tree = mount({ label: "Editar", onPress });
    const button = tree.root.findByType(TouchableOpacity);

    act(() => button.props.onPress());

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button.props.hitSlop).toMatchObject({ top: 8, bottom: 8 });
  });
});
