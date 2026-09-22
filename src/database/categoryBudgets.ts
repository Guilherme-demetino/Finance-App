import { getDatabase } from "./sqlite";
import type { CategoryBudgetRow } from "../types";

/**
 * Metas por categoria de um mês/ano: as definidas nesse mês, mais as que repetem de meses anteriores.
 *
 * Para uma categoria sem meta própria neste mês, olha a meta marcada para repetir mais recente de um mês anterior (a
 * mais recente vale até outra tomar o lugar). Um valor específico de um mês (sem marcar "repetir") não interrompe
 * essa herança: ele só vale naquele mês, e os seguintes continuam herdando a meta que repete de antes dele.
 */
export async function getCategoryBudgets(
  month: string,
  year: string,
): Promise<CategoryBudgetRow[]> {
  const db = await getDatabase();
  const exact = await db.getAllAsync<CategoryBudgetRow>(
    "SELECT * FROM category_budgets WHERE month = ? AND year = ?",
    month,
    year,
  );
  const covered = new Set(exact.map((row) => row.category.trim().toLowerCase()));

  const candidates = await db.getAllAsync<CategoryBudgetRow>(
    "SELECT * FROM category_budgets WHERE repeat_monthly = 1 AND (year < ? OR (year = ? AND month < ?)) ORDER BY year DESC, month DESC, id DESC",
    year,
    year,
    month,
  );
  const inherited: CategoryBudgetRow[] = [];
  const seen = new Set<string>();
  for (const row of candidates) {
    const key = row.category.trim().toLowerCase();
    if (covered.has(key) || seen.has(key)) continue;
    seen.add(key);
    inherited.push({ ...row, month, year });
  }

  return [...exact, ...inherited];
}

/**
 * Define (cria ou substitui) a meta de uma categoria num mês/ano específico. `repeat` marca se ela vale também nos
 * meses seguintes, até ser mudada ou removida.
 */
export async function setCategoryBudget(
  category: string,
  month: string,
  year: string,
  amount: number,
  repeat: boolean,
): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "INSERT OR REPLACE INTO category_budgets (category, month, year, amount, repeat_monthly) VALUES (?, ?, ?, ?, ?)",
    category,
    month,
    year,
    amount,
    repeat ? 1 : 0,
  );
}

/**
 * Tira a meta de uma categoria num mês/ano (a categoria e os gastos continuam). Compara sem diferenciar maiúsculas
 * nem espaços, como a leitura das metas faz.
 *
 * Também para a repetição por completo (não só deste mês em diante): a meta é um valor só, guardado uma vez, e a
 * herança sempre lê o estado atual dela — sem repetir mais, meses que antes herdavam essa meta (inclusive os já
 * passados, se forem consultados de novo depois) deixam de mostrá-la.
 */
export async function removeCategoryBudget(
  category: string,
  month: string,
  year: string,
): Promise<void> {
  const db = await getDatabase();
  const key = category.trim().toLowerCase();
  db.withTransactionSync(() => {
    db.runSync(
      "DELETE FROM category_budgets WHERE LOWER(TRIM(category)) = ? AND month = ? AND year = ?",
      key,
      month,
      year,
    );
    db.runSync(
      "UPDATE category_budgets SET repeat_monthly = 0 WHERE LOWER(TRIM(category)) = ? AND repeat_monthly = 1 AND (year < ? OR (year = ? AND month <= ?))",
      key,
      year,
      year,
      month,
    );
  });
}
