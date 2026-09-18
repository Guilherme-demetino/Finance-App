import * as SQLite from "expo-sqlite";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;

function createTables(db: SQLite.SQLiteDatabase) {
  db.runSync("PRAGMA journal_mode = WAL;");

  db.withTransactionSync(() => {
    db.runSync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        avatar TEXT
      );
    `);

    db.runSync(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'expense'
      );
    `);

    db.runSync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL,
        category_id TEXT NOT NULL
      );
    `);

    db.runSync(`
      CREATE TABLE IF NOT EXISTS security (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pin TEXT NOT NULL
      );
    `);
  });
}

/**
 * Inicializa o banco (idempotente) e mantém uma única instância
 * compartilhada por todo o app.
 */
export async function initDatabase() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const db = SQLite.openDatabaseSync("meufinanceiro.db");
        createTables(db);
        dbInstance = db;
      } catch (error) {
        console.log("Erro crítico ao inicializar o banco de dados:", error);
        // permite tentar novamente numa próxima chamada
        initPromise = null;
        throw error;
      }
    })();
  }
  return initPromise;
}

/**
 * Retorna a conexão pronta para uso. Garante que as tabelas já
 * existem antes de devolver o db, mesmo que ninguém tenha chamado
 * initDatabase() explicitamente antes (ex: build de produção onde
 * a ordem de montagem dos componentes pode variar).
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    await initDatabase();
  }
  return dbInstance as SQLite.SQLiteDatabase;
}

/** Apaga todos os dados do app (transações, categorias, usuário e PIN legado). */
export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    db.runSync("DROP TABLE IF EXISTS transactions");
    db.runSync("DROP TABLE IF EXISTS categories");
    db.runSync("DROP TABLE IF EXISTS users");
    db.runSync("DROP TABLE IF EXISTS security");
  });
}
