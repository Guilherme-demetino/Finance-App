import React from "react";
import { Text as RNText } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { Release } from "../constants/changelog";
import { ThemeProvider } from "../theme";
import { ReleaseNotesModal } from "./ReleaseNotesModal";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const release = (id: number): Release => ({ id, date: "21/09/2026", title: `Novidade ${id}`, items: [`Mudou a coisa ${id}.`] });

const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

function mount(releases: Release[]) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ThemeProvider initial={{ mode: "dark", highContrast: false, fontScale: 1 }}>
        <ReleaseNotesModal releases={releases} onClose={() => {}} />
      </ThemeProvider>,
    );
  });
  mounted.push(tree);
  return tree;
}

const textOf = (tree: ReactTestRenderer) => tree.root.findAllByType(RNText).map((node) => [node.props.children].flat(Infinity).join(""));

describe("pop-up de novidades", () => {
  it("com uma só atualização não mostra a contagem", () => {
    const text = textOf(mount([release(1)])).join(" | ");

    expect(text).toContain("Novidade 1");
    expect(text).not.toContain("novidades desde a última vez");
  });

  it("quem perdeu várias atualizações vê todas de uma vez, com a contagem", () => {
    const shown = [8, 7, 6, 5, 4, 3, 2].map(release);

    const text = textOf(mount(shown)).join(" | ");

    expect(text).toContain("7 novidades desde a última vez que você abriu o app");
    for (const item of shown) {
      expect(text).toContain(item.title);
      expect(text).toContain(item.items[0]);
    }
  });
});
