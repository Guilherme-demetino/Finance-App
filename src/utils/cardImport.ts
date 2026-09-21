import type { CardPaymentRow, CardPurchaseRow, CreditCardRow } from "../types";
import {
  addMonthsToRef,
  CARD_CREDIT_CATEGORY,
  currentInvoiceRef,
  invoiceRefFor,
  MAX_INSTALLMENTS,
  purchaseBlockedByPayment,
  type NewPurchase,
} from "./creditCards";
import { parseDueDate } from "./dueReminders";
import type { CsvImportPlan, ImportedTransaction } from "./statements/importCsv";
import { normalizeText } from "./statements/statementParsing";

/**
 * Leitura da fatura do cartão (PDF, CSV ou planilha), sem lançar nada duas vezes:
 * - cada compra da fatura vira uma compra no cartão e uma despesa na data da compra; o que já está lançado é ignorado;
 * - pagamento recebido (antecipado) e estorno da fatura viram créditos (valor negativo): reduzem o total a pagar, sem
 *   contar como receita nem como gasto;
 * - o pagamento da fatura que aparece no extrato da conta NÃO vira despesa: o gasto já foi contado nas compras (ver
 *   ignoreCardPayments).
 */

const cents = (value: number) => Math.round(value * 100);

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

const PAYMENT_LINE = /(pagamento|pgto|pag\.?)\s*(de\s*)?(fatura|recebido|efetuado|on-?line|em\s+\d)/;
const BALANCE_LINE = /fatura anterior|saldo (anterior|restante)|total (da )?fatura/;

/** Saldo ou total da fatura anterior: aparece na própria fatura, mas não é compra nem crédito e não é lançado. */
export function isBalanceLine(description: string): boolean {
  return BALANCE_LINE.test(normalizeText(description));
}

/** Pagamento recebido na fatura (feito antes do fechamento): entra como crédito e reduz o total a pagar. */
export function isReceivedPayment(description: string): boolean {
  const text = normalizeText(description);
  return PAYMENT_LINE.test(text) && !BALANCE_LINE.test(text);
}

// Contas de consumo também têm "fatura" ("pagamento de fatura de energia"): essas são despesas de verdade.
const UTILITY_WORDS = /(energia|luz|agua|esgoto|gas|telefone|internet|celular|condominio|seguro|escola|plano de saude|debito)/;

/** Descrição do extrato que parece o pagamento da fatura de um cartão de crédito. */
export function isCardInvoicePayment(description: string): boolean {
  const text = normalizeText(description);
  if (UTILITY_WORDS.test(text)) return false;
  return (
    /\b(pagamento|pagto|pgto|pag)\b\.?\s*(de\s+|da\s+|do\s+)?(fatura|cartao)\b/.test(text) ||
    /\bfatura\s+(do\s+)?(cartao|nubank|inter|itau|santander|bradesco|c6|xp|picpay|mercado\s*pago|neon|next|original|caixa|banco\s+do\s+brasil|bb|will|pan)\b/.test(text)
  );
}

// ------------------------------------------------------------------ a fatura vira compras

