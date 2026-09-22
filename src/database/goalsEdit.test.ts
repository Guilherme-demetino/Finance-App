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
    savings: jest.requireActual<typeof import("./savingsGoals")>("./savingsGoals"),
    budgets: jest.requireActual<typeof import("./categoryBudgets")>("./categoryBudgets"),
  };
}

describe("atualizar um banco que já tinha metas (sem o valor inicial)", () => {
  it("a coluna nova é criada e as metas antigas ficam com valor inicial 0", async () => {
    jest.resetModules();
    const db = (await createSqlJsDatabase()) as unknown as { runSync: (sql: string, ...params: unknown[]) => unknown };
    mockState.db = db;
    db.runSync(
      "CREATE TABLE savings_goals (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, target_amount REAL NOT NULL, saved_amount REAL NOT NULL DEFAULT 0, deadline TEXT, created_date TEXT NOT NULL)",
    );
    db.runSync("INSERT INTO savings_goals (name, target_amount, saved_amount, deadline, created_date) VALUES (?, ?, ?, ?, ?)", "Antiga", 1000, 250, null, "01/06/2026");

    const savings = jest.requireActual<typeof import("./savingsGoals")>("./savingsGoals");

    expect(await savings.getAllSavingsGoals()).toEqual([
      { id: 1, name: "Antiga", target_amount: 1000, saved_amount: 250, deadline: null, created_date: "01/06/2026", start_amount: 0 },
    ]);
  });
});

describe("editar meta de economia", () => {
  it("muda nome, valor, quanto já foi guardado e prazo, e mantém a data de criação", async () => {
    const { savings } = await load();
    await savings.createSavingsGoal({ name: "Viagem", targetAmount: 5000, savedAmount: 1000, deadline: "31/12/2026", createdDate: "01/09/2026" });
    const [goal] = await savings.getAllSavingsGoals();

    await savings.updateSavingsGoal(goal.id, { name: "Viagem ao Japão", targetAmount: 9000.5, savedAmount: 1500.25, deadline: "30/06/2027" });

    const [edited] = await savings.getAllSavingsGoals();
    expect(edited).toEqual({
      id: goal.id,
      name: "Viagem ao Japão",
      target_amount: 9000.5,
      saved_amount: 1500.25,
      deadline: "30/06/2027",
      created_date: "01/09/2026",
      start_amount: 1000, // o que já estava guardado ao criar a meta fica como está
    });
  });

  it("o valor guardado na criação vira o valor inicial; guardar depois não muda o inicial", async () => {
    const { savings } = await load();
    await savings.createSavingsGoal({ name: "Reserva", targetAmount: 5000, savedAmount: 800, deadline: null, createdDate: "01/09/2026" });
    const [goal] = await savings.getAllSavingsGoals();

    await savings.updateSavedAmount(goal.id, 1300);

    expect((await savings.getAllSavingsGoals())[0]).toMatchObject({ saved_amount: 1300, start_amount: 800 });
  });

  it("corrigir o valor guardado para menos que o inicial leva o inicial junto", async () => {
    const { savings } = await load();
    await savings.createSavingsGoal({ name: "Reserva", targetAmount: 5000, savedAmount: 800, deadline: null, createdDate: "01/09/2026" });
    const [goal] = await savings.getAllSavingsGoals();

    await savings.updateSavingsGoal(goal.id, { name: "Reserva", targetAmount: 5000, savedAmount: 300, deadline: null });

    expect((await savings.getAllSavingsGoals())[0]).toMatchObject({ saved_amount: 300, start_amount: 300 });
  });

  it("dá para tirar o prazo (deadline nulo)", async () => {
    const { savings } = await load();
    await savings.createSavingsGoal({ name: "Reserva", targetAmount: 100, savedAmount: 0, deadline: "31/12/2026", createdDate: "01/09/2026" });
    const [goal] = await savings.getAllSavingsGoals();

    await savings.updateSavingsGoal(goal.id, { name: "Reserva", targetAmount: 100, savedAmount: 0, deadline: null });

    expect((await savings.getAllSavingsGoals())[0].deadline).toBeNull();
  });

  it("só a meta editada muda; as outras ficam como estavam", async () => {
    const { savings } = await load();
    await savings.createSavingsGoal({ name: "A", targetAmount: 100, savedAmount: 10, deadline: null, createdDate: "01/09/2026" });
    await savings.createSavingsGoal({ name: "B", targetAmount: 200, savedAmount: 20, deadline: null, createdDate: "01/09/2026" });
    const goals = await savings.getAllSavingsGoals();
    const a = goals.find((g) => g.name === "A")!;

    await savings.updateSavingsGoal(a.id, { name: "A2", targetAmount: 111, savedAmount: 11, deadline: null });

    const after = await savings.getAllSavingsGoals();
    expect(after.find((g) => g.name === "B")).toMatchObject({ target_amount: 200, saved_amount: 20 });
    expect(after.find((g) => g.id === a.id)).toMatchObject({ name: "A2", target_amount: 111 });
  });
});

describe("remover meta por categoria", () => {
  it("tira só a meta daquele mês e categoria", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500);
    await budgets.setCategoryBudget("Alimentação", "10", "2026", 600);
    await budgets.setCategoryBudget("Lazer", "09", "2026", 200);

    await budgets.removeCategoryBudget("Alimentação", "09", "2026");

    expect((await budgets.getCategoryBudgets("09", "2026")).map((row) => row.category)).toEqual(["Lazer"]);
    expect((await budgets.getCategoryBudgets("10", "2026")).map((row) => row.category)).toEqual(["Alimentação"]);
  });

  it("não diferencia maiúsculas nem espaços, como a leitura das metas", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Alimentação", "09", "2026", 500);

    await budgets.removeCategoryBudget("  ALIMENTAÇÃO ", "09", "2026");

    expect(await budgets.getCategoryBudgets("09", "2026")).toEqual([]);
  });

  it("categoria sem meta: não faz nada e não estoura", async () => {
    const { budgets } = await load();
    await budgets.setCategoryBudget("Lazer", "09", "2026", 200);

    await expect(budgets.removeCategoryBudget("Transporte", "09", "2026")).resolves.toBeUndefined();

    expect(await budgets.getCategoryBudgets("09", "2026")).toHaveLength(1);
  });
});
