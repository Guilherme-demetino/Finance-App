import type { CardPaymentRow, CardPurchaseRow, CreditCardRow } from "../types";
import { purchaseExpenseDate, purchaseExpenseDescription, type NewPurchase } from "../utils/creditCards";
import { getDatabase } from "./sqlite";

type Db = Awaited<ReturnType<typeof getDatabase>>;

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

// ------------------------------------------------------------------ compras (cada uma vira uma despesa)

function findCard(db: Db, cardId: number): CreditCardRow {
  const [card] = db.getAllSync<CreditCardRow>("SELECT * FROM credit_cards WHERE id = ?", cardId);
  if (!card) throw new Error("Cartão não encontrado.");
  return card;
}

/** Grava a compra e, se for um gasto (valor positivo), a despesa dela nas despesas do app. Créditos não geram despesa. */
function insertPurchase(db: Db, row: NewPurchase, card: CreditCardRow): void {
  let transactionId: number | null = null;
  if (row.amount > 0) {
    const expense = db.runSync(
      "INSERT INTO transactions (amount, date, description, type, category_id) VALUES (?, ?, ?, 'expense', ?)",
      row.amount,
      purchaseExpenseDate(row, card),
      purchaseExpenseDescription(row),
      row.category,
    );
    transactionId = expense.lastInsertRowId;
  }
  db.runSync(
    "INSERT INTO card_purchases (card_id, description, amount, date, category, invoice_ref, installment_group_id, installment_number, installment_total, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    row.card_id,
    row.description,
    row.amount,
    row.date,
    row.category,
    row.invoice_ref,
    row.installment_group_id,
    row.installment_number,
    row.installment_total,
    transactionId,
  );
}

/** Apaga as compras e as despesas que elas geraram. */
function deletePurchases(db: Db, where: string, ...params: (string | number)[]): void {
  db.runSync(`DELETE FROM transactions WHERE id IN (SELECT transaction_id FROM card_purchases WHERE transaction_id IS NOT NULL AND ${where})`, ...params);
  db.runSync(`DELETE FROM card_purchases WHERE ${where}`, ...params);
}

/**
 * Apaga o cartão, as compras (e as despesas delas) e os registros de pagamento. Quem já tinha pago uma fatura antes de
 * as compras virarem despesas ainda pode ter a despesa do pagamento: ela é tratada por reconcileCardTransactions.
 */
export async function deleteCreditCard(id: number): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    deletePurchases(db, "card_id = ?", id);
    db.runSync("DELETE FROM card_invoice_payments WHERE card_id = ?", id);
    db.runSync("DELETE FROM credit_cards WHERE id = ?", id);
  });
}

export async function getAllCardPurchases(): Promise<CardPurchaseRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CardPurchaseRow>("SELECT * FROM card_purchases ORDER BY id");
}

/** Grava as linhas de uma compra (uma, ou uma por parcela) e as despesas delas de uma vez: ou tudo entra ou nada. */
export async function addCardPurchases(rows: NewPurchase[]): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    const cards = new Map<number, CreditCardRow>();
    for (const row of rows) {
      let card = cards.get(row.card_id);
      if (!card) {
        card = findCard(db, row.card_id);
        cards.set(row.card_id, card);
      }
      insertPurchase(db, row, card);
    }
  });
}

/** Grava as compras lidas de uma fatura, tudo ou nada. */
export async function importCardPurchases(rows: NewPurchase[]): Promise<void> {
  await addCardPurchases(rows);
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
  db.withTransactionSync(() => {
    const [current] = db.getAllSync<CardPurchaseRow>("SELECT * FROM card_purchases WHERE id = ?", id);
    if (!current) return;
    const description = data.description.trim();
    db.runSync(
      "UPDATE card_purchases SET description = ?, amount = ?, date = ?, category = ?, invoice_ref = ? WHERE id = ?",
      description,
      data.amount,
      data.date,
      data.category,
      data.invoiceRef,
      id,
    );
    if (current.transaction_id !== null) {
      const card = findCard(db, current.card_id);
      const next = { ...current, description, date: data.date, invoice_ref: data.invoiceRef };
      db.runSync(
        "UPDATE transactions SET amount = ?, date = ?, description = ?, category_id = ? WHERE id = ?",
        data.amount,
        purchaseExpenseDate(next, card),
        purchaseExpenseDescription(next),
        data.category,
        current.transaction_id,
      );
    }
  });
}

