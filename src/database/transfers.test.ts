import { createSqlJsDatabase } from "../test/sqliteFake";

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
    transfers: jest.requireActual<typeof import("./transfers")>("./transfers"),
    transactions: jest.requireActual<typeof import("./transactions")>("./transactions"),
  };
}

describe("transferência entre contas", () => {
  it("cria uma saída na origem e uma entrada no destino, com o mesmo valor e data", async () => {
    const { transfers, transactions } = await load();

    await transfers.createTransfer({ amount: 500, date: "10/09/2026", fromAccount: "Carteira", toAccount: "Poupança" });

    const rows = await transactions.getAllTransactions();
    expect(rows).toHaveLength(2);
    const out = rows.find((r) => r.type === "expense")!;
    const income = rows.find((r) => r.type === "income")!;
    expect(out).toMatchObject({ amount: 500, date: "10/09/2026", account: "Carteira", description: "Transferência para Poupança" });
    expect(income).toMatchObject({ amount: 500, date: "10/09/2026", account: "Poupança", description: "Transferência de Carteira" });
    expect(out.transfer_group_id).toBe(income.transfer_group_id);
    expect(out.transfer_group_id).toBeTruthy();
  });

  it("cada transferência tem um id de grupo diferente", async () => {
    const { transfers, transactions } = await load();

    await transfers.createTransfer({ amount: 100, date: "01/09/2026", fromAccount: "A", toAccount: "B" });
    await transfers.createTransfer({ amount: 200, date: "02/09/2026", fromAccount: "A", toAccount: "B" });

    const rows = await transactions.getAllTransactions();
    const groupIds = new Set(rows.map((r) => r.transfer_group_id));
    expect(groupIds.size).toBe(2);
  });

  it("apagar a transferência tira as duas pontas (com prazo, como uma transação comum)", async () => {
    const { transfers, transactions } = await load();
    await transfers.createTransfer({ amount: 500, date: "10/09/2026", fromAccount: "Carteira", toAccount: "Poupança" });
    const groupId = (await transactions.getAllTransactions())[0].transfer_group_id!;

    await transfers.deleteTransferGroup(groupId);

    expect(await transactions.getAllTransactions()).toEqual([]);
    const trashed = await transactions.getDeletedTransactions();
    expect(trashed).toHaveLength(2);
    expect(trashed.every((r) => r.transfer_group_id === groupId)).toBe(true);
  });

  it("restaurar uma ponta da Lixeira devolve só ela (a outra continua restaurável)", async () => {
    const { transfers, transactions } = await load();
    await transfers.createTransfer({ amount: 500, date: "10/09/2026", fromAccount: "Carteira", toAccount: "Poupança" });
    const [first] = await transactions.getAllTransactions();
    await transfers.deleteTransferGroup(first.transfer_group_id!);

    await transactions.restoreTransaction(first.id);

    expect(await transactions.getAllTransactions()).toHaveLength(1);
    expect(await transactions.getDeletedTransactions()).toHaveLength(1);
  });
});
