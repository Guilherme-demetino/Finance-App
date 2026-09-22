import type { SubscriptionCycle, SubscriptionPriceChangeRow, SubscriptionRow, TransactionRow } from "../types";
import { parseDateString } from "./dates";
import { normalizeText } from "./statements/statementParsing";

/**
 * Assinaturas recorrentes. O total mensal soma o que está ativo (a anual entra dividida por 12), e o alerta de reajuste
 * compara o valor cadastrado com a cobrança mais recente que aparece nas despesas (por cartão ou extrato) com o nome
 * da assinatura.
 */

export const CYCLE_LABELS: Record<SubscriptionCycle, string> = { monthly: "Mensal", yearly: "Anual" };

const DAY_MS = 24 * 60 * 60 * 1000;
const cents = (value: number) => Math.round(value * 100);
const round2 = (value: number) => Math.round(value * 100) / 100;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const daysInMonth = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();
/** O dia pedido, ou o último do mês se ele não existe (31 em fevereiro). */
const dayIn = (year: number, monthIndex: number, day: number) => new Date(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex)));

// ------------------------------------------------------------------ valores

/** Quanto a assinatura pesa por mês: a anual dividida por 12. */
export function monthlyEquivalent(subscription: Pick<SubscriptionRow, "amount" | "cycle">): number {
  return subscription.cycle === "yearly" ? subscription.amount / 12 : subscription.amount;
}

export interface SubscriptionsSummary {
  /** Total por mês das assinaturas ativas. */
  monthlyTotal: number;
  /** O mesmo total, em 12 meses. */
  yearlyTotal: number;
  activeCount: number;
  pausedCount: number;
}

export function summarizeSubscriptions(subscriptions: SubscriptionRow[]): SubscriptionsSummary {
  const active = subscriptions.filter((subscription) => subscription.active === 1);
  const monthlyTotal = round2(active.reduce((sum, subscription) => sum + monthlyEquivalent(subscription), 0));
  return {
    monthlyTotal,
    yearlyTotal: round2(monthlyTotal * 12),
    activeCount: active.length,
    pausedCount: subscriptions.length - active.length,
  };
}

/** A próxima cobrança a partir de hoje (inclusive): mensal no dia de cobrança; anual no mês e dia dela. */
export function nextChargeDate(
  subscription: Pick<SubscriptionRow, "cycle" | "billing_day" | "billing_month">,
  today: Date = new Date(),
): Date {
  const now = startOfDay(today);
  if (subscription.cycle === "yearly" && subscription.billing_month !== null) {
    const monthIndex = subscription.billing_month - 1;
    const thisYear = dayIn(now.getFullYear(), monthIndex, subscription.billing_day);
    return thisYear >= now ? thisYear : dayIn(now.getFullYear() + 1, monthIndex, subscription.billing_day);
  }
  const thisMonth = dayIn(now.getFullYear(), now.getMonth(), subscription.billing_day);
  return thisMonth >= now ? thisMonth : dayIn(now.getFullYear(), now.getMonth() + 1, subscription.billing_day);
}

/** Dias até a próxima cobrança (0 = hoje). */
export function daysUntilCharge(subscription: Pick<SubscriptionRow, "cycle" | "billing_day" | "billing_month">, today: Date = new Date()): number {
  const next = nextChargeDate(subscription, today);
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(next.getFullYear(), next.getMonth(), next.getDate());
  return Math.round((b - a) / DAY_MS);
}

// ------------------------------------------------------------------ cadastro

export interface SubscriptionInput {
  name: string;
  amount: number | null;
  cycle: SubscriptionCycle;
  billingDay: number;
  billingMonth: number | null;
  category: string;
  matchText: string;
}

export function validateSubscription(input: SubscriptionInput): string | null {
  if (input.name.trim() === "") return "Dê um nome à assinatura.";
  if (input.amount === null || !(input.amount > 0)) return "Digite o valor da assinatura.";
  if (!Number.isInteger(input.billingDay) || input.billingDay < 1 || input.billingDay > 31) {
    return "O dia da cobrança precisa estar entre 1 e 31.";
  }
  if (input.cycle === "yearly" && (input.billingMonth === null || !Number.isInteger(input.billingMonth) || input.billingMonth < 1 || input.billingMonth > 12)) {
    return "Nas assinaturas anuais, informe o mês da cobrança (1 a 12).";
  }
  const match = input.matchText.trim();
  if (match !== "" && normalizeText(match).length < 3) return "O texto da cobrança precisa ter pelo menos 3 letras.";
  return null;
}

