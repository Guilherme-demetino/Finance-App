import { groupBalancesByAccount } from "./accountBalances";
import type { EnrichedTransaction } from "../types";

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

describe("groupBalancesByAccount", () => {
  it("separa receita e despesa por conta, com o saldo de cada uma", () => {
    const result = groupBalancesByAccount([
      tx({ account: "Carteira", type: "income", amount: 100 }),
      tx({ account: "Carteira", type: "expense", amount: 30 }),
      tx({ account: "Poupança", type: "expense", amount: 20 }),
    ]);

    expect(result).toEqual([
      { account: "Carteira", income: 100, expense: 30, balance: 70 },
      { account: "Poupança", income: 0, expense: 20, balance: -20 },
    ]);
  });

  it("ordena da conta com maior saldo para a de menor", () => {
    const result = groupBalancesByAccount([
      tx({ account: "A", type: "expense", amount: 50 }),
      tx({ account: "B", type: "income", amount: 50 }),
    ]);

    expect(result.map((r) => r.account)).toEqual(["B", "A"]);
  });

  it("sem conta (undefined ou em branco) cai na conta padrão", () => {
    const result = groupBalancesByAccount([
      tx({ account: undefined, type: "income", amount: 10 }),
      tx({ account: "   ", type: "income", amount: 5 }),
    ]);

    expect(result).toEqual([{ account: "Conta principal", income: 15, expense: 0, balance: 15 }]);
  });

  it("sem transações, lista vazia", () => {
    expect(groupBalancesByAccount([])).toEqual([]);
  });
});
