import type {
  AccountRow,
  BudgetRow,
  CardPaymentRow,
  CardPurchaseRow,
  CategoryBudgetRow,
  CategoryRow,
  CreditCardRow,
  DebtRow,
  SubscriptionPriceChangeRow,
  SubscriptionRow,
  SavingsGoalRow,
  TransactionRow,
} from "../types";
import type { BackupData } from "../utils/backup/backup";
import { DEFAULT_ACCOUNT_NAME } from "./accounts";
import { getDatabase } from "./sqlite";

/** Lê tudo que entra no backup (ver utils/backup/backup.ts para o que fica de fora). */
export async function readBackupData(): Promise<BackupData> {
  const db = await getDatabase();

  const user = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM users LIMIT 1",
  );
  const categories = await db.getAllAsync<CategoryRow>(
    "SELECT id, name, color, type FROM categories ORDER BY id",
  );
  // Excluídas há pouco (ainda podem ser restauradas na Lixeira) não entram no backup: para quem restaura, elas já não existem.
  const transactions = await db.getAllAsync<TransactionRow>(
    "SELECT id, amount, date, description, type, category_id, recurrence_group_id, recurrence_type, installment_number, installment_total, account, transfer_group_id FROM transactions WHERE deleted_at IS NULL ORDER BY id",
  );
  const budgets = await db.getAllAsync<BudgetRow>(
    "SELECT id, month, year, amount FROM budgets ORDER BY id",
  );
  const categoryBudgets = await db.getAllAsync<CategoryBudgetRow>(
    "SELECT id, category, month, year, amount, repeat_monthly FROM category_budgets ORDER BY id",
  );
  const debts = await db.getAllAsync<DebtRow>(
    "SELECT id, person, amount, type, description, date, status, settled_date, due_date FROM debts ORDER BY id",
  );
  const savingsGoals = await db.getAllAsync<SavingsGoalRow>(
    "SELECT id, name, target_amount, saved_amount, deadline, created_date, start_amount FROM savings_goals ORDER BY id",
  );

  const creditCards = await db.getAllAsync<CreditCardRow>(
    "SELECT id, name, closing_day, due_day, credit_limit, account FROM credit_cards ORDER BY id",
  );
  const cardPurchases = await db.getAllAsync<CardPurchaseRow>(
    "SELECT id, card_id, description, amount, date, category, invoice_ref, installment_group_id, installment_number, installment_total, transaction_id FROM card_purchases ORDER BY id",
  );
  const cardPayments = await db.getAllAsync<CardPaymentRow>(
    "SELECT id, card_id, invoice_ref, paid_date, amount, transaction_id FROM card_invoice_payments ORDER BY id",
  );

  const subscriptions = await db.getAllAsync<SubscriptionRow>(
    "SELECT id, name, amount, cycle, billing_day, billing_month, category, match_text, active, created_date, price_since, ignored_amount FROM subscriptions ORDER BY id",
  );
  const subscriptionPriceChanges = await db.getAllAsync<SubscriptionPriceChangeRow>(
    "SELECT id, subscription_id, date, old_amount, new_amount FROM subscription_price_changes ORDER BY id",
  );

  const accounts = await db.getAllAsync<AccountRow>(
    "SELECT id, name, color FROM accounts ORDER BY id",
  );

  return {
    userName: user?.name ?? null,
    categories,
    transactions,
    budgets,
    categoryBudgets,
    debts,
    savingsGoals,
    creditCards,
    cardPurchases,
    cardPayments,
    subscriptions,
    subscriptionPriceChanges,
    accounts,
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
    db.runSync("DELETE FROM credit_cards");
    db.runSync("DELETE FROM card_purchases");
    db.runSync("DELETE FROM card_invoice_payments");
    db.runSync("DELETE FROM subscriptions");
    db.runSync("DELETE FROM subscription_price_changes");
    db.runSync("DELETE FROM accounts");

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
        "INSERT INTO transactions (id, amount, date, description, type, category_id, recurrence_group_id, recurrence_type, installment_number, installment_total, account, transfer_group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
        t.account || DEFAULT_ACCOUNT_NAME, // backups antigos não têm conta
        t.transfer_group_id ?? null, // backups antigos não têm transferência
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
        "INSERT INTO category_budgets (id, category, month, year, amount, repeat_monthly) VALUES (?, ?, ?, ?, ?, ?)",
        b.id,
        b.category,
        b.month,
        b.year,
        b.amount,
        b.repeat_monthly ?? 0, // backups antigos não têm a repetição
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
        "INSERT INTO savings_goals (id, name, target_amount, saved_amount, deadline, created_date, start_amount) VALUES (?, ?, ?, ?, ?, ?, ?)",
        g.id,
        g.name,
        g.target_amount,
        g.saved_amount,
        g.deadline,
        g.created_date,
        g.start_amount ?? 0, // backups antigos não têm o valor inicial
      );
    }

    for (const c of data.creditCards ?? []) {
      db.runSync(
        "INSERT INTO credit_cards (id, name, closing_day, due_day, credit_limit, account) VALUES (?, ?, ?, ?, ?, ?)",
        c.id,
        c.name,
        c.closing_day,
        c.due_day,
        c.credit_limit ?? null,
        c.account || DEFAULT_ACCOUNT_NAME, // backups antigos não têm conta
      );
    }
    for (const p of data.cardPurchases ?? []) {
      db.runSync(
        "INSERT INTO card_purchases (id, card_id, description, amount, date, category, invoice_ref, installment_group_id, installment_number, installment_total, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        p.id,
        p.card_id,
        p.description,
        p.amount,
        p.date,
        p.category,
        p.invoice_ref,
        p.installment_group_id ?? null,
        p.installment_number ?? null,
        p.installment_total ?? null,
        p.transaction_id ?? null,
      );
    }
    for (const p of data.cardPayments ?? []) {
      db.runSync(
        "INSERT INTO card_invoice_payments (id, card_id, invoice_ref, paid_date, amount, transaction_id) VALUES (?, ?, ?, ?, ?, ?)",
        p.id,
        p.card_id,
        p.invoice_ref,
        p.paid_date,
        p.amount,
        p.transaction_id ?? null,
      );
    }

    for (const s of data.subscriptions ?? []) {
      db.runSync(
        "INSERT INTO subscriptions (id, name, amount, cycle, billing_day, billing_month, category, match_text, active, created_date, price_since, ignored_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        s.id,
        s.name,
        s.amount,
        s.cycle,
        s.billing_day,
        s.billing_month ?? null,
        s.category,
        s.match_text ?? null,
        s.active,
        s.created_date,
        s.price_since,
        s.ignored_amount ?? null,
      );
    }
    for (const c of data.subscriptionPriceChanges ?? []) {
      db.runSync(
        "INSERT INTO subscription_price_changes (id, subscription_id, date, old_amount, new_amount) VALUES (?, ?, ?, ?, ?)",
        c.id,
        c.subscription_id,
        c.date,
        c.old_amount,
        c.new_amount,
      );
    }

    for (const a of data.accounts ?? []) {
      db.runSync("INSERT INTO accounts (id, name, color) VALUES (?, ?, ?)", a.id, a.name, a.color);
    }

    if (data.userName !== null) {
      db.runSync("INSERT OR IGNORE INTO users (id, name) VALUES (1, ?)", data.userName);
      db.runSync("UPDATE users SET name = ? WHERE id = 1", data.userName);
    }
  });
}
