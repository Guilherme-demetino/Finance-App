import type { CardPaymentRow, CardPurchaseRow, CreditCardRow } from "../types";
import { splitAmountIntoInstallments } from "./currency";
import { addMonthsToDateString, formatDateToString } from "./dates";
import { parseDueDate } from "./dueReminders";

/**
 * Faturas de cartão de crédito. Regras:
 * - Cada cartão tem um dia de FECHAMENTO e um de VENCIMENTO. Compra até o dia de fechamento
 *   (inclusive) cai na fatura que fecha naquele mês; depois, na do mês seguinte.
 * - A fatura vence no mês do fechamento se o dia de vencimento é maior que o de fechamento;
 *   senão, no mês seguinte. Em mês curto, dia 31 vale o último dia do mês.
 * - Uma fatura é identificada por AAAA-MM do mês de VENCIMENTO (como os bancos costumam chamar).
 * - Cada compra vira uma despesa do app na data da compra (o "gasto real" cai no mês em que aconteceu). Pagar a fatura
 *   só a liquida: não cria outra despesa, senão o mesmo gasto seria contado duas vezes (ver database/creditCards).
 * - Créditos da fatura (pagamento recebido antecipado, estorno) são lançamentos de valor negativo: reduzem o total a
 *   pagar da fatura, mas não são receita nem entram no gasto.
 */

/** Categoria dos créditos da fatura (pagamento recebido, estorno): valor negativo, fora do gasto e da receita. */
export const CARD_CREDIT_CATEGORY = "Crédito na fatura";
export const MAX_INSTALLMENTS = 48;

export type CardDays = Pick<CreditCardRow, "closing_day" | "due_day">;

const pad = (value: number) => String(value).padStart(2, "0");
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const daysInMonth = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();
/** O dia pedido, ou o último do mês se ele não existe (31 em fevereiro). */
const dayIn = (year: number, monthIndex: number, day: number) => new Date(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex)));

// -------------------------------------------------------------------- a referência AAAA-MM

export function refOf(year: number, monthIndex: number): string {
  const normalized = new Date(year, monthIndex, 1);
  return `${normalized.getFullYear()}-${pad(normalized.getMonth() + 1)}`;
}

export function parseRef(ref: string): { year: number; monthIndex: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(ref);
  if (!match) return null;
  const monthIndex = Number(match[2]) - 1;
  return monthIndex >= 0 && monthIndex <= 11 ? { year: Number(match[1]), monthIndex } : null;
}

export function addMonthsToRef(ref: string, months: number): string {
  const parsed = parseRef(ref);
  if (!parsed) throw new Error(`Fatura inválida: ${ref}`);
  return refOf(parsed.year, parsed.monthIndex + months);
}

const MONTH_ABBREVIATIONS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** "2026-10" → "OUT/2026". */
export function formatRef(ref: string): string {
  const parsed = parseRef(ref);
  return parsed ? `${MONTH_ABBREVIATIONS[parsed.monthIndex]}/${parsed.year}` : ref;
}

// -------------------------------------------------------------------- datas da fatura

/** Em que fatura (vencimento AAAA-MM) cai uma compra feita em `purchaseDate`. */
export function invoiceRefFor(purchaseDate: Date, card: CardDays): string {
  const year = purchaseDate.getFullYear();
  const month = purchaseDate.getMonth();
  const closesThisMonth = purchaseDate.getDate() <= dayIn(year, month, card.closing_day).getDate();
  const closingMonth = closesThisMonth ? month : month + 1;
  const dueMonth = card.due_day > card.closing_day ? closingMonth : closingMonth + 1;
  return refOf(year, dueMonth);
}

export interface InvoiceDates {
  /** Primeiro dia que entra na fatura (o dia depois do fechamento anterior). */
  periodStart: Date;
  closing: Date;
  due: Date;
}

