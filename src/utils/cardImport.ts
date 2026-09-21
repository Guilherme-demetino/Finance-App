import type { CardPaymentRow, CardPurchaseRow, CreditCardRow, TransactionRow } from "../types";
import {
  addMonthsToRef,
  CREDIT_CARD_CATEGORY,
  currentInvoiceRef,
  invoiceDates,
  invoiceRefFor,
  listInvoices,
  MAX_INSTALLMENTS,
  purchaseBlockedByPayment,
  type Invoice,
  type NewPurchase,
} from "./creditCards";
import { parseDueDate } from "./dueReminders";
import type { CsvImportPlan, ImportedTransaction } from "./statements/importCsv";
import { normalizeText } from "./statements/statementParsing";

/**
 * Leitura da fatura do cartão (PDF, CSV ou planilha) e a conciliação com o extrato da conta, sem lançar nada duas vezes:
 * - a fatura vira compras no cartão (fora do saldo), e o que já está lançado é ignorado;
 * - o pagamento da fatura que aparece no extrato não vira uma segunda despesa: se o app já registrou o pagamento,
 *   a linha do extrato é descartada; se a fatura ainda estava em aberto, a linha marca a fatura como paga.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
// Quantos dias depois do vencimento o débito do pagamento ainda é reconhecido como dessa fatura.
const PAYMENT_GRACE_DAYS = 20;
// Diferença máxima, em dias, entre o pagamento anotado no app e o débito no extrato.
const PAYMENT_MATCH_DAYS = 7;

const cents = (value: number) => Math.round(value * 100);

function dayNumber(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

// ------------------------------------------------------------------ texto da linha

export interface SplitDescription {
  /** A descrição sem o "(2/5)" do fim. */
  base: string;
  number: number | null;
  total: number | null;
}

// "Notebook (2/5)", "Notebook 2/5", "Notebook - Parcela 2/5", "Notebook PARC 02/05", "Notebook 02 de 05".
const INSTALLMENT_SUFFIX = /[\s\-–:]*(?:\(\s*)?(?:parcela|parc\.?)?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\s*\)?\s*$/i;

/** Separa o número da parcela do fim da descrição. Só vale com 2 ou mais parcelas e o número dentro do total. */
export function splitInstallment(description: string): SplitDescription {
  const text = description.trim();
  const match = INSTALLMENT_SUFFIX.exec(text);
  if (!match) return { base: text, number: null, total: null };
  const number = Number(match[1]);
  const total = Number(match[2]);
  const base = text.slice(0, match.index).trim();
  if (total < 2 || total > MAX_INSTALLMENTS || number < 1 || number > total || base === "") {
    return { base: text, number: null, total: null };
  }
  return { base, number, total };
}

/** Linha de pagamento da fatura anterior ou de crédito, que aparece na própria fatura e não é compra. */
export function isInvoicePaymentLine(description: string): boolean {
  const text = normalizeText(description);
  return /(pagamento|pgto|pag\.?)\s*(de\s*)?(fatura|recebido|efetuado|on-?line|em\s+\d)/.test(text) || /fatura anterior|saldo (anterior|restante)|total (da )?fatura/.test(text);
}

/** Descrição do extrato que parece o pagamento de uma fatura de cartão. */
export function looksLikeCardPayment(description: string): boolean {
  return /(fatura|cartao)/.test(normalizeText(description));
}

// ------------------------------------------------------------------ a fatura vira compras

export interface CardImportPlan {
  /** Fatura (AAAA-MM do vencimento) que recebe as compras. */
  ref: string;
  /** A fatura detectada e as vizinhas, para o usuário trocar se a leitura errou. */
  refOptions: string[];
  /** Compras novas, prontas para gravar. */
  rows: NewPurchase[];
  /** Compras que já estavam lançadas (mesma data, descrição e valor; ou a mesma parcela). */
  duplicates: number;
  /** Créditos, estornos e pagamentos da fatura anterior que a leitura não trata como compra. */
  ignoredCredits: number;
  /** Compras lidas no arquivo (novas + já lançadas). */
  totalRows: number;
  /** Soma das compras novas. */
  total: number;
  /** Motivo de não poder importar nessa fatura (ex.: já paga); null se pode. */
  blocked: string | null;
  /** Débito no extrato que já paga essa fatura, se houver um só que combine. */
  paymentMatch: PaymentMatch | null;
}

export interface PaymentMatch {
  transactionId: number;
  date: string;
  amount: number;
}

function purchaseKey(card: { number: number | null; total: number | null }, base: string, amount: number, date: string): string {
  const name = normalizeText(base);
  return card.number !== null ? `i|${name}|${card.number}|${card.total}|${cents(amount)}` : `p|${date}|${name}|${cents(amount)}`;
}

