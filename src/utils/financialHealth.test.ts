import type { DebtRow } from "../types";
import { computeFinancialHealth, type HealthInput, type HealthPillar } from "./financialHealth";

const TODAY = new Date(2026, 8, 19, 10, 0);

const debt = (over: Partial<DebtRow> = {}): DebtRow => ({
  id: 1,
  person: "Maria",
  amount: 1000,
  type: "borrowed",
  description: null,
  date: "01/09/2026",
  status: "pending",
  settled_date: null,
  due_date: "30/09/2026",
  ...over,
});

const health = (over: Partial<HealthInput> = {}) =>
  computeFinancialHealth({
    income: 5000,
    expense: 3000,
    budget: null,
    pendingDebts: [],
    includeDebts: true,
    today: TODAY,
    ...over,
  });

const pillar = (result: ReturnType<typeof health>, id: HealthPillar["id"]) =>
  result.pillars.find((p) => p.id === id);

describe("área do saldo do mês", () => {
  it("sobra de 20% ou mais da receita: nota máxima", () => {
    const result = health({ income: 5000, expense: 3000 });

    expect(pillar(result, "cashflow")).toMatchObject({ score: 100, detail: "Sobrou 40% da receita do mês." });
  });

  it("sobra pequena perde nota e diz o ideal", () => {
    const result = health({ income: 1000, expense: 900 });

    expect(pillar(result, "cashflow")?.score).toBe(80);
    expect(pillar(result, "cashflow")?.detail).toBe("Sobrou só 10% da receita do mês (o ideal é a partir de 20%).");
  });

  it("gastar tudo vale 60; gastar além da receita cai até zero", () => {
    expect(pillar(health({ income: 1000, expense: 1000 }), "cashflow")).toMatchObject({
      score: 60,
      detail: "Você gastou praticamente tudo o que recebeu no mês.",
    });
    expect(pillar(health({ income: 1000, expense: 1250 }), "cashflow")).toMatchObject({
      score: 30,
      detail: "Você gastou 25% a mais do que recebeu no mês.",
    });
    expect(pillar(health({ income: 1000, expense: 1500 }), "cashflow")?.score).toBe(0);
    expect(pillar(health({ income: 1000, expense: 9000 }), "cashflow")?.score).toBe(0);
  });

  it("gasto sem nenhuma receita no mês vale zero", () => {
    const result = health({ income: 0, expense: 500 });

    expect(pillar(result, "cashflow")).toMatchObject({
      score: 0,
      detail: "Há gastos no mês e nenhuma receita registrada.",
    });
  });
});

describe("área do orçamento", () => {
  const budgetOf = (expense: number, budget = 1000) =>
    pillar(health({ income: 5000, expense, budget }), "budget");

  it("até 80% usado: nota máxima", () => {
    expect(budgetOf(500)).toMatchObject({ score: 100, detail: "Você usou 50% do orçamento do mês." });
    expect(budgetOf(800)?.score).toBe(100);
  });

  it("entre 80% e 100% perde nota, chegando a 60 no limite", () => {
    expect(budgetOf(900)).toMatchObject({ score: 80, detail: "Você já usou 90% do orçamento: perto do limite." });
    expect(budgetOf(1000)).toMatchObject({ score: 60, detail: "Você usou todo o orçamento do mês." });
  });

  it("estourar cai até zero, dizendo quanto passou", () => {
    expect(budgetOf(1250)).toMatchObject({ score: 30, detail: "Você estourou o orçamento do mês em R$ 250,00." });
    expect(budgetOf(1500)?.score).toBe(0);
  });

  it("sem orçamento definido: fica fora da nota e explica como incluir", () => {
    const result = health({ budget: null });

    expect(pillar(result, "budget")).toBeUndefined();
    expect(result.hints).toContain("Defina o orçamento do mês para ele entrar na nota.");
    expect(health({ budget: 0 }).hints).toContain("Defina o orçamento do mês para ele entrar na nota.");
  });
});

describe("área das dívidas", () => {
  const debtsOf = (debts: DebtRow[], income = 5000) => pillar(health({ income, pendingDebts: debts }), "debts");

  it("sem dívida a pagar: nota máxima", () => {
    expect(debtsOf([])).toMatchObject({ score: 100, detail: "Nenhuma dívida a pagar em aberto." });
  });

  it("dívida a receber não conta como dívida", () => {
    expect(debtsOf([debt({ type: "lent", amount: 99999 })])?.score).toBe(100);
  });

  it("até 25% da receita é confortável; depois perde nota até 40 quando iguala a receita", () => {
    expect(debtsOf([debt({ amount: 1250 })])?.score).toBe(100);
    expect(debtsOf([debt({ amount: 3125 })])?.score).toBe(70);
    expect(debtsOf([debt({ amount: 5000 })])?.score).toBe(40);
    expect(debtsOf([debt({ amount: 10000 })])?.score).toBe(0);
  });

  it("explica o valor e o peso na receita", () => {
    expect(debtsOf([debt({ amount: 1000 })])?.detail).toBe("Você deve R$ 1.000,00 (20% da receita do mês).");
  });

  it("cada dívida vencida tira 20 pontos (no máximo 40) e aparece no texto", () => {
    const late = (id: number) => debt({ id, amount: 100, due_date: "10/09/2026" });

    expect(debtsOf([late(1)])).toMatchObject({ score: 80, detail: "Você deve R$ 100,00 (2% da receita do mês), 1 vencida." });
    expect(debtsOf([late(1), late(2)])?.score).toBe(60);
    expect(debtsOf([late(1), late(2), late(3), late(4)])?.score).toBe(60);
  });

  it("vencer hoje ainda não é atraso", () => {
    expect(debtsOf([debt({ amount: 100, due_date: "19/09/2026" })])?.score).toBe(100);
  });

  it("sem receita no mês, com dívida a pagar: nota 40", () => {
    expect(debtsOf([debt({ amount: 100 })], 0)?.score).toBe(40);
  });
});

