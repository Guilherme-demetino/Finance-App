import React from "react";
import { Image } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { OnboardingStepVisual } from "./OnboardingStepVisual";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(props: React.ComponentProps<typeof OnboardingStepVisual>) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<OnboardingStepVisual {...props} />);
  });
  return tree;
}

describe("OnboardingStepVisual", () => {
  it("passo de foto sem avatar: não mostra nenhuma imagem", () => {
    const tree = mount({ isPhotoStep: true, icon: "person-circle-outline", avatarUri: null });

    expect(tree.root.findAllByType(Image)).toHaveLength(0);
  });

  it("passo de foto com avatar: mostra a imagem escolhida", () => {
    const tree = mount({ isPhotoStep: true, icon: "person-circle-outline", avatarUri: "file://foto.jpg" });

    const image = tree.root.findByType(Image);
    expect(image.props.source).toEqual({ uri: "file://foto.jpg" });
  });

  it("outros passos: não mostra imagem, independente do avatarUri", () => {
    const tree = mount({ isPhotoStep: false, icon: "repeat-outline", avatarUri: "file://foto.jpg" });

    expect(tree.root.findAllByType(Image)).toHaveLength(0);
  });
});
