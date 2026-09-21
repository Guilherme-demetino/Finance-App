// Banco de mentira que só modela o que importa aqui: quais tabelas existem.
// Usar uma tabela que não existe dá o mesmo erro do SQLite de verdade.
const mockTables = new Set<string>();
const mockLog: string[] = [];

function mockExec(sql: string) {
  mockLog.push(sql.replace(/\s+/g, " ").trim());

  const create = sql.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
  if (create) {
    mockTables.add(create[1]);
    return;
  }
  const drop = sql.match(/DROP TABLE IF EXISTS\s+(\w+)/i);
  if (drop) {
    mockTables.delete(drop[1]);
    return;
  }
  const ref = sql.match(/(?:FROM|INTO|UPDATE|ALTER TABLE)\s+(\w+)/i);
  if (ref && !mockTables.has(ref[1])) {
    throw new Error(`no such table: ${ref[1]}`);
  }
}

jest.mock("expo-sqlite", () => ({
  openDatabaseSync: () => ({
    runSync: (sql: string) => mockExec(sql),
    getAllAsync: async (sql: string) => {
      mockExec(sql);
      return [];
    },
    withTransactionSync: (fn: () => void) => fn(),
  }),
}));

const ALL_TABLES = [
  "users",
  "categories",
  "transactions",
  "security",
  "budgets",
  "category_budgets",
  "debts",
  "savings_goals",
  "credit_cards",
  "card_purchases",
  "card_invoice_payments",
  "app_meta",
];

// Cada teste começa com o módulo "recém-aberto", como no primeiro uso do app.
function loadModules() {
  jest.resetModules();
  mockTables.clear();
  mockLog.length = 0;
  return {
    sqlite: jest.requireActual<typeof import("./sqlite")>("./sqlite"),
    users: jest.requireActual<typeof import("./users")>("./users"),
  };
}

describe("resetDatabase", () => {
  it("cria todas as tabelas na primeira abertura", async () => {
    const { sqlite } = loadModules();
    await sqlite.getDatabase();
    expect([...mockTables].sort()).toEqual([...ALL_TABLES].sort());
  });

  it("depois de zerar o app dá para cadastrar o nome de novo sem reiniciar", async () => {
    const { sqlite, users } = loadModules();
    await sqlite.getDatabase();

    await sqlite.resetDatabase();

    await expect(users.upsertUserName("Ana")).resolves.toBeUndefined();
    await expect(users.getUser()).resolves.toBeNull();
  });

  it("apaga os dados e recria as tabelas, menos o que não é dado financeiro", async () => {
    const { sqlite } = loadModules();
    await sqlite.getDatabase();
    mockLog.length = 0;

    await sqlite.resetDatabase();

    const dropped = mockLog.filter((sql) => sql.startsWith("DROP TABLE"));
    expect(dropped).toContain("DROP TABLE IF EXISTS transactions");
    expect(dropped).toContain("DROP TABLE IF EXISTS users");
    // app_meta guarda avisos do próprio app e fica de fora de propósito
    expect(dropped.join(" ")).not.toContain("app_meta");

    const lastDrop = mockLog.reduce(
      (last, sql, i) => (sql.startsWith("DROP TABLE") ? i : last),
      -1,
    );
    const createdAfter = mockLog
      .slice(lastDrop + 1)
      .filter((sql) => sql.startsWith("CREATE TABLE"));
    expect(createdAfter.length).toBeGreaterThanOrEqual(8);
    expect([...mockTables].sort()).toEqual([...ALL_TABLES].sort());
  });
});
