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
    accounts: jest.requireActual<typeof import("./accounts")>("./accounts"),
    transactions: jest.requireActual<typeof import("./transactions")>("./transactions"),
  };
}

describe("contas/carteiras", () => {
  it("começa sem nenhuma conta cadastrada", async () => {
    const { accounts } = await load();
    expect(await accounts.getAllAccounts()).toEqual([]);
  });

  it("cria e lista, na ordem de criação, com o nome sem espaços nas pontas", async () => {
    const { accounts } = await load();
    await accounts.createAccount("  Carteira  ", "#111111");
    await accounts.createAccount("Poupança", "#222222");

    const rows = await accounts.getAllAccounts();
    expect(rows.map((r) => r.name)).toEqual(["Carteira", "Poupança"]);
    expect(rows[0].color).toBe("#111111");
  });

  it("apagar uma conta não mexe nas transações já lançadas com o nome dela", async () => {
    const { accounts, transactions } = await load();
    await accounts.createAccount("Carteira", "#111111");
    const [carteira] = await accounts.getAllAccounts();
    await transactions.createTransaction({
      amount: 10,
      date: "01/09/2026",
      description: "Café",
      type: "expense",
      category: "Alimentação",
      account: "Carteira",
    });

    await accounts.deleteAccount(carteira.id);

    expect(await accounts.getAllAccounts()).toEqual([]);
    const [transaction] = await transactions.getAllTransactions();
    expect(transaction.account).toBe("Carteira");
  });
});

describe("transações sem conta escolhida", () => {
  it("caem na conta padrão (Conta principal)", async () => {
    const { transactions } = await load();
    await transactions.createTransaction({
      amount: 10,
      date: "01/09/2026",
      description: "Café",
      type: "expense",
      category: "Alimentação",
    });

    const [row] = await transactions.getAllTransactions();
    expect(row.account).toBe("Conta principal");
  });

  it("conta em branco também cai na conta padrão", async () => {
    const { transactions } = await load();
    await transactions.createTransaction({
      amount: 10,
      date: "01/09/2026",
      description: "Café",
      type: "expense",
      category: "Alimentação",
      account: "   ",
    });

    const [row] = await transactions.getAllTransactions();
    expect(row.account).toBe("Conta principal");
  });
});
