import { createSqlJsDatabase } from "../test/sqliteFake";
import type { BackupData } from "../utils/backup/backup";

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
      account: "Conta principal",
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
      account: "Poupança",
    },
  ],
  budgets: [{ id: 1, month: "09", year: "2026", amount: 3000 }],
  categoryBudgets: [{ id: 2, category: "Pets", month: "09", year: "2026", amount: 200, repeat_monthly: 1 }],
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
      start_amount: 5,
    },
  ],
  creditCards: [{ id: 7, name: "Nubank", closing_day: 28, due_day: 5, credit_limit: 5000, account: "Conta principal" }],
  cardPurchases: [
    {
      id: 20,
      card_id: 7,
      description: "TV (1/2)",
      amount: 900,
      date: "10/09/2026",
      category: "Outros",
      invoice_ref: "2026-10",
      installment_group_id: "g1",
      installment_number: 1,
      installment_total: 2,
      transaction_id: 11,
    },
    {
      id: 21,
      card_id: 7,
      description: "Mercado",
      amount: 80.5,
      date: "11/09/2026",
      category: "Alimentação",
      invoice_ref: "2026-10",
      installment_group_id: null,
      installment_number: null,
      installment_total: null,
      transaction_id: null,
    },
  ],
  cardPayments: [{ id: 30, card_id: 7, invoice_ref: "2026-09", paid_date: "05/09/2026", amount: 300, transaction_id: null }],
  subscriptions: [{ id: 4, name: "Netflix", amount: 44.9, cycle: "monthly", billing_day: 5, billing_month: null, category: "Lazer", match_text: "netflix", active: 1, created_date: "01/08/2026", price_since: "05/09/2026", ignored_amount: 49.9 }],
  subscriptionPriceChanges: [{ id: 6, subscription_id: 4, date: "05/09/2026", old_amount: 39.9, new_amount: 44.9 }],
  accounts: [{ id: 2, name: "Poupança", color: "#00aabb" }],
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

  it("restaurar troca também os cartões, e um backup sem cartões/contas (versões antigas) deixa o app sem eles", async () => {
    const { backup, sqlite } = await loadModules();
    await sqlite.getDatabase();
    await backup.replaceAllData(SAMPLE);

    await backup.replaceAllData({
      ...SAMPLE,
      creditCards: undefined,
      cardPurchases: undefined,
      cardPayments: undefined,
      subscriptions: undefined,
      subscriptionPriceChanges: undefined,
      accounts: undefined,
    });

    const data = await backup.readBackupData();
    expect(data.creditCards).toEqual([]);
    expect(data.cardPurchases).toEqual([]);
    expect(data.cardPayments).toEqual([]);
    expect(data.subscriptions).toEqual([]);
    expect(data.subscriptionPriceChanges).toEqual([]);
    expect(data.accounts).toEqual([]);
  });

  it("depois de restaurar, novos cartões continuam com ids novos, sem colidir", async () => {
    const { backup, sqlite } = await loadModules();
    await sqlite.getDatabase();
    await backup.replaceAllData(SAMPLE);
    const cards = jest.requireActual<typeof import("./creditCards")>("./creditCards");

    const id = await cards.createCreditCard({ name: "Inter", closingDay: 1, dueDay: 8, limit: null });

    expect(id).toBeGreaterThan(7);
  });

  it("crédito da fatura (valor negativo) volta do backup como estava", async () => {
    const { backup, sqlite } = await loadModules();
    await sqlite.getDatabase();
    const credit = { ...SAMPLE.cardPurchases![0], id: 99, description: "Pagamento recebido", amount: -450, category: "Crédito na fatura", installment_group_id: null, installment_number: null, installment_total: null, transaction_id: null };

    await backup.replaceAllData({ ...SAMPLE, cardPurchases: [...SAMPLE.cardPurchases!, credit] });

    expect((await backup.readBackupData()).cardPurchases).toEqual([...SAMPLE.cardPurchases!, credit]);
  });

  it("backup antigo (compras sem a ligação com a despesa): depois de restaurar, a conciliação cria as despesas", async () => {
    const { backup, sqlite, transactions } = await loadModules();
    await sqlite.getDatabase();
    const old = SAMPLE.cardPurchases!.map((p) => ({ ...p, transaction_id: undefined })) as unknown as NonNullable<BackupData["cardPurchases"]>;
    await backup.replaceAllData({ ...SAMPLE, cardPurchases: old });
    const cards = jest.requireActual<typeof import("./creditCards")>("./creditCards");

    expect(await cards.reconcileCardTransactions()).toBe(SAMPLE.cardPurchases!.length);

    const descriptions = (await transactions.getAllTransactions()).map((t) => t.description);
    expect(descriptions).toContain("TV (1/2)");
    expect(descriptions).toContain("Mercado");
  });

  it("backup antigo (metas sem o valor inicial): a meta volta com o valor inicial 0", async () => {
    const { backup, sqlite } = await loadModules();
    await sqlite.getDatabase();
    const old = SAMPLE.savingsGoals.map((g) => ({ ...g, start_amount: undefined })) as unknown as BackupData["savingsGoals"];

    await backup.replaceAllData({ ...SAMPLE, savingsGoals: old });

    expect((await backup.readBackupData()).savingsGoals.map((g) => g.start_amount)).toEqual([0]);
  });

  it("backup antigo (meta por categoria sem a repetição): a meta volta sem repetir", async () => {
    const { backup, sqlite } = await loadModules();
    await sqlite.getDatabase();
    const old = SAMPLE.categoryBudgets.map((b) => ({ ...b, repeat_monthly: undefined })) as unknown as BackupData["categoryBudgets"];

    await backup.replaceAllData({ ...SAMPLE, categoryBudgets: old });

    expect((await backup.readBackupData()).categoryBudgets.map((b) => b.repeat_monthly)).toEqual([0]);
  });

  it("backup antigo (transação e cartão sem conta): voltam na conta padrão", async () => {
    const { backup, sqlite } = await loadModules();
    await sqlite.getDatabase();
    const oldTransactions = SAMPLE.transactions.map((t) => ({ ...t, account: undefined }));
    const oldCards = SAMPLE.creditCards!.map((c) => ({ ...c, account: undefined }));

    await backup.replaceAllData({ ...SAMPLE, transactions: oldTransactions, creditCards: oldCards });

    const data = await backup.readBackupData();
    expect(data.transactions.map((t) => t.account)).toEqual(["Conta principal", "Conta principal"]);
    expect(data.creditCards!.map((c) => c.account)).toEqual(["Conta principal"]);
  });

  it("uma falha nos cartões também desfaz a restauração inteira", async () => {
    const { backup, sqlite, transactions } = await loadModules();
    await sqlite.getDatabase();
    await transactions.createTransaction({ amount: 7, date: "02/02/2026", description: "Continua aqui", type: "expense", category: "Geral" });
    const before = await backup.readBackupData();

    // Dois cartões com o mesmo id: a segunda gravação estoura a chave primária, já no fim.
    const broken: BackupData = { ...SAMPLE, creditCards: [...SAMPLE.creditCards!, { ...SAMPLE.creditCards![0] }] };

    await expect(backup.replaceAllData(broken)).rejects.toThrow();

    await expect(backup.readBackupData()).resolves.toEqual(before);
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
