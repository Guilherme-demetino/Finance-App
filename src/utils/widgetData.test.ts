import type { TransactionRow } from "../types";
import type { DueItem } from "./dueReminders";
import { computeMonthBalance, formatUpcomingBills } from "./widgetData";

function transaction(over: Partial<TransactionRow>): TransactionRow {
  return {
    id: 1,
    amount: 100,
    date: "10/09/2026",
    description: "Item",
    type: "expense",
    category_id: "Alimentação",
    ...over,
  };
}

describe("computeMonthBalance", () => {
  it("soma receitas e despesas e calcula o saldo positivo", () => {
    const result = computeMonthBalance([
      transaction({ type: "income", amount: 3000 }),
      transaction({ type: "expense", amount: 1200 }),
    ]);

    expect(result.incomeText).toBe("R$ 3.000,00");
    expect(result.expenseText).toBe("R$ 1.200,00");
    expect(result.balanceText).toBe("R$ 1.800,00");
    expect(result.isPositive).toBe(true);
  });

  it("gastar mais do que ganhou dá saldo negativo", () => {
    const result = computeMonthBalance([
      transaction({ type: "income", amount: 500 }),
      transaction({ type: "expense", amount: 900 }),
    ]);

    expect(result.balanceText).toBe("- R$ 400,00");
    expect(result.isPositive).toBe(false);
  });

  it("ignora transferências entre contas", () => {
    const result = computeMonthBalance([
      transaction({ type: "income", amount: 1000 }),
      transaction({ type: "expense", amount: 1000, transfer_group_id: "tr-1" }),
    ]);

    expect(result.incomeText).toBe("R$ 1.000,00");
    expect(result.expenseText).toBe("R$ 0,00");
  });

  it("sem transações, saldo zero é considerado positivo", () => {
    const result = computeMonthBalance([]);

    expect(result.balanceText).toBe("R$ 0,00");
    expect(result.isPositive).toBe(true);
  });
});

function dueItem(over: Partial<DueItem>): DueItem {
  return {
    id: "1",
    label: "Conta",
    amount: 100,
    due: new Date(2026, 8, 20),
    kind: "pay",
    ...over,
  };
}

describe("formatUpcomingBills", () => {
  const today = new Date(2026, 8, 20);

  it("ordena as mais próximas primeiro e limita a 4", () => {
    const items = [
      dueItem({ id: "1", due: new Date(2026, 8, 25) }),
      dueItem({ id: "2", due: new Date(2026, 8, 21) }),
      dueItem({ id: "3", due: new Date(2026, 8, 22) }),
      dueItem({ id: "4", due: new Date(2026, 8, 23) }),
      dueItem({ id: "5", due: new Date(2026, 8, 24) }),
    ];

    const result = formatUpcomingBills(items, today);

    expect(result.map((item) => item.id)).toEqual(["2", "3", "4", "5"]);
  });

  it("marca hoje, amanhã e datas mais distantes como DD/MM", () => {
    const items = [
      dueItem({ id: "hoje", due: new Date(2026, 8, 20) }),
      dueItem({ id: "amanha", due: new Date(2026, 8, 21) }),
      dueItem({ id: "depois", due: new Date(2026, 8, 30) }),
    ];

    const result = formatUpcomingBills(items, today);

    expect(result.find((item) => item.id === "hoje")!.whenText).toBe("hoje");
    expect(result.find((item) => item.id === "amanha")!.whenText).toBe("amanhã");
    expect(result.find((item) => item.id === "depois")!.whenText).toBe("30/09");
  });

  it("kind 'receive' vira isReceivable, 'pay' não", () => {
    const result = formatUpcomingBills(
      [dueItem({ id: "1", kind: "receive" }), dueItem({ id: "2", kind: "pay" })],
      today,
    );

    expect(result.find((item) => item.id === "1")!.isReceivable).toBe(true);
    expect(result.find((item) => item.id === "2")!.isReceivable).toBe(false);
  });

  it("sem contas a vencer, devolve lista vazia", () => {
    expect(formatUpcomingBills([], today)).toEqual([]);
  });
});