/** Datas de uma fatura (identificada pelo mês de vencimento) de um cartão. */
export function invoiceDates(ref: string, card: CardDays): InvoiceDates {
  const parsed = parseRef(ref);
  if (!parsed) throw new Error(`Fatura inválida: ${ref}`);
  const { year, monthIndex } = parsed;

  const due = dayIn(year, monthIndex, card.due_day);
  const closingMonth = new Date(year, card.due_day > card.closing_day ? monthIndex : monthIndex - 1, 1);
  const closing = dayIn(closingMonth.getFullYear(), closingMonth.getMonth(), card.closing_day);
  const previousMonth = new Date(closingMonth.getFullYear(), closingMonth.getMonth() - 1, 1);
  const previousClosing = dayIn(previousMonth.getFullYear(), previousMonth.getMonth(), card.closing_day);
  const periodStart = new Date(previousClosing.getFullYear(), previousClosing.getMonth(), previousClosing.getDate() + 1);

  return { periodStart, closing, due };
}

/**
 * "open": ainda recebe compras (até o dia do fechamento, inclusive). "closed": fechou e ainda não
 * venceu. "overdue": venceu sem pagar. "paid": paga. "empty": sem lançamentos (nada a pagar). "settled": tem lançamentos,
 * mas os créditos (pagamento recebido, estorno) já cobriram tudo (nada a pagar).
 */
export type InvoiceStatus = "open" | "closed" | "overdue" | "paid" | "empty" | "settled";

export function invoiceStatus(input: { dates: InvoiceDates; total: number; paid: boolean; today: Date; hasEntries?: boolean }): InvoiceStatus {
  if (input.paid) return "paid";
  if (input.total <= 0) return input.hasEntries ? "settled" : "empty";
  const today = startOfDay(input.today);
  if (today <= input.dates.closing) return "open";
  return today <= input.dates.due ? "closed" : "overdue";
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  open: "Aberta",
  closed: "Fechada",
  overdue: "Vencida",
  paid: "Paga",
  empty: "Sem compras",
  settled: "Quitada",
};

// -------------------------------------------------------------------- montando as faturas