// ------------------------------------------------------------------ reajuste

export interface PriceAlert {
  subscriptionId: number;
  name: string;
  /** O valor cadastrado. */
  oldAmount: number;
  /** O valor da cobrança mais recente. */
  newAmount: number;
  /** DD/MM/AAAA: a data dessa cobrança. */
  chargeDate: string;
  difference: number;
  /** Variação em %, com sinal (positivo = reajuste para cima). */
  percent: number;
}

/** Variação mínima, em %, para valer um alerta (evita diferença de câmbio ou arredondamento). */
const MIN_ALERT_PERCENT = 1;

/** O texto que identifica as cobranças da assinatura nas despesas: o "como aparece na cobrança" ou o nome. */
export function chargeNeedle(subscription: Pick<SubscriptionRow, "name" | "match_text">): string {
  return normalizeText(subscription.match_text?.trim() ? subscription.match_text : subscription.name);
}

/** Cobranças de uma assinatura nas despesas: mesmo nome, depois do valor atual valer. Ignora IOF, que é outra linha. */
function chargesOf(subscription: SubscriptionRow, transactions: TransactionRow[], today: Date): TransactionRow[] {
  const needle = chargeNeedle(subscription);
  if (needle.length < 3) return [];
  const since = startOfDay(parseDateString(subscription.price_since)).getTime();
  const until = startOfDay(today).getTime();
  return transactions
    .filter((transaction) => {
      if (transaction.type !== "expense") return false;
      const description = normalizeText(transaction.description ?? "");
      if (/^iof\b/.test(description) || !description.includes(needle)) return false;
      const date = startOfDay(parseDateString(transaction.date)).getTime();
      return date >= since && date <= until;
    })
    .sort((a, b) => parseDateString(b.date).getTime() - parseDateString(a.date).getTime() || b.id - a.id);
}

/**
 * Reajuste: a cobrança mais recente, depois de o valor cadastrado passar a valer, veio diferente. Assinaturas pausadas
 * não alertam, nem cobranças que o usuário mandou ignorar (o mesmo valor).
 */
export function detectPriceChange(subscription: SubscriptionRow, transactions: TransactionRow[], today: Date = new Date()): PriceAlert | null {
  if (subscription.active !== 1) return null;
  const [latest] = chargesOf(subscription, transactions, today);
  if (!latest) return null;

  const newAmount = Number(latest.amount);
  if (cents(newAmount) === cents(subscription.amount)) return null;
  if (subscription.ignored_amount !== null && cents(subscription.ignored_amount) === cents(newAmount)) return null;

  const percent = round2(((newAmount - subscription.amount) / subscription.amount) * 100);
  if (Math.abs(percent) < MIN_ALERT_PERCENT) return null;
  return {
    subscriptionId: subscription.id,
    name: subscription.name,
    oldAmount: subscription.amount,
    newAmount,
    chargeDate: latest.date,
    difference: round2(newAmount - subscription.amount),
    percent,
  };
}

/** Todos os alertas de reajuste, os maiores primeiro. */
export function detectPriceChanges(subscriptions: SubscriptionRow[], transactions: TransactionRow[], today: Date = new Date()): PriceAlert[] {
  return subscriptions
    .map((subscription) => detectPriceChange(subscription, transactions, today))
    .filter((alert): alert is PriceAlert => alert !== null)
    .sort((a, b) => Math.abs(b.percent) - Math.abs(a.percent));
}

/** Quanto o reajuste muda o total por mês (uma anual conta 1/12). */
export function monthlyImpact(alert: PriceAlert, cycle: SubscriptionCycle): number {
  return round2(cycle === "yearly" ? alert.difference / 12 : alert.difference);
}

/** Reajustes já aplicados nos últimos dias, do mais recente para o mais antigo. */
export function recentPriceChanges(
  changes: SubscriptionPriceChangeRow[],
  today: Date = new Date(),
  days = 90,
): SubscriptionPriceChangeRow[] {
  const limit = startOfDay(today).getTime() - days * DAY_MS;
  return changes
    .filter((change) => startOfDay(parseDateString(change.date)).getTime() >= limit)
    .sort((a, b) => parseDateString(b.date).getTime() - parseDateString(a.date).getTime() || b.id - a.id);
}

/** "+12,5%" / "-8,0%" */
export function formatPercent(percent: number): string {
  const text = Math.abs(percent).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${percent >= 0 ? "+" : "-"}${text}%`;
}
