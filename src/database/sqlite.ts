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
        created_date TEXT NOT NULL,
        start_amount REAL NOT NULL DEFAULT 0
      );
    `);

    // Cartões de crédito: cada compra vira uma despesa na data da compra; pagar a fatura só liquida (não cria outra despesa).
    db.runSync(`
      CREATE TABLE IF NOT EXISTS credit_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        closing_day INTEGER NOT NULL,
        due_day INTEGER NOT NULL,
        credit_limit REAL
      );
    `);

    db.runSync(`
      CREATE TABLE IF NOT EXISTS card_purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        invoice_ref TEXT NOT NULL,
        installment_group_id TEXT,
        installment_number INTEGER,
        installment_total INTEGER,
        transaction_id INTEGER
      );
    `);

    db.runSync(`
      CREATE TABLE IF NOT EXISTS card_invoice_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id INTEGER NOT NULL,
        invoice_ref TEXT NOT NULL,
        paid_date TEXT NOT NULL,
        amount REAL NOT NULL,
        transaction_id INTEGER,
        UNIQUE(card_id, invoice_ref)
      );
    `);

    db.runSync(
      "CREATE INDEX IF NOT EXISTS idx_card_purchases_card ON card_purchases(card_id, invoice_ref);",
    );

    // Assinaturas recorrentes: controle do que se paga (não geram despesas) e o histórico de reajustes de valor.
    db.runSync(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        cycle TEXT NOT NULL DEFAULT 'monthly',
        billing_day INTEGER NOT NULL,
        billing_month INTEGER,
        category TEXT NOT NULL,
        match_text TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_date TEXT NOT NULL,
        price_since TEXT NOT NULL,
        ignored_amount REAL
      );
    `);

    db.runSync(`
      CREATE TABLE IF NOT EXISTS subscription_price_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscription_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        old_amount REAL NOT NULL,
        new_amount REAL NOT NULL
      );
    `);

    // Metas criadas antes da projeção não têm o valor inicial (começam em 0).
    try {
      db.runSync("ALTER TABLE savings_goals ADD COLUMN start_amount REAL NOT NULL DEFAULT 0");
    } catch {
      // Já existe (banco novo ou já atualizado).
    }

    // Bancos criados antes de a compra no cartão virar despesa não têm a coluna que liga a compra à despesa.
    try {
      db.runSync("ALTER TABLE card_purchases ADD COLUMN transaction_id INTEGER");
    } catch {
      // Já existe (banco novo ou já atualizado).
    }

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

/**
 * Apaga todos os dados do app (transações, categorias, orçamentos, usuário e
 * PIN legado) e recria as tabelas vazias. A conexão continua aberta e o
 * initDatabase não roda de novo, então sem recriar aqui qualquer gravação
 * seguinte (ex: cadastrar o nome de novo) falharia com "no such table" até o
 * app ser reiniciado.
 */
export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    db.runSync("DROP TABLE IF EXISTS transactions");
    db.runSync("DROP TABLE IF EXISTS categories");
    db.runSync("DROP TABLE IF EXISTS budgets");
    db.runSync("DROP TABLE IF EXISTS category_budgets");
    db.runSync("DROP TABLE IF EXISTS debts");
    db.runSync("DROP TABLE IF EXISTS savings_goals");
    db.runSync("DROP TABLE IF EXISTS credit_cards");
    db.runSync("DROP TABLE IF EXISTS card_purchases");
    db.runSync("DROP TABLE IF EXISTS card_invoice_payments");
    db.runSync("DROP TABLE IF EXISTS subscriptions");
    db.runSync("DROP TABLE IF EXISTS subscription_price_changes");
    db.runSync("DROP TABLE IF EXISTS users");
    db.runSync("DROP TABLE IF EXISTS security");
  });
  createTables(db);
}
