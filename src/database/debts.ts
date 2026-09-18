import { getDatabase } from "./sqlite";
import type { DebtRow, DebtType } from "../types";

export async function getAllDebts(): Promise<DebtRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<DebtRow>("SELECT * FROM debts ORDER BY id DESC");
}

export interface DebtInput {
  person: string;
  amount: number;
  type: DebtType;
  description: string | null;
  date: string;
  dueDate: string | null;
}

export async function createDebt(data: DebtInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO debts (person, amount, type, description, date, status, due_date) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
    [data.person, data.amount, data.type, data.description, data.date, data.dueDate],
  );
}

/** Marca uma dívida como quitada — o dinheiro efetivamente trocou de mãos nessa data. */
export async function markDebtAsSettled(
  id: number,
  settledDate: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE debts SET status = 'settled', settled_date = ? WHERE id = ?",
    [settledDate, id],
  );
}

export async function deleteDebt(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM debts WHERE id = ?", [id]);
}
