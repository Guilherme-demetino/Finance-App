import { getDatabase } from "./sqlite";
import type { CategoryBudgetRow } from "../types";

/** Busca todas as metas por categoria definidas para um mês/ano. */
export async function getCategoryBudgets(
  month: string,
  year: string,
): Promise<CategoryBudgetRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CategoryBudgetRow>(
    "SELECT * FROM category_budgets WHERE month = ? AND year = ?",
    month,
    year,
  );
}

/** Define (cria ou substitui) a meta de uma categoria num mês/ano específico. */
export async function setCategoryBudget(
  category: string,
  month: string,
  year: string,
  amount: number,
): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "INSERT OR REPLACE INTO category_budgets (category, month, year, amount) VALUES (?, ?, ?, ?)",
    category,
    month,
    year,
    amount,
  );
}

/**
 * Tira a meta de uma categoria num mês/ano. Compara sem diferenciar maiúsculas nem espaços, como a
 * leitura das metas faz: "alimentação" e "Alimentação" são a mesma categoria.
 */
export async function removeCategoryBudget(
  category: string,
  month: string,
  year: string,
): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "DELETE FROM category_budgets WHERE LOWER(TRIM(category)) = ? AND month = ? AND year = ?",
    category.trim().toLowerCase(),
    month,
    year,
  );
}
