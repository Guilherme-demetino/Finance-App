import {
  activeFilterKinds,
  applyHistoryFilters,
  clearFilter,
  describeFilters,
  EMPTY_HISTORY_FILTERS,
  hasActiveFilters,
  isDateInRange,
  matchesFilters,
  MAX_PERIOD_YEARS,
  presetRange,
  summarizeTransactions,
  validateFilters,
  yearsInRange,
  type HistoryFilters,
} from "./historyFilters";

const filters = (over: Partial<HistoryFilters> = {}): HistoryFilters => ({ ...EMPTY_HISTORY_FILTERS, ...over });

const tx = (
  amount: number,
  category = "Alimentação",
  date = "10/09/2026",
  type: "income" | "expense" = "expense",
  account?: string,
) => ({
  amount,
  category,
  date,
  type,
  account,
});

describe("filtros ativos", () => {
  it("sem nada marcado não há filtro ativo", () => {
    expect(hasActiveFilters(EMPTY_HISTORY_FILTERS)).toBe(false);
    expect(activeFilterKinds(EMPTY_HISTORY_FILTERS)).toEqual([]);
  });

  it("cada grupo conta uma vez, mesmo com valor mínimo e máximo juntos", () => {
    const all = filters({ minAmount: 10, maxAmount: 20, categories: ["A", "B"], accounts: ["Carteira"], period: { from: "01/09/2026", to: "30/09/2026" } });

    expect(activeFilterKinds(all)).toEqual(["value", "categories", "accounts", "period"]);
    expect(activeFilterKinds(filters({ minAmount: 0 }))).toEqual(["value"]); // 0 é um limite de verdade
  });

  it("clearFilter tira só o grupo escolhido", () => {
    const all = filters({ minAmount: 10, maxAmount: 20, categories: ["A"], accounts: ["Carteira"], period: { from: "01/09/2026", to: "30/09/2026" } });

    expect(clearFilter(all, "value")).toMatchObject({ minAmount: null, maxAmount: null, categories: ["A"] });
    expect(clearFilter(all, "categories").categories).toEqual([]);
    expect(clearFilter(all, "accounts").accounts).toEqual([]);
    expect(clearFilter(all, "period").period).toBeNull();
    expect(clearFilter(all, "period").minAmount).toBe(10);
  });
});

describe("validateFilters", () => {
  it("filtros vazios e válidos passam", () => {
    expect(validateFilters(EMPTY_HISTORY_FILTERS)).toBeNull();
    expect(validateFilters(filters({ minAmount: 10, maxAmount: 10 }))).toBeNull();
    expect(validateFilters(filters({ period: { from: "01/09/2026", to: "01/09/2026" } }))).toBeNull();
  });

  it("valor negativo ou mínimo maior que o máximo", () => {
    expect(validateFilters(filters({ minAmount: -1 }))).toBe("O valor não pode ser negativo.");
    expect(validateFilters(filters({ maxAmount: -5 }))).toBe("O valor não pode ser negativo.");
    expect(validateFilters(filters({ minAmount: 50, maxAmount: 10 }))).toBe("O valor mínimo é maior que o máximo.");
  });

  it("período: datas inválidas, invertidas ou longas demais", () => {
    expect(validateFilters(filters({ period: { from: "", to: "30/09/2026" } }))).toBe("Escolha as duas datas do período.");
    expect(validateFilters(filters({ period: { from: "31/02/2026", to: "30/09/2026" } }))).toBe("Escolha as duas datas do período.");
    expect(validateFilters(filters({ period: { from: "30/09/2026", to: "01/09/2026" } }))).toBe("A data inicial é depois da final.");
    expect(validateFilters(filters({ period: { from: "01/01/2010", to: "01/01/2026" } }))).toBe(
      `O período pode ter no máximo ${MAX_PERIOD_YEARS} anos.`,
    );
    expect(validateFilters(filters({ period: { from: "01/01/2017", to: "01/01/2026" } }))).toBeNull();
  });
});

