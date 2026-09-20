import {
  buildBudgetNotification,
  collectUsage,
  levelFor,
  parseAlertState,
  periodKey,
  planBudgetAlerts,
  TOTAL_BUDGET_KEY,
  type BudgetAlertState,
  type BudgetUsage,
} from "./budgetAlerts";

const usage = (over: Partial<BudgetUsage> = {}): BudgetUsage => ({
  key: "category:alimentação",
  label: "Alimentação",
  spent: 0,
  limit: 1000,
  ...over,
});

const state = (items: BudgetAlertState["items"], period = "2026-09"): BudgetAlertState => ({ period, items });

describe("levelFor", () => {
  it("dentro, perto (a partir de 80%) e estourado (100% ou mais)", () => {
    expect(levelFor(0, 1000)).toBe(0);
    expect(levelFor(799.99, 1000)).toBe(0);
    expect(levelFor(800, 1000)).toBe(1);
    expect(levelFor(999.99, 1000)).toBe(1);
    expect(levelFor(1000, 1000)).toBe(2);
    expect(levelFor(2500, 1000)).toBe(2);
  });

  it("sem limite válido, nunca alerta", () => {
    expect(levelFor(500, 0)).toBe(0);
    expect(levelFor(500, -10)).toBe(0);
    expect(levelFor(500, NaN)).toBe(0);
  });
});

describe("collectUsage", () => {
  it("soma o gasto de cada categoria da meta, sem diferenciar maiúsculas nem espaços", () => {
    const usages = collectUsage({
      expenses: [
        { category_id: "Alimentação", amount: 300 },
        { category_id: " alimentação ", amount: 200 },
        { category_id: "Transporte", amount: 90 },
      ],
      goals: [
        { category: "ALIMENTAÇÃO", amount: 1000 },
        { category: "Lazer", amount: 200 },
      ],
      budget: null,
    });

    expect(usages).toEqual([
      { key: "category:alimentação", label: "ALIMENTAÇÃO", spent: 500, limit: 1000 },
      { key: "category:lazer", label: "Lazer", spent: 0, limit: 200 },
    ]);
  });

  it("o orçamento do mês conta todas as despesas, até as sem categoria", () => {
    const usages = collectUsage({
      expenses: [
        { category_id: "Alimentação", amount: 300 },
        { category_id: "", amount: 50 },
      ],
      goals: [],
      budget: 2000,
    });

    expect(usages).toEqual([{ key: TOTAL_BUDGET_KEY, label: "Orçamento do mês", spent: 350, limit: 2000 }]);
  });

  it("ignora orçamento indefinido ou zero e meta zerada", () => {
    expect(collectUsage({ expenses: [{ category_id: "A", amount: 10 }], goals: [{ category: "A", amount: 0 }], budget: 0 })).toEqual([]);
    expect(collectUsage({ expenses: [], goals: [], budget: null })).toEqual([]);
  });
});

describe("estado do que já foi avisado", () => {
  it("chave do mês", () => {
    expect(periodKey(new Date(2026, 8, 5))).toBe("2026-09");
    expect(periodKey(new Date(2026, 0, 31))).toBe("2026-01");
  });

  it("lê o que foi salvo e recusa o que está estragado", () => {
    const saved = state({ budget: { level: 1, spent: 850 }, "category:lazer": { level: 2, spent: 300 } });

    expect(parseAlertState(JSON.stringify(saved))).toEqual(saved);
    for (const bad of [null, "", "lixo", "[]", "null", '{"period":5,"items":{}}', '{"period":"2026-09"}', '{"period":"2026-09","items":{"a":{"level":3,"spent":1}}}', '{"period":"2026-09","items":{"a":{"level":1}}}']) {
      expect(parseAlertState(bad)).toBeNull();
    }
  });
});

