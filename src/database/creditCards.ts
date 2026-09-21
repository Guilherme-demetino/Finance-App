import type { CardPaymentRow, CardPurchaseRow, CreditCardRow } from "../types";
import { CREDIT_CARD_CATEGORY, formatRef, type NewPurchase } from "../utils/creditCards";
import { getDatabase } from "./sqlite";

export interface CreditCardInput {
  name: string;
  closingDay: number;
  dueDay: number;
  /** null = sem limite definido. */
  limit: number | null;
}

export async function getAllCreditCards(): Promise<CreditCardRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CreditCardRow>("SELECT * FROM credit_cards ORDER BY id");
}

export async function createCreditCard(input: CreditCardInput): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO credit_cards (name, closing_day, due_day, credit_limit) VALUES (?, ?, ?, ?)",
    [input.name.trim(), input.closingDay, input.dueDay, input.limit],
  );
  return result.lastInsertRowId;
}

/** Mudar os dias vale só para compras novas: as já lançadas ficam nas faturas em que foram gravadas. */
export async function updateCreditCard(id: number, input: CreditCardInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE credit_cards SET name = ?, closing_day = ?, due_day = ?, credit_limit = ? WHERE id = ?",
    [input.name.trim(), input.closingDay, input.dueDay, input.limit, id],
  );
}

/**
 * Apaga o cartão, as compras e os registros de pagamento dele. As despesas que os pagamentos criaram
 * no saldo continuam (o dinheiro saiu de verdade).
 */
export async function deleteCreditCard(id: number): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    db.runSync("DELETE FROM card_purchases WHERE card_id = ?", id);
    db.runSync("DELETE FROM card_invoice_payments WHERE card_id = ?", id);
    db.runSync("DELETE FROM credit_cards WHERE id = ?", id);
  });
}

// ------------------------------------------------------------------ compras

export async function getAllCardPurchases(): Promise<CardPurchaseRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CardPurchaseRow>("SELECT * FROM card_purchases ORDER BY id");
}

/** Grava as linhas de uma compra (uma, ou uma por parcela) de uma vez: ou todas entram ou nenhuma. */
export async function addCardPurchases(rows: NewPurchase[]): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    for (const row of rows) {
      db.runSync(
        "INSERT INTO card_purchases (card_id, description, amount, date, category, invoice_ref, installment_group_id, installment_number, installment_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        row.card_id,
        row.description,
        row.amount,
        row.date,
        row.category,
        row.invoice_ref,
        row.installment_group_id,
        row.installment_number,
        row.installment_total,
      );
    }
  });
}

export interface CardPurchaseUpdate {
  description: string;
  amount: number;
  date: string;
  category: string;
  invoiceRef: string;
}

export async function updateCardPurchase(id: number, data: CardPurchaseUpdate): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE card_purchases SET description = ?, amount = ?, date = ?, category = ?, invoice_ref = ? WHERE id = ?",
    [data.description.trim(), data.amount, data.date, data.category, data.invoiceRef, id],
  );
}

export async function deleteCardPurchase(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM card_purchases WHERE id = ?", [id]);
}

/** Apaga várias compras de uma vez (tudo ou nada). */
export async function deleteCardPurchases(ids: number[]): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    for (const id of ids) db.runSync("DELETE FROM card_purchases WHERE id = ?", id);
  });
}

/** Apaga todas as parcelas de uma compra parcelada. */
export async function deleteCardPurchaseGroup(groupId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM card_purchases WHERE installment_group_id = ?", [groupId]);
}

// --------------------------------------------------------------- pagamentos

export async function getAllCardPayments(): Promise<CardPaymentRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CardPaymentRow>("SELECT * FROM card_invoice_payments ORDER BY id");
}

export interface PayInvoiceInput {
  cardId: number;
  cardName: string;
  ref: string;
  amount: number;
  /** DD/MM/AAAA */
  paidDate: string;
}

/**
 * Paga a fatura: cria a despesa "Cartão de crédito" no saldo e anota o pagamento, juntos (se um
 * falhar, o outro não fica). Recusa pagar a mesma fatura duas vezes.
 */
export async function payInvoice(input: PayInvoiceInput): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    const existing = db.getAllSync<{ id: number }>(
      "SELECT id FROM card_invoice_payments WHERE card_id = ? AND invoice_ref = ?",
      input.cardId,
      input.ref,
    );
    if (existing.length > 0) throw new Error("Essa fatura já está paga.");

    const expense = db.runSync(
      "INSERT INTO transactions (amount, date, description, type, category_id) VALUES (?, ?, ?, 'expense', ?)",
      input.amount,
      input.paidDate,
      `Fatura ${input.cardName} ${formatRef(input.ref)}`,
      CREDIT_CARD_CATEGORY,
    );
    db.runSync(
      "INSERT INTO card_invoice_payments (card_id, invoice_ref, paid_date, amount, transaction_id) VALUES (?, ?, ?, ?, ?)",
      input.cardId,
      input.ref,
      input.paidDate,
      input.amount,
      expense.lastInsertRowId,
    );
  });
}

/** Desfaz o pagamento: a fatura volta a ficar em aberto e a despesa que ele criou sai do saldo. */
export async function undoInvoicePayment(cardId: number, ref: string): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    const [payment] = db.getAllSync<{ id: number; transaction_id: number | null }>(
      "SELECT id, transaction_id FROM card_invoice_payments WHERE card_id = ? AND invoice_ref = ?",
      cardId,
      ref,
    );
    if (!payment) return;
    if (payment.transaction_id !== null) db.runSync("DELETE FROM transactions WHERE id = ?", payment.transaction_id);
    db.runSync("DELETE FROM card_invoice_payments WHERE id = ?", payment.id);
  });
}