function existingKey(purchase: CardPurchaseRow): string {
  if (purchase.installment_number !== null && purchase.installment_total !== null) {
    return purchaseKey({ number: purchase.installment_number, total: purchase.installment_total }, purchase.description, purchase.amount, purchase.date);
  }
  // Compra lançada à mão com "(2/5)" escrito na descrição: conta como a parcela.
  const split = splitInstallment(purchase.description);
  return purchaseKey(split, split.base, purchase.amount, purchase.date);
}

/** A fatura em que a maioria das compras avulsas (com a data da compra) cai; sem elas, a fatura atual. */
export function detectInvoiceRef(candidates: { date: string; installment: boolean }[], card: CreditCardRow, today: Date): string {
  const votes = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.installment) continue;
    const date = parseDueDate(candidate.date);
    if (!date) continue;
    const ref = invoiceRefFor(date, card);
    votes.set(ref, (votes.get(ref) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [ref, count] of votes) {
    // Empate: a fatura mais nova.
    if (best === null || count > (votes.get(best) ?? 0) || (count === (votes.get(best) ?? 0) && ref > best)) best = ref;
  }
  return best ?? currentInvoiceRef(card, today);
}

function groupIdFor(cardId: number, base: string, amount: number, total: number): string {
  const slug = normalizeText(base).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
  return `imp-${cardId}-${slug}-${cents(amount)}-${total}`;
}

/** Um débito do extrato que paga a fatura: mesmo valor, depois do fechamento e antes de muito depois do vencimento. */
function findPaymentTransaction(input: {
  card: CreditCardRow;
  ref: string;
  total: number;
  transactions: TransactionRow[];
  payments: CardPaymentRow[];
}): PaymentMatch | null {
  const { card, ref, total } = input;
  if (!(total > 0)) return null;
  const dates = invoiceDates(ref, card);
  const from = dayNumber(dates.closing);
  const to = dayNumber(dates.due) + PAYMENT_GRACE_DAYS;
  const taken = new Set(input.payments.map((payment) => payment.transaction_id).filter((id): id is number => id !== null));

  const matches = input.transactions.filter((transaction) => {
    if (transaction.type !== "expense" || taken.has(transaction.id)) return false;
    if (cents(Number(transaction.amount)) !== cents(total)) return false;
    if (!looksLikeCardPayment(transaction.description ?? "")) return false;
    const date = parseDueDate(transaction.date);
    if (!date) return false;
    const day = dayNumber(date);
    return day >= from && day <= to;
  });
  if (matches.length !== 1) return null;
  const [found] = matches;
  return { transactionId: found.id, date: found.date, amount: Number(found.amount) };
}

/**
 * Monta a importação da fatura de um cartão a partir do que a leitura do arquivo achou (as mesmas linhas de qualquer
 * extrato). Compras entram na fatura escolhida (a detectada, por padrão): todas as linhas da fatura pertencem a ela,
 * mesmo as parcelas, que trazem a data da compra original.
 */
export function planCardImport(input: {
  candidates: ImportedTransaction[];
  card: CreditCardRow;
  purchases: CardPurchaseRow[];
  payments: CardPaymentRow[];
  /** Transações já no app, para reconhecer um pagamento da fatura que já entrou pelo extrato. */
  transactions: TransactionRow[];
  today: Date;
  /** Fatura escolhida pelo usuário; sem ela, a detectada. */
  ref?: string;
}): CardImportPlan {
  const { card, today } = input;
  let ignoredCredits = 0;

  const lines = input.candidates.flatMap((candidate) => {
    if (candidate.type !== "expense" || isInvoicePaymentLine(candidate.description)) {
      ignoredCredits++;
      return [];
    }
    if (!parseDueDate(candidate.date) || !(candidate.amount > 0)) return [];
    const split = splitInstallment(candidate.description);
    return [{ candidate, split }];
  });

  const detected = detectInvoiceRef(
    lines.map((line) => ({ date: line.candidate.date, installment: line.split.number !== null })),
    card,
    today,
  );
  const ref = input.ref ?? detected;
  const refOptions = [addMonthsToRef(detected, -1), detected, addMonthsToRef(detected, 1)];

  const remaining = new Map<string, number>();
  for (const purchase of input.purchases) {
    if (purchase.card_id !== card.id) continue;
    const key = existingKey(purchase);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }

  const rows: NewPurchase[] = [];
  let duplicates = 0;
  for (const { candidate, split } of lines) {
    const key = purchaseKey(split, split.base, candidate.amount, candidate.date);
    const available = remaining.get(key) ?? 0;
    if (available > 0) {
      remaining.set(key, available - 1);
      duplicates++;
      continue;
    }
    rows.push({
      card_id: card.id,
      description: split.base.slice(0, 80),
      amount: candidate.amount,
      date: candidate.date,
      category: candidate.category,
      invoice_ref: ref,
      installment_group_id: split.number !== null ? groupIdFor(card.id, split.base, candidate.amount, split.total as number) : null,
      installment_number: split.number,
      installment_total: split.total,
    });
  }

  const total = Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
  const blocked = rows.length > 0 ? purchaseBlockedByPayment([ref], input.payments, card.id) : null;

  // Total da fatura depois de importar: o que já estava nela mais o novo.
  const alreadyThere = input.purchases.filter((purchase) => purchase.card_id === card.id && purchase.invoice_ref === ref).reduce((sum, purchase) => sum + purchase.amount, 0);
  const invoiceTotal = Math.round((alreadyThere + total) * 100) / 100;
  const paidAlready = input.payments.some((payment) => payment.card_id === card.id && payment.invoice_ref === ref);
  const paymentMatch = paidAlready
    ? null
    : findPaymentTransaction({ card, ref, total: invoiceTotal, transactions: input.transactions, payments: input.payments });

  return {
    ref,
    refOptions,
    rows,
    duplicates,
    ignoredCredits,
    totalRows: rows.length + duplicates,
    total,
    blocked,
    paymentMatch,
  };
}

