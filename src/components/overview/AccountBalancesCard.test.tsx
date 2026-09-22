import React from "react";
import { Text as RNText } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { EnrichedTransaction } from "../../types";
import { AccountBalancesCard } from "./AccountBalancesCard";

const mockAccounts = { options: [] as { id: number | null; name: string; color: string }[] };
jest.mock("../../hooks/useAccounts", () => ({ useAccounts: () => mockAccounts }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

const tx = (over: Partial<EnrichedTransaction>): EnrichedTransaction => ({
  id: 1,
  amount: 10,
  date: "01/09/2026",
  description: "x",
  type: "expense",
  category_id: "Outros",
  category: "Outros",
  color: "#111111",
  account: "Conta principal",
  ...over,
});

function mount(transactions: EnrichedTransaction[]) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<AccountBalancesCard transactions={transactions} />);
  });
  mounted.push(tree);
  return tree;
}

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

beforeEach(() => {
  mockAccounts.options = [];
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  mounted.length = 0;
});

describe("cartão Saldo por conta", () => {
  it("com uma só conta, não desenha nada (o Saldo Atual já basta)", () => {
    const tree = mount([tx({ account: "Conta principal", type: "income", amount: 100 })]);
    expect(tree.toJSON()).toBeNull();
  });

  it("com mais de uma conta, mostra o saldo de cada uma", () => {
    const tree = mount([
      tx({ account: "Carteira", type: "income", amount: 100 }),
      tx({ account: "Carteira", type: "expense", amount: 30 }),
      tx({ account: "Poupança", type: "expense", amount: 20 }),
    ]);

    const text = textOf(tree);
    expect(text).toContain("Carteira");
    expect(text).toContain("R$ 70,00");
    expect(text).toContain("Poupança");
    expect(text).toContain("- R$ 20,00");
  });

  it("sem nenhuma transação, não desenha nada", () => {
    const tree = mount([]);
    expect(tree.toJSON()).toBeNull();
  });
});
