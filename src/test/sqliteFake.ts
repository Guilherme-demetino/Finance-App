import initSqlJs, { type Database, type SqlValue } from "sql.js";

/**
 * Banco SQLite de verdade (sql.js, em memória) com a parte da interface do
 * expo-sqlite que o app usa. Serve para testar gravações de verdade (DELETE,
 * INSERT, rollback) sem precisar de um aparelho. Só para testes.
 */
export async function createSqlJsDatabase() {
  const SQL = await initSqlJs();
  const raw: Database = new SQL.Database();

  // O expo-sqlite aceita os parâmetros soltos ou dentro de um array.
  const toParams = (args: unknown[]): SqlValue[] =>
    (args.length === 1 && Array.isArray(args[0]) ? args[0] : args) as SqlValue[];

  function all<T>(sql: string, args: unknown[]): T[] {
    const statement = raw.prepare(sql);
    try {
      statement.bind(toParams(args));
      const rows: T[] = [];
      while (statement.step()) rows.push(statement.getAsObject() as T);
      return rows;
    } finally {
      statement.free();
    }
  }

  const db = {
    runSync(sql: string, ...args: unknown[]) {
      raw.run(sql, toParams(args));
      const [{ values }] = raw.exec("SELECT last_insert_rowid()");
      return { changes: raw.getRowsModified(), lastInsertRowId: Number(values[0][0]) };
    },
    async runAsync(sql: string, ...args: unknown[]) {
      return db.runSync(sql, ...args);
    },
    getAllSync<T>(sql: string, ...args: unknown[]): T[] {
      return all<T>(sql, args);
    },
    async getAllAsync<T>(sql: string, ...args: unknown[]): Promise<T[]> {
      return all<T>(sql, args);
    },
    async getFirstAsync<T>(sql: string, ...args: unknown[]): Promise<T | null> {
      return all<T>(sql, args)[0] ?? null;
    },
    withTransactionSync(task: () => void) {
      raw.run("BEGIN");
      try {
        task();
        raw.run("COMMIT");
      } catch (error) {
        raw.run("ROLLBACK");
        throw error;
      }
    },
  };

  return db;
}
