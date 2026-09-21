import type { DebtRow } from "../types";
import { buildAlerts } from "./alerts";

const TODAY = new Date(2026, 8, 18); // 18/09/2026

function makeDebt(overrides: Partial<DebtRow> = {}): DebtRow {
  return {
    id: 1,
    person: "João",
    amount: 200,
    type: "lent",
    description: null,
    date: "01/09/2026",
    status: "pending",
    settled_date: null,
    due_date: null,
    ...overrides,
  };
}

const base = { budget: null, totalExpense: 0, categories: [], pendingDebts: [], today: TODAY };

describe("buildAlerts - orçamento e metas", () => {
  it("não avisa abaixo de 80%", () => {
    expect(buildAlerts({ ...base, budget: 1000, totalExpense: 700 })).toEqual([]);
  });

  it("avisa (amarelo) a partir de 80% do orçamento", () => {
    const [alert] = buildAlerts({ ...base, budget: 1000, totalExpense: 850 });
    expect(alert.level).toBe("warning");
    expect(alert.message).toContain("85%");
  });

  it("marca como estourado (vermelho) quando passa do orçamento", () => {
    const [alert] = buildAlerts({ ...base, budget: 1000, totalExpense: 1200 });
    expect(alert.level).toBe("danger");
    expect(alert.message).toContain("estourou");
  });

  it("avisa por categoria e ignora as sem meta", () => {
    const alerts = buildAlerts({
      ...base,
      categories: [
        { category: "Lazer", spent: 90, goal: 100 },
        { category: "Moradia", spent: 500, goal: null },
        { category: "Saúde", spent: 130, goal: 100 },
      ],
    });
    expect(alerts.map((a) => a.id)).toEqual(["category-Saúde", "category-Lazer"]);
    expect(alerts[0].level).toBe("danger");
    expect(alerts[1].level).toBe("warning");
  });

  it("não fala de orçamento quando includeSpendingAlerts é false", () => {
    expect(
      buildAlerts({
        ...base,
        budget: 100,
        totalExpense: 500,
        includeSpendingAlerts: false,
      }),
    ).toEqual([]);
  });
});

describe("buildAlerts - dívidas", () => {
  it("avisa dívida vencida em vermelho, cobrando ou pagando conforme o tipo", () => {
    const alerts = buildAlerts({
      ...base,
      pendingDebts: [
        makeDebt({ id: 1, due_date: "10/09/2026", type: "lent" }),
        makeDebt({ id: 2, person: "Ana", due_date: "01/09/2026", type: "borrowed" }),
      ],
    });
    expect(alerts.map((a) => a.level)).toEqual(["danger", "danger"]);
    expect(alerts[0].message).toContain("Cobrar João");
    expect(alerts[1].message).toContain("Pagar Ana");
  });

  it("avisa hoje e nos próximos 3 dias, mas não além", () => {
    const alerts = buildAlerts({
      ...base,
      pendingDebts: [
        makeDebt({ id: 1, due_date: "18/09/2026" }),
        makeDebt({ id: 2, due_date: "20/09/2026" }),
        makeDebt({ id: 3, due_date: "21/09/2026" }),
        makeDebt({ id: 4, due_date: "22/09/2026" }),
        makeDebt({ id: 5, due_date: null }),
      ],
    });
    expect(alerts.map((a) => a.id)).toEqual(["debt-1", "debt-2", "debt-3"]);
    expect(alerts[0].message).toContain("vence hoje");
    expect(alerts[1].message).toContain("vence em 2 dias");
  });

  it("coloca os graves antes dos avisos", () => {
    const alerts = buildAlerts({
      ...base,
      budget: 1000,
      totalExpense: 900,
      pendingDebts: [makeDebt({ due_date: "01/09/2026" })],
    });
    expect(alerts.map((a) => a.level)).toEqual(["danger", "warning"]);
  });
});
