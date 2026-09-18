import { getDatabase } from "./sqlite";
import type { CategoryRow, TransactionType } from "../types";

export async function getAllCategories(): Promise<CategoryRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CategoryRow>("SELECT * FROM categories ORDER BY id DESC");
}

export async function createCategory(
  name: string,
  color: string,
  type: TransactionType,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO categories (name, color, type) VALUES (?, ?, ?)",
    [name, color, type],
  );
}

/**
 * Apaga uma categoria. Transações e metas já registradas com esse nome
 * continuam existindo (guardam a categoria como texto), só deixam de
 * aparecer atreladas a essa categoria formal.
 */
export async function deleteCategory(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM categories WHERE id = ?", [id]);
}
