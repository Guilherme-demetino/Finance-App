import { createSqlJsDatabase } from "../test/sqliteFake";
import type { BackupData } from "../utils/backup";

// Banco de verdade em memória no lugar do expo-sqlite.
const mockState: { db: unknown } = { db: null };
jest.mock("expo-sqlite", () => ({
  openDatabaseSync: () => mockState.db,
}));

async function loadModules() {
  jest.resetModules();
  mockState.db = await createSqlJsDatabase();
  return {
    sqlite: jest.requireActual<typeof import("./sqlite")>("./sqlite"),
    backup: jest.requireActual<typeof import("./backup")>("./backup"),
    users: jest.requireActual<typeof import("./users")>("./users"),
    transactions: jest.requireActual<typeof import("./transactions")>("./transactions"),
    db: mockState.db as Awaited<ReturnType<typeof createSqlJsDatabase>>,
  };
}

const SAMPLE: BackupData = {
  userName: "Ana",
  categories: [
    { id: 4, name: "Pets", color: "#123456", type: "expense" },
    { id: 9, name: "Freelas", color: "#654321", type: "income" },
  ],
  transactions: [
    {
      id: 10,
      amount: 1500.5,
      date: "05/09/2026",
      description: "Salário",
      type: "income",
      category_id: "Salário",
      recurrence_group_id: null,
      recurrence_type: null,
      installment_number: null,
      installment_total: null,
    },
    {
      id: 11,
      amount: 99.9,
      date: "10/09/2026",
      description: "Notebook 2/3",
      type: "expense",
      category_id: "Geral",
      recurrence_group_id: "grp1",
      recurrence_type: "installment",
      installment_number: 2,
      installment_total: 3,
    },
  ],
  budgets: [{ id: 1, month: "09", year: "2026", amount: 3000 }],
  categoryBudgets: [{ id: 2, category: "Pets", month: "09", year: "2026", amount: 200 }],
  debts: [
    {
      id: 3,
      person: "Bia",
      amount: 50,
      type: "lent",
      description: null,
      date: "01/09/2026",
      status: "pending",
      settled_date: null,
      due_date: "30/09/2026",
    },
  ],
  savingsGoals: [
    {
      id: 5,
      name: "Viagem",
      target_amount: 5000,
      saved_amount: 800,
      deadline: "31/12/2026",
      created_date: "01/09/2026",
    },
  ],
};

describe("backup do banco", () => {
  it("restaurar num banco vazio e ler de volta devolve exatamente os mesmos dados", async () => {
    const { backup, sqlite } = await loadModules();
    await sqlite.getDatabase();

    await backup.replaceAllData(SAMPLE);

    await expect(backup.readBackupData()).resolves.toEqual(SAMPLE);
  });

  it("substitui os dados que já estavam no app (não junta)", async () => {
    const { backup, sqlite, transactions } = await loadModules();
    await sqlite.getDatabase();
    await transactions.createTransaction({
      amount: 1,
      date: "01/01/2026",
      description: "Antiga",
      type: "expense",
      category: "Geral",
    });

    await backup.replaceAllData(SAMPLE);

    const data = await backup.readBackupData();
    expect(data.transactions.map((t) => t.description)).toEqual([
      "Salário",
      "Notebook 2/3",
    ]);
  });

  it("se uma gravação falhar no meio, nada muda (rollback)", async () => {
    const { backup, sqlite, transactions } = await loadModules();
    await sqlite.getDatabase();
    await transactions.createTransaction({
      amount: 7,
      date: "02/02/2026",
      description: "Continua aqui",
      type: "expense",
      category: "Geral",
    });
    const before = await backup.readBackupData();

    // Dois orçamentos do mesmo mês/ano violam o UNIQUE da tabela, já no fim da restauração.
    const broken: BackupData = {
      ...SAMPLE,
      budgets: [
        { id: 1, month: "09", year: "2026", amount: 1 },
        { id: 2, month: "09", year: "2026", amount: 2 },
      ],
    };

    await expect(backup.replaceAllData(broken)).rejects.toThrow();

    await expect(backup.readBackupData()).resolves.toEqual(before);
  });

  it("depois de restaurar, novas transações continuam com ids novos, sem colidir", async () => {
    const { backup, sqlite, transactions } = await loadModules();
    await sqlite.getDatabase();
    await backup.replaceAllData(SAMPLE);

    await transactions.createTransaction({
      amount: 5,
      date: "11/09/2026",
      description: "Nova",
      type: "expense",
      category: "Geral",
    });

    const ids = (await backup.readBackupData()).transactions.map((t) => t.id);
    expect(new Set(ids).size).toBe(3);
    expect(Math.max(...ids)).toBeGreaterThan(11);
  });

  it("mantém a foto do perfil e atualiza só o nome", async () => {
    const { backup, sqlite, users, db } = await loadModules();
    await sqlite.getDatabase();
    await users.upsertUserName("Antigo");
    await users.updateUserAvatar("file:///foto.jpg", "Antigo");

    await backup.replaceAllData(SAMPLE);

    const row = await db.getFirstAsync<{ name: string; avatar: string }>(
      "SELECT name, avatar FROM users WHERE id = 1",
    );
    expect(row).toEqual({ name: "Ana", avatar: "file:///foto.jpg" });
  });

  it("backup sem nome não mexe no nome atual", async () => {
    const { backup, sqlite, users, db } = await loadModules();
    await sqlite.getDatabase();
    await users.upsertUserName("Fica");

    await backup.replaceAllData({ ...SAMPLE, userName: null });

    const row = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM users WHERE id = 1",
    );
    expect(row?.name).toBe("Fica");
  });
});
