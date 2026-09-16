import * as SQLite from "expo-sqlite";

export async function initDatabase() {
  try {
    const db = await SQLite.openDatabaseAsync("meufinanceiro.db");

    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      
      -- Tabela do Usuário (Para salvar o nome e preferências locais)
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );

      -- Tabela de Categorias
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        type TEXT NOT NULL
      );

      -- Tabela de Transações (Receitas e Despesas)
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        category_id INTEGER,
        type TEXT NOT NULL,
        installment_info TEXT,
        FOREIGN KEY (category_id) REFERENCES categories (id)
      );
    `);

    console.log("Banco de dados e tabelas criados com sucesso!");
  } catch (error) {
    console.error("Erro ao inicializar o banco de dados: ", error);
  }
}