describe("faixa de valor", () => {
  it("inclui as duas pontas", () => {
    const range = filters({ minAmount: 50, maxAmount: 200 });

    expect([49.99, 50, 120, 200, 200.01].map((amount) => matchesFilters(tx(amount), range))).toEqual([false, true, true, true, false]);
  });

  it("só mínimo ou só máximo", () => {
    expect(matchesFilters(tx(1000), filters({ minAmount: 500 }))).toBe(true);
    expect(matchesFilters(tx(499), filters({ minAmount: 500 }))).toBe(false);
    expect(matchesFilters(tx(20), filters({ maxAmount: 20 }))).toBe(true);
    expect(matchesFilters(tx(20.01), filters({ maxAmount: 20 }))).toBe(false);
  });

  it("compara em centavos: 0,1 + 0,2 não escapa da faixa por erro de ponto flutuante", () => {
    expect(matchesFilters(tx(0.1 + 0.2), filters({ maxAmount: 0.3 }))).toBe(true);
    expect(matchesFilters(tx(0.3), filters({ minAmount: 0.1 + 0.2 }))).toBe(true);
  });

  it("mínimo zero é um limite como outro qualquer", () => {
    expect(matchesFilters(tx(0), filters({ minAmount: 0 }))).toBe(true);
    expect(matchesFilters(tx(0), filters({ minAmount: 0.01 }))).toBe(false);
  });
});

describe("várias categorias", () => {
  it("serve qualquer uma das marcadas, sem diferenciar maiúsculas nem espaços", () => {
    const some = filters({ categories: ["alimentação", " Lazer "] });

    expect(matchesFilters(tx(10, "Alimentação"), some)).toBe(true);
    expect(matchesFilters(tx(10, "LAZER"), some)).toBe(true);
    expect(matchesFilters(tx(10, "Transporte"), some)).toBe(false);
  });

  it("sem categoria na transação não casa com nenhuma marcada", () => {
    expect(matchesFilters({ amount: 10, date: "10/09/2026" }, filters({ categories: ["Lazer"] }))).toBe(false);
    expect(matchesFilters({ amount: 10, date: "10/09/2026", category: "" }, filters({ categories: ["Lazer"] }))).toBe(false);
  });

  it("nenhuma marcada = todas", () => {
    expect(matchesFilters(tx(10, "Qualquer"), filters())).toBe(true);
  });
});

describe("várias contas", () => {
  it("serve qualquer uma das marcadas, sem diferenciar maiúsculas nem espaços", () => {
    const some = filters({ accounts: ["carteira", " Poupança "] });

    expect(matchesFilters(tx(10, "Alimentação", "10/09/2026", "expense", "Carteira"), some)).toBe(true);
    expect(matchesFilters(tx(10, "Alimentação", "10/09/2026", "expense", "POUPANÇA"), some)).toBe(true);
    expect(matchesFilters(tx(10, "Alimentação", "10/09/2026", "expense", "Conta principal"), some)).toBe(false);
  });

  it("sem conta na transação não casa com nenhuma marcada", () => {
    expect(matchesFilters({ amount: 10, date: "10/09/2026" }, filters({ accounts: ["Carteira"] }))).toBe(false);
  });

  it("nenhuma marcada = todas", () => {
    expect(matchesFilters(tx(10, "Alimentação", "10/09/2026", "expense", "Qualquer"), filters())).toBe(true);
  });
});

