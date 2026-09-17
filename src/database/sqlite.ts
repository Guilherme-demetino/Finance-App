import * as SQLite from "expo-sqlite";

export async function initDatabase() {
  try {
    const db = SQLite.openDatabaseSync("meufinanceiro.db");

    // Configuração do banco sempre FORA da transação
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
    });
  } catch (error) {
    console.log("Erro crítico ao inicializar o banco de dados:", error);
  }
}