export interface Invoice {
  cardId: number;
  ref: string;
  label: string;
  /** DD/MM/AAAA */
  periodStart: string;
  closingDate: string;
  dueDate: string;
  /** A pagar: as compras menos os créditos (pagamento recebido, estorno). */
  total: number;
  /** Gasto do período: só as compras. */
  spend: number;
  /** Créditos da fatura, em valor positivo. */
  credits: number;
  status: InvoiceStatus;
  purchases: CardPurchaseRow[];
  /** Total por categoria, da maior para a menor. */
  byCategory: { category: string; total: number }[];
  payment: CardPaymentRow | null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Uma fatura (mesmo vazia): as compras dela, o total, o estado e o pagamento. */
export function buildInvoice(input: {
  card: CreditCardRow;
  ref: string;
  purchases: CardPurchaseRow[];
  payments: CardPaymentRow[];
  today: Date;
}): Invoice {
  const { card, ref, today } = input;
  const dates = invoiceDates(ref, card);
  const purchases = input.purchases
    .filter((purchase) => purchase.card_id === card.id && purchase.invoice_ref === ref)
    .sort((a, b) => {
      const byDate = (parseDueDate(a.date)?.getTime() ?? 0) - (parseDueDate(b.date)?.getTime() ?? 0);
      return byDate !== 0 ? byDate : a.id - b.id;
    });
  const payment = input.payments.find((item) => item.card_id === card.id && item.invoice_ref === ref) ?? null;
  const total = round2(purchases.reduce((sum, purchase) => sum + purchase.amount, 0));
  const spend = round2(purchases.filter((purchase) => purchase.amount > 0).reduce((sum, purchase) => sum + purchase.amount, 0));
  const credits = round2(-purchases.filter((purchase) => purchase.amount < 0).reduce((sum, purchase) => sum + purchase.amount, 0));

  const perCategory = new Map<string, number>();
  // O total por categoria é do gasto: os créditos descontam do total a pagar, não de uma categoria.
  for (const purchase of purchases) {
    if (purchase.amount > 0) perCategory.set(purchase.category, (perCategory.get(purchase.category) ?? 0) + purchase.amount);
  }

  return {
    cardId: card.id,
    ref,
    label: formatRef(ref),
    periodStart: formatDateToString(dates.periodStart),
    closingDate: formatDateToString(dates.closing),
    dueDate: formatDateToString(dates.due),
    total,
    spend,
    credits,
    status: invoiceStatus({ dates, total, paid: payment !== null, today, hasEntries: purchases.length > 0 }),
    purchases,
    byCategory: [...perCategory.entries()].map(([category, value]) => ({ category, total: round2(value) })).sort((a, b) => b.total - a.total),
    payment,
  };
}

/** A fatura que recebe as compras de hoje. */
export const currentInvoiceRef = (card: CardDays, today: Date = new Date()): string => invoiceRefFor(today, card);

/** As faturas do cartão que têm compra ou pagamento, mais a atual, da mais antiga para a mais nova. */
export function listInvoices(input: {
  card: CreditCardRow;
  purchases: CardPurchaseRow[];
  payments: CardPaymentRow[];
  today: Date;
}): Invoice[] {
  const { card, today } = input;
  const refs = new Set<string>([currentInvoiceRef(card, today)]);
  for (const purchase of input.purchases) if (purchase.card_id === card.id) refs.add(purchase.invoice_ref);
  for (const payment of input.payments) if (payment.card_id === card.id) refs.add(payment.invoice_ref);
  return [...refs].sort().map((ref) => buildInvoice({ ...input, ref }));
}

// -------------------------------------------------------------------- limite

export interface CardUsage {
  /** Tudo o que ainda não foi pago, inclusive as parcelas das próximas faturas. */
  used: number;
  /** Limite menos o usado (pode ficar negativo); null se o cartão não tem limite definido. */
  available: number | null;
  /** Usado em relação ao limite, de 0 a 1; null sem limite. */
  ratio: number | null;
}

export function cardUsage(card: CreditCardRow, purchases: CardPurchaseRow[], payments: CardPaymentRow[]): CardUsage {
  const paidRefs = new Set(payments.filter((payment) => payment.card_id === card.id).map((payment) => payment.invoice_ref));
  const used = round2(
    purchases
      .filter((purchase) => purchase.card_id === card.id && !paidRefs.has(purchase.invoice_ref))
      .reduce((sum, purchase) => sum + purchase.amount, 0),
  );
  const limit = card.credit_limit;
  if (limit === null || !(limit > 0)) return { used, available: null, ratio: null };
  return { used, available: round2(limit - used), ratio: Math.min(1, used / limit) };
}

// -------------------------------------------------------------------- compra (com parcelas)

export type NewPurchase = Omit<CardPurchaseRow, "id" | "transaction_id">;

/** Descrição da despesa: a da compra, com o número da parcela quando é parcelada ("Notebook (2/5)"). */
export function purchaseExpenseDescription(purchase: {
  description: string;
  installment_number: number | null;
  installment_total: number | null;
}): string {
  const numbered = purchase.installment_number !== null && purchase.installment_total !== null;
  const alreadyNumbered = /\(\d+\/\d+\)\s*$/.test(purchase.description);
  return numbered && !alreadyNumbered ? `${purchase.description} (${purchase.installment_number}/${purchase.installment_total})` : purchase.description;
}

/**
 * As linhas de uma compra: uma só, ou uma por parcela, cada uma numa fatura (a primeira na que
 * a data da compra manda, as outras nos meses seguintes). O valor total é dividido em centavos
 * exatos (a diferença vai na última parcela). Cada parcela tem a data em que é cobrada: a da compra mais um mês por parcela.
 */
export function planPurchase(input: {
  card: CreditCardRow;
  description: string;
  totalAmount: number;
  date: Date;
  category: string;
  installments: number;
  groupId: string;
}): NewPurchase[] {
  const count = Math.max(1, Math.floor(input.installments));
  const amounts = splitAmountIntoInstallments(input.totalAmount, count);
  const firstRef = invoiceRefFor(input.date, input.card);

  return amounts.map((amount, index) => ({
    card_id: input.card.id,
    description: input.description.trim(),
    amount,
    // Cada parcela leva a data em que é cobrada (mês a mês), como nas faturas dos bancos: é a data da despesa dela.
    date: addMonthsToDateString(formatDateToString(input.date), index),
    category: input.category,
    invoice_ref: addMonthsToRef(firstRef, index),
    installment_group_id: count > 1 ? input.groupId : null,
    installment_number: count > 1 ? index + 1 : null,
    installment_total: count > 1 ? count : null,
  }));
}

/** Mensagem se alguma parte da compra cairia numa fatura já paga (que não pode mudar); null se pode lançar. */
export function purchaseBlockedByPayment(refs: string[], payments: CardPaymentRow[], cardId: number): string | null {
  const paid = new Set(payments.filter((payment) => payment.card_id === cardId).map((payment) => payment.invoice_ref));
  const blocked = refs.find((ref) => paid.has(ref));
  return blocked
    ? `A fatura de ${formatRef(blocked)} já está paga e não recebe mais compras. Escolha outra data ou desfaça o pagamento dela.`
    : null;
}

// -------------------------------------------------------------------- validação

export function validateCard(input: { name: string; closingDay: number; dueDay: number; limit: number | null }): string | null {
  if (input.name.trim() === "") return "Dê um nome ao cartão.";
  const validDay = (day: number) => Number.isInteger(day) && day >= 1 && day <= 31;
  if (!validDay(input.closingDay)) return "O dia de fechamento precisa estar entre 1 e 31.";
  if (!validDay(input.dueDay)) return "O dia de vencimento precisa estar entre 1 e 31.";
  if (input.limit !== null && !(input.limit > 0)) return "O limite precisa ser maior que zero (ou deixe em branco).";
  return null;
}

export function validatePurchase(input: { description: string; amount: number | null; installments: number }): string | null {
  if (input.description.trim() === "") return "Descreva a compra.";
  if (input.amount === null || !(input.amount > 0)) return "Digite o valor da compra.";
  if (!Number.isInteger(input.installments) || input.installments < 1 || input.installments > MAX_INSTALLMENTS) {
    return `O número de parcelas vai de 1 a ${MAX_INSTALLMENTS}.`;
  }
  // Uma parcela precisa de pelo menos 1 centavo.
  if (Math.round(input.amount * 100) < input.installments) return "O valor é pequeno demais para tantas parcelas.";
  return null;
}

// -------------------------------------------------------------------- vencimentos (avisos e lembretes)

export interface InvoiceDue {
  id: string;
  cardId: number;
  cardName: string;
  ref: string;
  amount: number;
  /** DD/MM/AAAA */
  dueDate: string;
  status: InvoiceStatus;
}

/** Faturas com valor a pagar, da que vence primeiro para a que vence depois (as vencidas vêm antes). */
export function unpaidInvoiceDues(input: {
  cards: CreditCardRow[];
  purchases: CardPurchaseRow[];
  payments: CardPaymentRow[];
  today: Date;
}): InvoiceDue[] {
  const dues: InvoiceDue[] = [];
  for (const card of input.cards) {
    for (const invoice of listInvoices({ card, purchases: input.purchases, payments: input.payments, today: input.today })) {
      if (invoice.status === "paid" || invoice.status === "empty" || invoice.status === "settled") continue;
      dues.push({
        id: `invoice-${card.id}-${invoice.ref}`,
        cardId: card.id,
        cardName: card.name,
        ref: invoice.ref,
        amount: invoice.total,
        dueDate: invoice.dueDate,
        status: invoice.status,
      });
    }
  }
  return dues.sort((a, b) => (parseDueDate(a.dueDate)?.getTime() ?? 0) - (parseDueDate(b.dueDate)?.getTime() ?? 0));
}
