import React from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { UndoSnackbar } from "./UndoSnackbar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.useRealTimers();
});

function mount(props: React.ComponentProps<typeof UndoSnackbar>) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<UndoSnackbar {...props} />);
  });
  mounted.push(tree);
  return tree;
}

describe("snackbar de desfazer exclusão", () => {
  it("mostra a descrição da transação excluída", () => {
    const tree = mount({ description: "Mercado", onUndo: jest.fn(), onDismiss: jest.fn() });

    const texts = tree.root.findAllByType(RNText).map((node) => node.props.children);
    expect(texts.flat().join("")).toContain("Mercado");
  });

  it("toque em Desfazer chama onUndo", () => {
    const onUndo = jest.fn();
    const tree = mount({ description: "Mercado", onUndo, onDismiss: jest.fn() });

    act(() => tree.root.findByType(TouchableOpacity).props.onPress());

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("some sozinho depois de um tempo, chamando onDismiss", () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    mount({ description: "Mercado", onUndo: jest.fn(), onDismiss });

    expect(onDismiss).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(6000));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("trocar a transação exibida reinicia a contagem (não soma ao tempo anterior)", () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    const tree = mount({ description: "Mercado", onUndo: jest.fn(), onDismiss });

    act(() => jest.advanceTimersByTime(4000));
    act(() => {
      tree.update(<UndoSnackbar description="Uber" onUndo={jest.fn()} onDismiss={onDismiss} />);
    });
    act(() => jest.advanceTimersByTime(4000));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(2000));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