describe("período", () => {
  const september = { from: "01/09/2026", to: "30/09/2026" };

  it("inclui o primeiro e o último dia e exclui o de fora", () => {
    expect(["31/08/2026", "01/09/2026", "15/09/2026", "30/09/2026", "01/10/2026"].map((d) => isDateInRange(d, september))).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it("atravessa meses e anos", () => {
    const range = { from: "15/12/2025", to: "10/02/2026" };

    expect(isDateInRange("31/12/2025", range)).toBe(true);
    expect(isDateInRange("01/01/2026", range)).toBe(true);
    expect(isDateInRange("11/02/2026", range)).toBe(false);
  });

  it("data da transação inválida fica de fora (nunca vira 'hoje')", () => {
    expect(isDateInRange("xx", september)).toBe(false);
    expect(isDateInRange("31/02/2026", september)).toBe(false);
  });

  it("lista os anos que o período toca", () => {
    expect(yearsInRange({ from: "15/12/2024", to: "10/02/2026" })).toEqual(["2024", "2025", "2026"]);
    expect(yearsInRange(september)).toEqual(["2026"]);
    expect(yearsInRange({ from: "30/09/2026", to: "01/09/2026" })).toEqual([]);
    expect(yearsInRange({ from: "", to: "01/09/2026" })).toEqual([]);
  });

  it("não devolve uma lista sem fim para um período absurdo", () => {
    expect(yearsInRange({ from: "01/01/1900", to: "01/01/2100" }).length).toBeLessThanOrEqual(MAX_PERIOD_YEARS + 2);
  });
});

describe("applyHistoryFilters", () => {
  const items = [
    tx(30, "Alimentação", "05/09/2026"),
    tx(150, "Lazer", "12/09/2026"),
    tx(800, "Moradia", "20/08/2026"),
    tx(90, "Alimentação", "25/09/2026", "income"),
  ];

  it("sem filtros devolve a mesma lista", () => {
    expect(applyHistoryFilters(items, EMPTY_HISTORY_FILTERS)).toBe(items);
  });

  it("os três filtros juntos se somam (todos precisam valer)", () => {
    const result = applyHistoryFilters(
      items,
      filters({ minAmount: 50, maxAmount: 500, categories: ["Alimentação", "Lazer"], period: { from: "01/09/2026", to: "30/09/2026" } }),
    );

    expect(result.map((i) => i.amount)).toEqual([150, 90]);
  });

  it("só categorias, só período, só valor", () => {
    expect(applyHistoryFilters(items, filters({ categories: ["Moradia"] })).map((i) => i.amount)).toEqual([800]);
    expect(applyHistoryFilters(items, filters({ period: { from: "01/09/2026", to: "10/09/2026" } })).map((i) => i.amount)).toEqual([30]);
    expect(applyHistoryFilters(items, filters({ minAmount: 100 })).map((i) => i.amount)).toEqual([150, 800]);
  });

  it("nada casa: lista vazia", () => {
    expect(applyHistoryFilters(items, filters({ minAmount: 5000 }))).toEqual([]);
  });
});

describe("etiquetas dos filtros", () => {
  it("valor: faixa, só mínimo ou só máximo", () => {
    expect(describeFilters(filters({ minAmount: 50, maxAmount: 200 }))).toEqual([{ kind: "value", label: "Valor: R$ 50,00 a R$ 200,00" }]);
    expect(describeFilters(filters({ minAmount: 1250.5 }))[0].label).toBe("Valor: a partir de R$ 1.250,50");
    expect(describeFilters(filters({ maxAmount: 20 }))[0].label).toBe("Valor: até R$ 20,00");
  });

  it("categorias: nomes até duas, depois só a contagem", () => {
    expect(describeFilters(filters({ categories: ["Alimentação"] }))[0].label).toBe("Categorias: Alimentação");
    expect(describeFilters(filters({ categories: ["A", "B"] }))[0].label).toBe("Categorias: A, B");
    expect(describeFilters(filters({ categories: ["A", "B", "C"] }))[0].label).toBe("3 categorias");
  });

  it("contas: nomes até duas, depois só a contagem", () => {
    expect(describeFilters(filters({ accounts: ["Carteira"] }))[0].label).toBe("Contas: Carteira");
    expect(describeFilters(filters({ accounts: ["A", "B"] }))[0].label).toBe("Contas: A, B");
    expect(describeFilters(filters({ accounts: ["A", "B", "C"] }))[0].label).toBe("3 contas");
  });

  it("período e a ordem das etiquetas", () => {
    const chips = describeFilters(filters({ maxAmount: 10, categories: ["A"], period: { from: "01/09/2026", to: "15/09/2026" } }));

    expect(chips.map((chip) => chip.kind)).toEqual(["value", "categories", "period"]);
    expect(chips[2].label).toBe("Período: 01/09/2026 a 15/09/2026");
  });

  it("sem filtros, sem etiquetas", () => {
    expect(describeFilters(EMPTY_HISTORY_FILTERS)).toEqual([]);
  });
});

describe("resumo do resultado", () => {
  it("conta e soma receitas e despesas", () => {
    expect(summarizeTransactions([tx(100, "A", "01/09/2026", "income"), tx(30), tx(20.5)])).toEqual({ count: 3, income: 100, expense: 50.5 });
    expect(summarizeTransactions([])).toEqual({ count: 0, income: 0, expense: 0 });
  });
});

describe("atalhos de período", () => {
  const TODAY = new Date(2026, 8, 20, 15, 0);

  it("últimos 30 e 90 dias contam o dia de hoje", () => {
    expect(presetRange("last30", TODAY)).toEqual({ from: "22/08/2026", to: "20/09/2026" });
    expect(presetRange("last90", TODAY)).toEqual({ from: "23/06/2026", to: "20/09/2026" });
  });

  it("este ano vai de 1º de janeiro até hoje", () => {
    expect(presetRange("thisYear", TODAY)).toEqual({ from: "01/01/2026", to: "20/09/2026" });
  });

  it("atravessa a virada do ano", () => {
    expect(presetRange("last30", new Date(2026, 0, 10))).toEqual({ from: "12/12/2025", to: "10/01/2026" });
  });

  it("os atalhos são períodos válidos", () => {
    for (const preset of ["last30", "last90", "thisYear"] as const) {
      expect(validateFilters(filters({ period: presetRange(preset, TODAY) }))).toBeNull();
    }
  });
});
