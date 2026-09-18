import { getDatabase } from "./sqlite";
import type { SavingsGoalRow } from "../types";

export async function getAllSavingsGoals(): Promise<SavingsGoalRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<SavingsGoalRow>(
    "SELECT * FROM savings_goals ORDER BY id DESC",
  );
}

export interface SavingsGoalInput {
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
  createdDate: string;
}

export async function createSavingsGoal(data: SavingsGoalInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO savings_goals (name, target_amount, saved_amount, deadline, created_date) VALUES (?, ?, ?, ?, ?)",
    [data.name, data.targetAmount, data.savedAmount, data.deadline, data.createdDate],
  );
}

export async function updateSavedAmount(
  id: number,
  savedAmount: number,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE savings_goals SET saved_amount = ? WHERE id = ?", [
    savedAmount,
    id,
  ]);
}

export async function deleteSavingsGoal(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM savings_goals WHERE id = ?", [id]);
}