// ------------------------------------------------------------------ o extrato não duplica o pagamento

export interface CardPaymentContext {
  cards: CreditCardRow[];
  purchases: CardPurchaseRow[];
  payments: CardPaymentRow[];
  /** Transações já no app. */
  transactions: TransactionRow[];
  today: Date;
}

/**
 * Ajusta a importação de um extrato de conta para o pagamento da fatura não entrar duas vezes:
 * - a linha que repete um pagamento que o app já registrou (mesmo valor, datas próximas) é descartada como duplicada;
 * - a linha que paga uma fatura ainda em aberto (mesmo valor do total) entra como despesa "Cartão de crédito" e marca
 *   a fatura como paga. Só quando a fatura é a única que combina; na dúvida entra como uma despesa comum.
 */
export function reconcileCardPayments(plan: CsvImportPlan, context: CardPaymentContext): CsvImportPlan {
  const existingIds = new Set(context.transactions.map((transaction) => transaction.id));
  const registered = context.payments.filter((payment) => payment.transaction_id !== null && existingIds.has(payment.transaction_id));
  const usedPayments = new Set<number>();

  const invoices: { card: CreditCardRow; invoice: Invoice }[] = context.cards.flatMap((card) =>
    listInvoices({ card, purchases: context.purchases, payments: context.payments, today: context.today })
      .filter((invoice) => invoice.status === "closed" || invoice.status === "overdue")
      .map((invoice) => ({ card, invoice })),
  );
  const claimed = new Set<string>();

  let duplicates = plan.duplicates;
  let linked = 0;
  const toImport: ImportedTransaction[] = [];

  for (const candidate of plan.toImport) {
    if (candidate.type !== "expense" || !looksLikeCardPayment(candidate.description)) {
      toImport.push(candidate);
      continue;
    }
    const date = parseDueDate(candidate.date);
    if (!date) {
      toImport.push(candidate);
      continue;
    }
    const day = dayNumber(date);

    const already = registered.find((payment) => {
      if (usedPayments.has(payment.id) || cents(payment.amount) !== cents(candidate.amount)) return false;
      const paidOn = parseDueDate(payment.paid_date);
      return paidOn !== null && Math.abs(dayNumber(paidOn) - day) <= PAYMENT_MATCH_DAYS;
    });
    if (already) {
      usedPayments.add(already.id);
      duplicates++;
      continue;
    }

    const matches = invoices.filter(({ card, invoice }) => {
      if (claimed.has(`${card.id}-${invoice.ref}`) || cents(invoice.total) !== cents(candidate.amount)) return false;
      const dates = invoiceDates(invoice.ref, card);
      return day >= dayNumber(dates.closing) && day <= dayNumber(dates.due) + PAYMENT_GRACE_DAYS;
    });
    if (matches.length === 1) {
      const [{ card, invoice }] = matches;
      claimed.add(`${card.id}-${invoice.ref}`);
      linked++;
      toImport.push({ ...candidate, category: CREDIT_CARD_CATEGORY, cardPayment: { cardId: card.id, ref: invoice.ref } });
      continue;
    }
    toImport.push(candidate);
  }

  return { ...plan, toImport, duplicates, cardPaymentsLinked: linked };
}