export async function deleteCardPurchase(id: number): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => deletePurchases(db, "id = ?", id));
}

/** Apaga várias compras (e as despesas delas) de uma vez (tudo ou nada). */
export async function deleteCardPurchases(ids: number[]): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    for (const id of ids) deletePurchases(db, "id = ?", id);
  });
}

/** Apaga todas as parcelas de uma compra parcelada (e as despesas delas). */
export async function deleteCardPurchaseGroup(groupId: string): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => deletePurchases(db, "installment_group_id = ?", groupId));
}

// --------------------------------------------------------------- pagamentos

export async function getAllCardPayments(): Promise<CardPaymentRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CardPaymentRow>("SELECT * FROM card_invoice_payments ORDER BY id");
}

export interface PayInvoiceInput {
  cardId: number;
  ref: string;
  /** O valor pago (o total a pagar da fatura). */
  amount: number;
  /** DD/MM/AAAA: o dia em que a fatura foi paga. */
  paidDate: string;
}

/**
 * Marca a fatura como paga. Não cria despesa: o gasto dela já entrou nas despesas, compra por compra, na data de cada
 * uma (criar outra despesa contaria o mesmo dinheiro duas vezes). Recusa pagar a mesma fatura duas vezes.
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
    db.runSync(
      "INSERT INTO card_invoice_payments (card_id, invoice_ref, paid_date, amount, transaction_id) VALUES (?, ?, ?, ?, NULL)",
      input.cardId,
      input.ref,
      input.paidDate,
      input.amount,
    );
  });
}

/** Desfaz o pagamento: a fatura volta a ficar em aberto. As despesas das compras não mudam. */
export async function undoInvoicePayment(cardId: number, ref: string): Promise<void> {
  const db = await getDatabase();
  db.runSync("DELETE FROM card_invoice_payments WHERE card_id = ? AND invoice_ref = ?", cardId, ref);
}

// ------------------------------------------------------------------ conciliação com as despesas

/**
 * Deixa as despesas coerentes com as compras do cartão (roda ao abrir o painel e depois de restaurar um backup; não
 * faz nada quando já está tudo certo). Devolve quantas linhas mudaram.
 * - Pagamentos de fatura de uma versão anterior tinham uma despesa própria: ela é apagada, porque agora cada compra já
 *   é uma despesa (manter as duas contaria o gasto em dobro).
 * - Compras sem despesa (lançadas antes desta regra, ou vindas de um backup antigo) ganham a sua.
 * - Compras cuja despesa foi apagada no Histórico saem do cartão.
 */
export async function reconcileCardTransactions(): Promise<number> {
  const db = await getDatabase();
  let changed = 0;
  db.withTransactionSync(() => {
    const legacy = db.getAllSync<{ id: number; transaction_id: number }>(
      "SELECT id, transaction_id FROM card_invoice_payments WHERE transaction_id IS NOT NULL",
    );
    for (const payment of legacy) {
      db.runSync("DELETE FROM transactions WHERE id = ?", payment.transaction_id);
      db.runSync("UPDATE card_invoice_payments SET transaction_id = NULL WHERE id = ?", payment.id);
      changed++;
    }

    const orphans = db.runSync(
      "DELETE FROM card_purchases WHERE transaction_id IS NOT NULL AND transaction_id NOT IN (SELECT id FROM transactions)",
    );
    changed += orphans.changes;

    const missing = db.getAllSync<CardPurchaseRow>("SELECT * FROM card_purchases WHERE transaction_id IS NULL AND amount > 0 ORDER BY id");
    const cards = new Map<number, CreditCardRow>();
    for (const purchase of missing) {
      let card = cards.get(purchase.card_id);
      if (!card) {
        const [found] = db.getAllSync<CreditCardRow>("SELECT * FROM credit_cards WHERE id = ?", purchase.card_id);
        if (!found) continue;
        card = found;
        cards.set(purchase.card_id, card);
      }
      const expense = db.runSync(
        "INSERT INTO transactions (amount, date, description, type, category_id) VALUES (?, ?, ?, 'expense', ?)",
        purchase.amount,
        purchaseExpenseDate(purchase, card),
        purchaseExpenseDescription(purchase),
        purchase.category,
      );
      db.runSync("UPDATE card_purchases SET transaction_id = ? WHERE id = ?", expense.lastInsertRowId, purchase.id);
      changed++;
    }
  });
  return changed;
}