describe("nota geral e status", () => {
  it("tudo bem: 100 e Saudável, com a frase de tudo em ordem", () => {
    const result = health({ budget: 4000 });

    expect(result).toMatchObject({
      score: 100,
      status: "healthy",
      statusLabel: "Saudável",
      headline: "As finanças do mês estão em ordem.",
    });
    expect(result.pillars.map((p) => p.id)).toEqual(["cashflow", "budget", "debts"]);
  });

  it("pondera as áreas: saldo 40%, orçamento 30%, dívidas 30%", () => {
    // saldo 60 (gastou tudo), orçamento 100, dívidas 100 → (60*40 + 100*30 + 100*30) / 100 = 84
    const result = health({ income: 1000, expense: 1000, budget: 2000 });

    expect(result.score).toBe(84);
    expect(result.status).toBe("healthy");
  });

  it("sem orçamento, a nota usa só as áreas que têm dados (saldo 40 e dívidas 30)", () => {
    // saldo 60, dívidas 100 → (60*40 + 100*30) / 70 = 77
    const result = health({ income: 1000, expense: 1000, budget: null });

    expect(result.score).toBe(77);
  });

  it("uma área em risco impede o Saudável, mesmo com média alta, e vira a frase principal", () => {
    // saldo 100, orçamento 100, dívidas 40 → média 82, mas dívidas < 50
    const result = health({
      income: 10000,
      expense: 5000,
      budget: 10000,
      pendingDebts: [debt({ amount: 10000 })],
    });

    expect(result.score).toBe(82);
    expect(result.status).toBe("attention");
    expect(result.headline).toBe(pillar(result, "debts")?.detail);
  });

  it("faixas: 75+ saudável, 50 a 74 atenção, abaixo de 50 em risco", () => {
    // saldo 30 (gastou 25% a mais), sem orçamento, dívidas 100 → (30*40 + 100*30) / 70 = 60
    expect(health({ income: 1000, expense: 1250 })).toMatchObject({ score: 60, status: "attention" });
    // saldo 0 → (0*40 + 100*30) / 70 = 43
    expect(health({ income: 1000, expense: 1500 })).toMatchObject({ score: 43, status: "risk", statusLabel: "Em risco" });
  });

  it("em atenção ou em risco, a frase principal é a área mais fraca", () => {
    const result = health({ income: 1000, expense: 1250, budget: 1000 });

    // saldo 30, orçamento 30, dívidas 100 → empate entre saldo e orçamento fica com o saldo
    expect(result.headline).toBe("Você gastou 25% a mais do que recebeu no mês.");
  });
});

describe("sem dados, outros meses e avisos", () => {
  it("mês vazio e sem dívidas: sem dados, sem nota", () => {
    const result = health({ income: 0, expense: 0 });

    expect(result).toMatchObject({ status: "no-data", statusLabel: "Sem dados", score: null, pillars: [] });
    expect(result.headline).toBe("Registre receitas e despesas para ver a nota do mês.");
  });

  it("mês vazio mas com dívida a pagar: só a área das dívidas", () => {
    const result = health({ income: 0, expense: 0, pendingDebts: [debt({ amount: 100 })] });

    expect(result.pillars.map((p) => p.id)).toEqual(["debts"]);
    expect(result.score).toBe(40);
    expect(result.status).toBe("risk");
  });

  it("em outro mês, as dívidas ficam fora da nota e o app explica", () => {
    const result = health({ includeDebts: false, pendingDebts: [debt({ amount: 99999 })] });

    expect(pillar(result, "debts")).toBeUndefined();
    expect(result.hints).toContain("As dívidas em aberto só entram na nota do mês atual.");
  });

  it("cobrança a receber em atraso vira aviso, sem mexer na nota", () => {
    const without = health({ budget: 4000 });
    const withLate = health({
      budget: 4000,
      pendingDebts: [debt({ type: "lent", due_date: "01/09/2026" }), debt({ id: 2, type: "lent", due_date: "02/09/2026" })],
    });

    expect(withLate.score).toBe(without.score);
    expect(withLate.hints).toContain("2 cobranças a receber em atraso (não entra na nota).");
    expect(
      health({ pendingDebts: [debt({ type: "lent", due_date: "01/09/2026" })] }).hints,
    ).toContain("1 cobrança a receber em atraso (não entra na nota).");
  });

  it("dívida sem data de vencimento ou com data inválida não conta como vencida", () => {
    const result = health({ pendingDebts: [debt({ due_date: null }), debt({ id: 2, due_date: "31/02/2026" })] });

    expect(pillar(result, "debts")?.detail).not.toContain("vencida");
  });
});
