import type {
  BudgetRow,
  CategoryBudgetRow,
  CategoryRow,
  DebtRow,
  SavingsGoalRow,
  TransactionRow,
} from "../types";
import type { BackupData } from "../utils/backup";
import { getDatabase } from "./sqlite";

/** Lê tudo que entra no backup (ver utils/backup.ts para o que fica de fora). */
export async function readBackupData(): Promise<BackupData> {
  const db = await getDatabase();

  const user = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM users LIMIT 1",
  );
  const categories = await db.getAllAsync<CategoryRow>(
    "SELECT id, name, color, type FROM categories ORDER BY id",
  );
  const transactions = await db.getAllAsync<TransactionRow>(
    "SELECT id, amount, date, description, type, category_id, recurrence_group_id, recurrence_type, installment_number, installment_total FROM transactions ORDER BY id",
  );
  const budgets = await db.getAllAsync<BudgetRow>(
    "SELECT id, month, year, amount FROM budgets ORDER BY id",
  );
  const categoryBudgets = await db.getAllAsync<CategoryBudgetRow>(
    "SELECT id, category, month, year, amount FROM category_budgets ORDER BY id",
  );
  const debts = await db.getAllAsync<DebtRow>(
    "SELECT id, person, amount, type, description, date, status, settled_date, due_date FROM debts ORDER BY id",
  );
  const savingsGoals = await db.getAllAsync<SavingsGoalRow>(
    "SELECT id, name, target_amount, saved_amount, deadline, created_date FROM savings_goals ORDER BY id",
  );

  return {
    userName: user?.name ?? null,
    categories,
    transactions,
    budgets,
    categoryBudgets,
    debts,
    savingsGoals,
  };
}

/**
 * Troca tudo o que está no app pelos dados do backup, numa única transação:
 * se qualquer gravação falhar, nada muda (o banco volta ao que era antes).
 * O backup já deve ter passado por parseBackup. A foto do perfil e o PIN
 * ficam como estão.
 */
export async function replaceAllData(data: BackupData): Promise<void> {
  const db = await getDatabase();

  db.withTransactionSync(() => {
    db.runSync("DELETE FROM transactions");
    db.runSync("DELETE FROM categories");
    db.runSync("DELETE FROM budgets");
    db.runSync("DELETE FROM category_budgets");
    db.runSync("DELETE FROM debts");
    db.runSync("DELETE FROM savings_goals");

    for (const c of data.categories) {
      db.runSync(
        "INSERT INTO categories (id, name, color, type) VALUES (?, ?, ?, ?)",
        c.id,
        c.name,
        c.color,
        c.type,
      );
    }
    for (const t of data.transactions) {
      db.runSync(
        "INSERT INTO transactions (id, amount, date, description, type, category_id, recurrence_group_id, recurrence_type, installment_number, installment_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        t.id,
        t.amount,
        t.date,
        t.description,
        t.type,
        t.category_id,
        t.recurrence_group_id ?? null,
        t.recurrence_type ?? null,
        t.installment_number ?? null,
        t.installment_total ?? null,
      );
    }
    for (const b of data.budgets) {
      db.runSync(
        "INSERT INTO budgets (id, month, year, amount) VALUES (?, ?, ?, ?)",
        b.id,
        b.month,
        b.year,
        b.amount,
      );
    }
    for (const b of data.categoryBudgets) {
      db.runSync(
        "INSERT INTO category_budgets (id, category, month, year, amount) VALUES (?, ?, ?, ?, ?)",
        b.id,
        b.category,
        b.month,
        b.year,
        b.amount,
      );
    }
    for (const d of data.debts) {
      db.runSync(
        "INSERT INTO debts (id, person, amount, type, description, date, status, settled_date, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        d.id,
        d.person,
        d.amount,
        d.type,
        d.description,
        d.date,
        d.status,
        d.settled_date,
        d.due_date,
      );
    }
    for (const g of data.savingsGoals) {
      db.runSync(
        "INSERT INTO savings_goals (id, name, target_amount, saved_amount, deadline, created_date) VALUES (?, ?, ?, ?, ?, ?)",
        g.id,
        g.name,
        g.target_amount,
        g.saved_amount,
        g.deadline,
        g.created_date,
      );
    }

    if (data.userName !== null) {
      db.runSync("INSERT OR IGNORE INTO users (id, name) VALUES (1, ?)", data.userName);
      db.runSync("UPDATE users SET name = ? WHERE id = 1", data.userName);
    }
  });
}
