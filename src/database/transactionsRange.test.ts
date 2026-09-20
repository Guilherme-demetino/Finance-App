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
  const transactions = jest.requireActual<typeof import("./transactions")>("./transactions");
  await sqlite.resetDatabase();
  return transactions;
}

const add = (
  transactions: Awaited<ReturnType<typeof load>>,
  description: string,
  date: string,
  amount = 10,
) => transactions.createTransaction({ description, date, amount, type: "expense", category: "Outros" });

describe("getTransactionsInRange", () => {
  it("traz o período pedido, com as duas pontas inclusas, e nada de fora", async () => {
    const transactions = await load();
    for (const [name, date] of [
      ["antes", "31/08/2026"],
      ["primeiro dia", "01/09/2026"],
      ["meio", "15/09/2026"],
      ["último dia", "30/09/2026"],
      ["depois", "01/10/2026"],
    ]) {
      await add(transactions, name, date);
    }

    const rows = await transactions.getTransactionsInRange({ from: "01/09/2026", to: "30/09/2026" });

    expect(rows.map((row) => row.description).sort()).toEqual(["meio", "primeiro dia", "último dia"]);
  });

  it("atravessa a virada de ano: junta os anos tocados e corta pelas datas", async () => {
    const transactions = await load();
    for (const [name, date] of [
      ["novembro passado", "20/11/2025"],
      ["dezembro passado", "20/12/2025"],
      ["janeiro", "05/01/2026"],
      ["fevereiro", "10/02/2026"],
      ["março", "01/03/2026"],
    ]) {
      await add(transactions, name, date);
    }

    const rows = await transactions.getTransactionsInRange({ from: "15/12/2025", to: "28/02/2026" });

    expect(rows.map((row) => row.description).sort()).toEqual(["dezembro passado", "fevereiro", "janeiro"]);
  });

  it("período de vários anos, e sem nada dentro devolve lista vazia", async () => {
    const transactions = await load();
    await add(transactions, "2024", "10/06/2024");
    await add(transactions, "2026", "10/06/2026");

    expect((await transactions.getTransactionsInRange({ from: "01/01/2024", to: "31/12/2026" })).map((r) => r.description).sort()).toEqual([
      "2024",
      "2026",
    ]);
    expect(await transactions.getTransactionsInRange({ from: "01/01/2025", to: "31/12/2025" })).toEqual([]);
  });

  it("período inválido (datas trocadas ou vazias) não devolve nada, sem estourar", async () => {
    const transactions = await load();
    await add(transactions, "qualquer", "10/06/2026");

    expect(await transactions.getTransactionsInRange({ from: "30/09/2026", to: "01/09/2026" })).toEqual([]);
    expect(await transactions.getTransactionsInRange({ from: "", to: "" })).toEqual([]);
  });

  it("traz as transações do tipo receita também, e os campos de série", async () => {
    const transactions = await load();
    await transactions.createTransaction({ description: "Salário", date: "05/09/2026", amount: 3000, type: "income", category: "Salário" });

    const [row] = await transactions.getTransactionsInRange({ from: "01/09/2026", to: "30/09/2026" });

    expect(row).toMatchObject({ description: "Salário", type: "income", amount: 3000, category_id: "Salário" });
  });
});
