import { createSqlJsDatabase } from "../test/sqliteFake";
import { TRASH_RETENTION_DAYS } from "../utils/trash";

// Banco de verdade em memória no lugar do expo-sqlite.
const mockState: { db: unknown } = { db: null };
jest.mock("expo-sqlite", () => ({
  openDatabaseSync: () => mockState.db,
}));

async function load() {
  jest.resetModules();
  mockState.db = await createSqlJsDatabase();
  const sqlite = jest.requireActual<typeof import("./sqlite")>("./sqlite");
  const transactions = jest.requireActual<typeof import("./transactions")>("./transactions");
  await sqlite.resetDatabase();
  return transactions;
}

type Transactions = Awaited<ReturnType<typeof load>>;

const add = (t: Transactions, description: string, date = "01/09/2026", amount = 10) =>
  t.createTransaction({ description, date, amount, type: "expense", category: "Outros" });

async function firstId(t: Transactions, description: string): Promise<number> {
  const rows = await t.getAllTransactions();
  return rows.find((row) => row.description === description)!.id;
}

describe("apagar uma transação (Lixeira, com prazo)", () => {
  it("some das listas ativas na hora, mas continua na tabela", async () => {
    const t = await load();
    await add(t, "Mercado");
    const id = await firstId(t, "Mercado");

    await t.deleteTransaction(id);

    expect(await t.getAllTransactions()).toEqual([]);
    const [trashed] = await t.getDeletedTransactions();
    expect(trashed).toMatchObject({ id, description: "Mercado" });
    expect(trashed.deleted_at).not.toBeNull();
  });

  it("some de getTransactionsByMonth e getTransactionsByYear", async () => {
    const t = await load();
    await add(t, "Aluguel", "05/09/2026");
    const id = await firstId(t, "Aluguel");

    await t.deleteTransaction(id);

    expect(await t.getTransactionsByMonth("09", "2026")).toEqual([]);
    expect(await t.getTransactionsByYear("2026")).toEqual([]);
  });

  it("some de getRecurringExpenses sem mexer nas outras parcelas da mesma recorrência", async () => {
    const t = await load();
    await t.createRecurringTransactions(
      { description: "Aluguel", date: "05/09/2026", amount: 10, type: "expense", category: "Outros" },
      3,
    );
    const [first] = await t.getRecurringExpenses();

    await t.deleteTransaction(first.id);

    const remaining = await t.getRecurringExpenses();
    expect(remaining).toHaveLength(2);
    expect(remaining.every((row) => row.id !== first.id)).toBe(true);
  });

  it("apagar de novo (já excluída) não quebra nem mexe no deleted_at original", async () => {
    const t = await load();
    await add(t, "Mercado");
    const id = await firstId(t, "Mercado");

    await t.deleteTransaction(id);
    const [first] = await t.getDeletedTransactions();
    await t.deleteTransaction(id);
    const [again] = await t.getDeletedTransactions();

    expect(again.deleted_at).toBe(first.deleted_at);
  });
});

describe("desfazer a exclusão", () => {
  it("a transação volta a valer, como se nunca tivesse sido apagada", async () => {
    const t = await load();
    await add(t, "Mercado");
    const id = await firstId(t, "Mercado");
    await t.deleteTransaction(id);

    await t.restoreTransaction(id);

    expect(await t.getDeletedTransactions()).toEqual([]);
    const [restored] = await t.getAllTransactions();
    expect(restored).toMatchObject({ id, description: "Mercado", deleted_at: null });
  });
});

describe("apagar de vez (Lixeira)", () => {
  it("some da Lixeira e não pode mais ser restaurada", async () => {
    const t = await load();
    await add(t, "Mercado");
    const id = await firstId(t, "Mercado");
    await t.deleteTransaction(id);

    await t.permanentlyDeleteTransaction(id);

    expect(await t.getDeletedTransactions()).toEqual([]);
    await t.restoreTransaction(id);
    expect(await t.getAllTransactions()).toEqual([]);
  });
});

describe("limpeza automática da Lixeira (prazo vencido)", () => {
  it("só apaga de vez depois que o prazo passa", async () => {
    const t = await load();
    await add(t, "Velha");
    await add(t, "Nova");
    const oldId = await firstId(t, "Velha");
    const newId = await firstId(t, "Nova");
    await t.deleteTransaction(oldId);
    await t.deleteTransaction(newId);

    const tooSoon = await t.purgeExpiredDeletedTransactions(new Date());
    expect(tooSoon).toBe(0);
    expect(await t.getDeletedTransactions()).toHaveLength(2);

    const future = new Date(Date.now() + (TRASH_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000);
    const purged = await t.purgeExpiredDeletedTransactions(future);
    expect(purged).toBe(2);
    expect(await t.getDeletedTransactions()).toEqual([]);
  });

  it("não mexe em quem ainda não passou do prazo", async () => {
    const t = await load();
    await add(t, "Recente");
    const id = await firstId(t, "Recente");
    await t.deleteTransaction(id);

    const purged = await t.purgeExpiredDeletedTransactions(new Date());

    expect(purged).toBe(0);
    expect(await t.getDeletedTransactions()).toHaveLength(1);
  });
});