export interface CardImportPlan {
  /** Fatura (AAAA-MM do vencimento) que recebe as compras. */
  ref: string;
  /** A fatura detectada e as vizinhas, para o usuário trocar se a leitura errou. */
  refOptions: string[];
  /** Lançamentos novos, prontos para gravar: compras e créditos (estes com valor negativo). */
  rows: NewPurchase[];
  /** Quantas compras e quanto somam entre os lançamentos novos. */
  purchasesCount: number;
  purchasesTotal: number;
  /** Quantos créditos (pagamento recebido, estorno) e quanto somam (positivo): reduzem o total a pagar. */
  creditsCount: number;
  creditsTotal: number;
  /** Compras que já estavam lançadas (mesma data, descrição e valor; ou a mesma parcela). */
  duplicates: number;
  /** Saldos da fatura anterior, que a leitura não lança. */
  ignoredCredits: number;
  /** Lançamentos lidos no arquivo (novos + já lançados). */
  totalRows: number;
  /** Compras novas menos os créditos novos: quanto os lançamentos novos mudam o total a pagar. */
  total: number;
  /** Motivo de não poder importar nessa fatura (ex.: já paga); null se pode. */
  blocked: string | null;
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
  today: Date;
  /** Fatura escolhida pelo usuário; sem ela, a detectada. */
  ref?: string;
}): CardImportPlan {
  const { card, today } = input;
  let ignoredCredits = 0;

  const lines = input.candidates.flatMap((candidate) => {
    if (isBalanceLine(candidate.description)) {
      ignoredCredits++;
      return [];
    }
    if (!parseDueDate(candidate.date) || !(candidate.amount > 0)) return [];
    // Pagamento recebido (antecipado), estorno e reembolso: crédito que reduz o total a pagar (valor negativo).
    const credit = isReceivedPayment(candidate.description) || candidate.type !== "expense";
    const split = credit ? { base: candidate.description.trim(), number: null, total: null } : splitInstallment(candidate.description);
    return [{ candidate, split, credit }];
  });

  const detected = detectInvoiceRef(
    lines.filter((line) => !line.credit).map((line) => ({ date: line.candidate.date, installment: line.split.number !== null })),
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
  for (const { candidate, split, credit } of lines) {
    const amount = credit ? -candidate.amount : candidate.amount;
    const key = purchaseKey(split, split.base, amount, candidate.date);
    const available = remaining.get(key) ?? 0;
    if (available > 0) {
      remaining.set(key, available - 1);
      duplicates++;
      continue;
    }
    rows.push({
      card_id: card.id,
      description: split.base.slice(0, 80),
      amount,
      date: candidate.date,
      category: credit ? CARD_CREDIT_CATEGORY : candidate.category,
      invoice_ref: ref,
      installment_group_id: split.number !== null ? groupIdFor(card.id, split.base, candidate.amount, split.total as number) : null,
      installment_number: split.number,
      installment_total: split.total,
    });
  }

  const round2 = (value: number) => Math.round(value * 100) / 100;
  const total = round2(rows.reduce((sum, row) => sum + row.amount, 0));
  const purchaseRows = rows.filter((row) => row.amount > 0);
  const creditRows = rows.filter((row) => row.amount < 0);
  const blocked = rows.length > 0 ? purchaseBlockedByPayment([ref], input.payments, card.id) : null;

  return {
    ref,
    refOptions,
    rows,
    purchasesCount: purchaseRows.length,
    purchasesTotal: round2(purchaseRows.reduce((sum, row) => sum + row.amount, 0)),
    creditsCount: creditRows.length,
    creditsTotal: round2(-creditRows.reduce((sum, row) => sum + row.amount, 0)),
    duplicates,
    ignoredCredits,
    totalRows: rows.length + duplicates,
    total,
    blocked,
  };
}

// ------------------------------------------------------------------ o extrato não conta o pagamento da fatura

/**
 * Tira do extrato as linhas de pagamento de fatura de cartão (sempre, com ou sem cartão cadastrado): o gasto do cartão
 * já foi contado compra por compra, na data de cada uma, então o pagamento da fatura é só a liquidação e importá-lo
 * também contaria o mesmo dinheiro duas vezes. Só olha despesas: um "pagamento recebido" em conta é uma entrada de
 * verdade. As linhas descartadas são contadas para a conferência mostrar o que ficou de fora.
 */
export function ignoreCardPayments(plan: CsvImportPlan): CsvImportPlan {
  const toImport: ImportedTransaction[] = [];
  let ignored = 0;
  for (const candidate of plan.toImport) {
    if (candidate.type === "expense" && isCardInvoicePayment(candidate.description)) ignored++;
    else toImport.push(candidate);
  }
  return ignored === 0 ? plan : { ...plan, toImport, cardPaymentsIgnored: ignored };
}
