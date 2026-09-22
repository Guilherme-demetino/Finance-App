import { createSqlJsDatabase } from "../test/sqliteFake";

// Banco de verdade em memória no lugar do expo-sqlite.
const mockState: { db: unknown } = { db: null };
jest.mock("expo-sqlite", () => ({
  openDatabaseSync: () => mockState.db,
}));

async function load() {
  jest.resetModules();
  mockState.db = await createSqlJsDatabase();
  const sqlite = jest.requireActual<typeof import("./sqlite")>("./sqlite");
  await sqlite.resetDatabase();
  return {
    budgets: jest.requireActual<typeof import("./categoryBudgets")>("./categoryBudgets"),
    sqlite,
  };
}

const names = (rows: { category: string }[]) => rows.map((row) => row.category);
const amounts = (rows: { amount: number }[]) => rows.map((row) => row.amount);

describe("meta por categoria: leitura simples (sem repetição)", () => {
  it("uma meta que não repete só aparece no mês em que foi definida", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500, false);

    expect(names(await budgets.getCategoryBudgets("09", "2026"))).toEqual(["Alimentação"]);
    expect(await budgets.getCategoryBudgets("10", "2026")).toEqual([]);
  });

  it("meses diferentes de uma categoria que não repete são independentes", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500, false);
    await budgets.setCategoryBudget("Alimentação", "10", "2026", 700, false);

    expect(amounts(await budgets.getCategoryBudgets("09", "2026"))).toEqual([500]);
    expect(amounts(await budgets.getCategoryBudgets("10", "2026"))).toEqual([700]);
  });
});

describe("meta que repete todo mês", () => {
  it("vale nos meses seguintes, sem precisar redefinir", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500, true);

    expect(amounts(await budgets.getCategoryBudgets("10", "2026"))).toEqual([500]);
    expect(amounts(await budgets.getCategoryBudgets("12", "2026"))).toEqual([500]);
    expect(amounts(await budgets.getCategoryBudgets("03", "2027"))).toEqual([500]); // atravessa o ano
  });

  it("não vale nos meses anteriores ao que foi criada", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500, true);

    expect(await budgets.getCategoryBudgets("08", "2026")).toEqual([]);
  });

  it("uma meta específica de um mês tem prioridade sobre a herdada", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500, true);
    await budgets.setCategoryBudget("Alimentação", "11", "2026", 900, false);

    expect(amounts(await budgets.getCategoryBudgets("10", "2026"))).toEqual([500]); // ainda herdada
    expect(amounts(await budgets.getCategoryBudgets("11", "2026"))).toEqual([900]); // a própria de novembro
    expect(amounts(await budgets.getCategoryBudgets("12", "2026"))).toEqual([500]); // volta a herdar de setembro
  });

  it("editar de novo com repetir muda o valor herdado dali em diante", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500, true);
    await budgets.setCategoryBudget("Alimentação", "11", "2026", 650, true);

    expect(amounts(await budgets.getCategoryBudgets("10", "2026"))).toEqual([500]);
    expect(amounts(await budgets.getCategoryBudgets("11", "2026"))).toEqual([650]);
    expect(amounts(await budgets.getCategoryBudgets("12", "2026"))).toEqual([650]);
  });

  it("mais de uma categoria repete de forma independente", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500, true);
    await budgets.setCategoryBudget("Lazer", "09", "2026", 200, true);
    await budgets.setCategoryBudget("Transporte", "09", "2026", 150, false);

    const next = await budgets.getCategoryBudgets("10", "2026");
    expect(names(next).sort()).toEqual(["Alimentação", "Lazer"]);
  });

  it("a meta herdada mantém a categoria e o valor originais, com o mês/ano pedidos", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500, true);

    const [inherited] = await budgets.getCategoryBudgets("10", "2026");
    expect(inherited).toMatchObject({ category: "Alimentação", amount: 500, month: "10", year: "2026", repeat_monthly: 1 });
  });
});

describe("remover meta: também para de repetir", () => {
  it("remover no mês em que foi criada tira dali e não repete mais", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500, true);

    await budgets.removeCategoryBudget("Alimentação", "09", "2026");

    expect(await budgets.getCategoryBudgets("09", "2026")).toEqual([]);
    expect(await budgets.getCategoryBudgets("10", "2026")).toEqual([]);
  });

  it("remover num mês herdado para a repetição por completo: nenhum mês volta a herdar depois disso", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500, true);

    await budgets.removeCategoryBudget("Alimentação", "11", "2026");

    // A meta é um valor só: parar de repetir vale para qualquer mês consultado depois, mesmo um anterior ao da remoção.
    expect(await budgets.getCategoryBudgets("10", "2026")).toEqual([]);
    expect(await budgets.getCategoryBudgets("11", "2026")).toEqual([]);
    expect(await budgets.getCategoryBudgets("12", "2026")).toEqual([]);
  });

  it("sem diferenciar maiúsculas nem espaços, como a leitura das metas", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500, true);

    await budgets.removeCategoryBudget("  ALIMENTAÇÃO ", "10", "2026");

    expect(await budgets.getCategoryBudgets("11", "2026")).toEqual([]);
  });

  it("remover uma categoria não mexe nas outras", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500, true);
    await budgets.setCategoryBudget("Lazer", "09", "2026", 200, true);

    await budgets.removeCategoryBudget("Alimentação", "10", "2026");

    expect(names(await budgets.getCategoryBudgets("11", "2026"))).toEqual(["Lazer"]);
  });
});

describe("zerar os dados do app", () => {
  it("apaga as metas por categoria", async () => {
    const { budgets, sqlite } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500, true);

    await sqlite.resetDatabase();

    expect(await budgets.getCategoryBudgets("10", "2026")).toEqual([]);
  });
});
