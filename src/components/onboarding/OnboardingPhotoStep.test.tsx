import React from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { OnboardingPhotoStep } from "./OnboardingPhotoStep";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

function mount(props: React.ComponentProps<typeof OnboardingPhotoStep>) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<OnboardingPhotoStep {...props} />);
  });
  return tree;
}

describe("OnboardingPhotoStep", () => {
  it("sem foto: mostra o rótulo de escolher e não mostra 'Remover foto'", () => {
    const tree = mount({
      avatarUri: null,
      addLabel: "Escolher foto da galeria",
      onPickImage: jest.fn(),
      onRemoveImage: jest.fn(),
    });

    expect(textOf(tree)).toContain("Escolher foto da galeria");
    expect(textOf(tree)).not.toContain("Remover foto");
  });

  it("com foto: troca o rótulo e mostra 'Remover foto'", () => {
    const tree = mount({
      avatarUri: "file://foto.jpg",
      addLabel: "Escolher foto da galeria",
      onPickImage: jest.fn(),
      onRemoveImage: jest.fn(),
    });

    expect(textOf(tree)).toContain("Escolher outra foto");
    expect(textOf(tree)).toContain("Remover foto");
  });

  it("tocar em 'Remover foto' chama onRemoveImage", () => {
    const onRemoveImage = jest.fn();
    const tree = mount({
      avatarUri: "file://foto.jpg",
      addLabel: "Escolher foto da galeria",
      onPickImage: jest.fn(),
      onRemoveImage,
    });

    const removeButton = tree.root
      .findAllByType(TouchableOpacity)
      .find((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === "Remover foto"))!;
    act(() => removeButton.props.onPress());

    expect(onRemoveImage).toHaveBeenCalledTimes(1);
  });

  it("tocar no botão de escolher chama onPickImage", () => {
    const onPickImage = jest.fn();
    const tree = mount({
      avatarUri: null,
      addLabel: "Escolher foto da galeria",
      onPickImage,
      onRemoveImage: jest.fn(),
    });

    const pickButton = tree.root
      .findAllByType(TouchableOpacity)
      .find((node) =>
        node.findAllByType(RNText).some((t) => flat(t.props.children) === "Escolher foto da galeria"),
      )!;
    act(() => pickButton.props.onPress());

    expect(onPickImage).toHaveBeenCalledTimes(1);
  });
});
