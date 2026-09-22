import type { SubscriptionCycle, SubscriptionPriceChangeRow, SubscriptionRow } from "../types";
import { getDatabase } from "./sqlite";

export interface SubscriptionData {
  name: string;
  amount: number;
  cycle: SubscriptionCycle;
  billingDay: number;
  /** Só nas anuais. */
  billingMonth: number | null;
  category: string;
  /** Vazio = vale o nome. */
  matchText: string;
}

const cents = (value: number) => Math.round(value * 100);

const matchOrNull = (text: string) => (text.trim() === "" ? null : text.trim());

export async function getAllSubscriptions(): Promise<SubscriptionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<SubscriptionRow>("SELECT * FROM subscriptions ORDER BY active DESC, name COLLATE NOCASE, id");
}

export async function getAllPriceChanges(): Promise<SubscriptionPriceChangeRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<SubscriptionPriceChangeRow>("SELECT * FROM subscription_price_changes ORDER BY id");
}

/** `today` (DD/MM/AAAA) é a data de criação e o começo da validade do valor. */
export async function createSubscription(data: SubscriptionData, today: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO subscriptions (name, amount, cycle, billing_day, billing_month, category, match_text, active, created_date, price_since, ignored_amount) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)",
    [data.name.trim(), data.amount, data.cycle, data.billingDay, data.cycle === "yearly" ? data.billingMonth : null, data.category, matchOrNull(data.matchText), today, today],
  );
  return result.lastInsertRowId;
}

/**
 * Edita a assinatura. Se o valor mudou, anota o reajuste (de quanto para quanto e quando), o novo valor passa a valer a
 * partir de `today` e uma cobrança ignorada antes deixa de valer.
 */
export async function updateSubscription(id: number, data: SubscriptionData, today: string): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    const [current] = db.getAllSync<SubscriptionRow>("SELECT * FROM subscriptions WHERE id = ?", id);
    if (!current) return;
    const changedPrice = cents(current.amount) !== cents(data.amount);
    if (changedPrice) {
      db.runSync(
        "INSERT INTO subscription_price_changes (subscription_id, date, old_amount, new_amount) VALUES (?, ?, ?, ?)",
        id,
        today,
        current.amount,
        data.amount,
      );
    }
    db.runSync(
      "UPDATE subscriptions SET name = ?, amount = ?, cycle = ?, billing_day = ?, billing_month = ?, category = ?, match_text = ?, price_since = ?, ignored_amount = ? WHERE id = ?",
      data.name.trim(),
      data.amount,
      data.cycle,
      data.billingDay,
      data.cycle === "yearly" ? data.billingMonth : null,
      data.category,
      matchOrNull(data.matchText),
      changedPrice ? today : current.price_since,
      changedPrice ? null : current.ignored_amount,
      id,
    );
  });
}

/** Aceita o reajuste que o alerta achou: o valor passa a ser o da cobrança, valendo a partir da data dela. */
export async function applyDetectedPrice(id: number, newAmount: number, chargeDate: string): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    const [current] = db.getAllSync<SubscriptionRow>("SELECT * FROM subscriptions WHERE id = ?", id);
    if (!current || cents(current.amount) === cents(newAmount)) return;
    db.runSync(
      "INSERT INTO subscription_price_changes (subscription_id, date, old_amount, new_amount) VALUES (?, ?, ?, ?)",
      id,
      chargeDate,
      current.amount,
      newAmount,
    );
    db.runSync("UPDATE subscriptions SET amount = ?, price_since = ?, ignored_amount = NULL WHERE id = ?", newAmount, chargeDate, id);
  });
}

/** "Ignorar": essa cobrança diferente não alerta de novo (outro valor diferente alerta). */
export async function ignoreDetectedPrice(id: number, amount: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE subscriptions SET ignored_amount = ? WHERE id = ?", [amount, id]);
}

export async function setSubscriptionActive(id: number, active: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE subscriptions SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
}

export async function deleteSubscription(id: number): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    db.runSync("DELETE FROM subscription_price_changes WHERE subscription_id = ?", id);
    db.runSync("DELETE FROM subscriptions WHERE id = ?", id);
  });
}