describe("planBudgetAlerts", () => {
  const plan = (usages: BudgetUsage[], previous: BudgetAlertState | null, period = "2026-09") =>
    planBudgetAlerts({ usages, previous, period });

  it("sem estado anterior só anota o ponto de partida: não avisa sobre o que já estava assim", () => {
    const result = plan([usage({ spent: 950 })], null);

    expect(result.baseline).toBe(true);
    expect(result.notices).toEqual([]);
    expect(result.next).toEqual(state({ "category:alimentação": { level: 1, spent: 950 } }));
  });

  it("gastar até 80% avisa que está perto; depois estourar avisa de novo", () => {
    const start = state({ "category:alimentação": { level: 0, spent: 100 } });

    const near = plan([usage({ spent: 850 })], start);
    expect(near.notices).toMatchObject([{ key: "category:alimentação", level: 1, spent: 850 }]);

    const over = plan([usage({ spent: 1100 })], near.next);
    expect(over.notices).toMatchObject([{ level: 2, spent: 1100 }]);
  });

  it("pular direto para o estouro avisa uma vez só, como estouro", () => {
    const result = plan([usage({ spent: 1200 })], state({ "category:alimentação": { level: 0, spent: 100 } }));

    expect(result.notices).toHaveLength(1);
    expect(result.notices[0].level).toBe(2);
  });

  it("não repete o aviso enquanto continua no mesmo nível, mesmo gastando mais", () => {
    const seen = state({ "category:alimentação": { level: 1, spent: 850 } });

    expect(plan([usage({ spent: 900 })], seen).notices).toEqual([]);
    expect(plan([usage({ spent: 850 })], seen).notices).toEqual([]);
  });

  it("se o gasto cai (apagou ou editou) e cruza de novo, avisa de novo", () => {
    let current = state({ "category:alimentação": { level: 2, spent: 1100 } });

    const dropped = plan([usage({ spent: 300 })], current);
    expect(dropped.notices).toEqual([]);
    expect(dropped.next.items["category:alimentação"].level).toBe(0);
    current = dropped.next;

    expect(plan([usage({ spent: 900 })], current).notices).toMatchObject([{ level: 1 }]);
  });

  it("mexer no limite (sem gastar) não avisa, mas passa a valer como novo ponto", () => {
    const seen = state({ "category:alimentação": { level: 0, spent: 500 } });

    // Você baixou a meta de 1000 para 550: o nível sobe, o gasto é o mesmo.
    const lowered = plan([usage({ spent: 500, limit: 550 })], seen);
    expect(lowered.notices).toEqual([]);
    expect(lowered.next.items["category:alimentação"]).toEqual({ level: 1, spent: 500 });

    // Gastar mais até estourar ainda avisa.
    expect(plan([usage({ spent: 600, limit: 550 })], lowered.next).notices).toMatchObject([{ level: 2 }]);
  });

  it("virou o mês: o que foi avisado no mês anterior não vale, recomeça do zero", () => {
    const august = state({ "category:alimentação": { level: 2, spent: 1500 } }, "2026-08");

    const result = plan([usage({ spent: 850 })], august, "2026-09");

    expect(result.baseline).toBe(false);
    expect(result.notices).toMatchObject([{ level: 1 }]);
    expect(result.next.period).toBe("2026-09");
  });

  it("orçamento do mês e categorias avisam de forma independente, e o que saiu da lista some do estado", () => {
    const seen = state({
      budget: { level: 0, spent: 100 },
      "category:lazer": { level: 0, spent: 10 },
      "category:removida": { level: 1, spent: 900 },
    });

    const result = plan(
      [
        usage({ key: TOTAL_BUDGET_KEY, label: "Orçamento do mês", spent: 1900, limit: 2000 }),
        usage({ key: "category:lazer", label: "Lazer", spent: 250, limit: 200 }),
      ],
      seen,
    );

    expect(result.notices.map((n) => [n.key, n.level])).toEqual([
      [TOTAL_BUDGET_KEY, 1],
      ["category:lazer", 2],
    ]);
    expect(Object.keys(result.next.items).sort()).toEqual(["budget", "category:lazer"]);
  });
});

describe("buildBudgetNotification", () => {
  const notice = (over = {}) => ({
    key: "category:alimentação",
    label: "Alimentação",
    level: 1 as const,
    spent: 850,
    limit: 1000,
    ...over,
  });

  it("nada a avisar: nenhuma notificação", () => {
    expect(buildBudgetNotification([])).toBeNull();
  });

  it("categoria perto do limite", () => {
    expect(buildBudgetNotification([notice()])).toEqual({
      id: "budget-alert-category:alimentação-1",
      title: "Alimentação: perto do limite",
      body: "Você já usou 85% da meta do mês (R$ 850,00 de R$ 1.000,00).",
    });
  });

  it("categoria estourada, com quanto passou", () => {
    expect(buildBudgetNotification([notice({ level: 2, spent: 1120 })])).toEqual({
      id: "budget-alert-category:alimentação-2",
      title: "Alimentação: meta estourada",
      body: "Você passou R$ 120,00 da meta do mês (R$ 1.120,00 de R$ 1.000,00).",
    });
  });

  it("orçamento do mês, perto e estourado", () => {
    const total = { key: TOTAL_BUDGET_KEY, label: "Orçamento do mês", limit: 2000 };

    expect(buildBudgetNotification([notice({ ...total, spent: 1700 })])).toMatchObject({
      id: "budget-alert-budget-1",
      title: "Orçamento do mês: quase no limite",
      body: "Você já usou 85% do orçamento do mês (R$ 1.700,00 de R$ 2.000,00).",
    });
    expect(buildBudgetNotification([notice({ ...total, level: 2, spent: 2300 })])).toMatchObject({
      title: "Orçamento do mês estourado",
      body: "Você passou R$ 300,00 do orçamento do mês (R$ 2.300,00 de R$ 2.000,00).",
    });
  });

  it("a porcentagem arredonda para baixo: 89,9% não vira 90%", () => {
    expect(buildBudgetNotification([notice({ spent: 899 })])?.body).toContain("89%");
  });

  it("vários de uma vez viram uma notificação só, uma linha para cada", () => {
    const result = buildBudgetNotification([
      notice(),
      notice({ key: "category:lazer", label: "Lazer", level: 2, spent: 250, limit: 200 }),
      notice({ key: TOTAL_BUDGET_KEY, label: "Orçamento do mês", spent: 1800, limit: 2000 }),
    ]);

    expect(result).toEqual({
      id: "budget-alert-group",
      title: "3 alertas de orçamento",
      body: "• Alimentação: 85% usado\n• Lazer: estourou em R$ 50,00\n• Orçamento do mês: 90% usado",
    });
  });
});
