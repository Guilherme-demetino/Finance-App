import * as SQLite from "expo-sqlite";
import { logError } from "../utils/logger";

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
        category_id TEXT NOT NULL,
        recurrence_group_id TEXT,
        recurrence_type TEXT,
        installment_number INTEGER,
        installment_total INTEGER
      );
    `);

    db.runSync(`
      CREATE TABLE IF NOT EXISTS security (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pin TEXT NOT NULL
      );
    `);

    db.runSync(`
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT NOT NULL,
        year TEXT NOT NULL,
        amount REAL NOT NULL,
        UNIQUE(month, year)
      );
    `);

    db.runSync(`
      CREATE TABLE IF NOT EXISTS category_budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        month TEXT NOT NULL,
        year TEXT NOT NULL,
        amount REAL NOT NULL,
        UNIQUE(category, month, year)
      );
    `);

    db.runSync(`
      CREATE TABLE IF NOT EXISTS debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        settled_date TEXT,
        due_date TEXT
      );
    `);

    db.runSync(`
      CREATE TABLE IF NOT EXISTS savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        target_amount REAL NOT NULL,
        saved_amount REAL NOT NULL DEFAULT 0,
        deadline TEXT,
        created_date TEXT NOT NULL
      );
    `);

    // Guarda avisos do próprio app (ex: qual novidade o usuário já viu).
    // Fica fora do resetDatabase de propósito: não é dado financeiro.
    db.runSync(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  });

  // Migração: instalações existentes já têm essas tabelas sem as colunas
  // abaixo (CREATE TABLE IF NOT EXISTS não altera tabelas já criadas).
  // ALTER TABLE falha se a coluna já existir — ignoramos o erro.
  const columnsToMigrate: { table: string; column: string }[] = [
    { table: "transactions", column: "recurrence_group_id TEXT" },
    { table: "transactions", column: "recurrence_type TEXT" },
    { table: "transactions", column: "installment_number INTEGER" },
    { table: "transactions", column: "installment_total INTEGER" },
    { table: "debts", column: "due_date TEXT" },
  ];
  for (const { table, column } of columnsToMigrate) {
    try {
      db.runSync(`ALTER TABLE ${table} ADD COLUMN ${column};`);
    } catch {
      // coluna já existe — instalação recente, nada a fazer
    }
  }

  // Buscar, apagar tudo e apagar "daqui pra frente" numa série recorrente ou
  // parcelada filtram por recurrence_group_id. Parcial: as transações avulsas
  // (a maioria) ficam de fora. Vem depois da migração de colunas, que é quem
  // cria a coluna nas instalações antigas.
  db.runSync(
    "CREATE INDEX IF NOT EXISTS idx_transactions_recurrence_group ON transactions(recurrence_group_id) WHERE recurrence_group_id IS NOT NULL;",
  );
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
        logError("Erro crítico ao inicializar o banco de dados:", error);
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

/** Apaga todos os dados do app (transações, categorias, orçamentos, usuário e PIN legado). */
export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    db.runSync("DROP TABLE IF EXISTS transactions");
    db.runSync("DROP TABLE IF EXISTS categories");
    db.runSync("DROP TABLE IF EXISTS budgets");
    db.runSync("DROP TABLE IF EXISTS category_budgets");
    db.runSync("DROP TABLE IF EXISTS debts");
    db.runSync("DROP TABLE IF EXISTS savings_goals");
    db.runSync("DROP TABLE IF EXISTS users");
    db.runSync("DROP TABLE IF EXISTS security");
  });
}
