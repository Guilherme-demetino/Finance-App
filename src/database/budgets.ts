import { getDatabase } from "./sqlite";
import type { BudgetRow } from "../types";

/** Busca o orçamento definido para um mês/ano, ou null se nunca foi definido. */
export async function getBudget(
  month: string,
  year: string,
): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<BudgetRow>(
    "SELECT * FROM budgets WHERE month = ? AND year = ?",
    month,
    year,
  );
  return row ? row.amount : null;
}

/** Define (cria ou substitui) o orçamento de um mês/ano específico. */
export async function setBudget(
  month: string,
  year: string,
  amount: number,
): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "INSERT OR REPLACE INTO budgets (month, year, amount) VALUES (?, ?, ?)",
    month,
    year,
    amount,
  );
}
