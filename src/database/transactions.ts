import { getDatabase } from "./sqlite";
import type { TransactionRow, TransactionType } from "../types";

export async function getAllTransactions(): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    "SELECT * FROM transactions ORDER BY id DESC",
  );
}

export interface TransactionInput {
  amount: number;
  date: string;
  description: string;
  type: TransactionType;
  category: string;
}

export async function createTransaction(
  data: TransactionInput,
): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "INSERT INTO transactions (amount, date, description, type, category_id) VALUES (?, ?, ?, ?, ?)",
    data.amount,
    data.date,
    data.description,
    data.type,
    data.category,
  );
}

export async function updateTransaction(
  id: number,
  data: TransactionInput,
): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "UPDATE transactions SET amount = ?, date = ?, description = ?, type = ?, category_id = ? WHERE id = ?",
    data.amount,
    data.date,
    data.description,
    data.type,
    data.category,
    id,
  );
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDatabase();
  db.runSync("DELETE FROM transactions WHERE id = ?", id);
}

/** Apaga todas as transações de um mês/ano específico (formato DD/MM/AAAA). */
export async function deleteTransactionsByMonth(
  monthNumber: string,
  year: string,
): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "DELETE FROM transactions WHERE date LIKE ?",
    `%/${monthNumber}/${year}`,
  );
}
