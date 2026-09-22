import { formatCurrency } from "./currency";
import { formatDateToString } from "./dates";
import { parseDueDate } from "./dueReminders";

/**
 * Filtros avançados da busca do histórico: faixa de valor, várias categorias e um período
 * qualquer (não só o mês selecionado). Lógica pura; quem carrega os dados é a tela.
 */

/** Datas no formato DD/MM/AAAA, como ficam no banco. */
export interface DateRange {
  from: string;
  to: string;
}

export interface HistoryFilters {
  /** Valor mínimo/máximo em reais, inclusive; null = sem limite. O valor é sempre positivo (o tipo diz se é receita ou despesa). */
  minAmount: number | null;
  maxAmount: number | null;
  /** Nomes das categorias marcadas (qualquer uma delas serve); vazio = todas. */
  categories: string[];
  /** Nomes das contas marcadas (qualquer uma delas serve); vazio = todas. Independente da conta em foco no topo do app. */
  accounts: string[];
  /** Período personalizado; null = o mês selecionado no topo do app. */
  period: DateRange | null;
}

export const EMPTY_HISTORY_FILTERS: HistoryFilters = {
  minAmount: null,
  maxAmount: null,
  categories: [],
  accounts: [],
  period: null,
};

// Quantos anos um período pode ter (cada ano é uma consulta ao banco).
export const MAX_PERIOD_YEARS = 10;

export type FilterKind = "value" | "categories" | "accounts" | "period";

const hasValue = (f: HistoryFilters) => f.minAmount !== null || f.maxAmount !== null;

export function activeFilterKinds(filters: HistoryFilters): FilterKind[] {
  const kinds: FilterKind[] = [];
  if (hasValue(filters)) kinds.push("value");
  if (filters.categories.length > 0) kinds.push("categories");
  if (filters.accounts.length > 0) kinds.push("accounts");
  if (filters.period !== null) kinds.push("period");
  return kinds;
}

export const hasActiveFilters = (filters: HistoryFilters): boolean => activeFilterKinds(filters).length > 0;

/** Tira um dos filtros, mantendo os outros. */
export function clearFilter(filters: HistoryFilters, kind: FilterKind): HistoryFilters {
  if (kind === "value") return { ...filters, minAmount: null, maxAmount: null };
  if (kind === "categories") return { ...filters, categories: [] };
  if (kind === "accounts") return { ...filters, accounts: [] };
  return { ...filters, period: null };
}

// ------------------------------------------------------------------- validação

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const DAY_MS = 24 * 60 * 60 * 1000;

/** Mensagem do problema nos filtros; null se estão bons. */
export function validateFilters(filters: HistoryFilters): string | null {
  const { minAmount, maxAmount, period } = filters;

  if ((minAmount !== null && !(minAmount >= 0)) || (maxAmount !== null && !(maxAmount >= 0))) {
    return "O valor não pode ser negativo.";
  }
  if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
    return "O valor mínimo é maior que o máximo.";
  }

  if (period !== null) {
    const from = parseDueDate(period.from);
    const to = parseDueDate(period.to);
    if (!from || !to) return "Escolha as duas datas do período.";
    if (from > to) return "A data inicial é depois da final.";
    if ((to.getTime() - from.getTime()) / DAY_MS > MAX_PERIOD_YEARS * 366) {
      return `O período pode ter no máximo ${MAX_PERIOD_YEARS} anos.`;
    }
  }
  return null;
}

// ------------------------------------------------------------------- aplicação

export interface FilterableTransaction {
  amount: number;
  date: string;
  category?: string;
  account?: string;
}

const normalizeCategory = (name: string | undefined) => (name ?? "").trim().toLowerCase();
const toCents = (amount: number) => Math.round(amount * 100);

/** A data (DD/MM/AAAA) cai dentro do período, inclusive nas duas pontas? Data inválida = fora. */
export function isDateInRange(date: string, range: DateRange): boolean {
  const day = parseDueDate(date);
  const from = parseDueDate(range.from);
  const to = parseDueDate(range.to);
  return day !== null && from !== null && to !== null && day >= from && day <= to;
}

export function matchesFilters(item: FilterableTransaction, filters: HistoryFilters): boolean {
  const cents = toCents(item.amount);
  if (filters.minAmount !== null && cents < toCents(filters.minAmount)) return false;
  if (filters.maxAmount !== null && cents > toCents(filters.maxAmount)) return false;

  if (filters.categories.length > 0) {
    const wanted = new Set(filters.categories.map(normalizeCategory));
    if (!wanted.has(normalizeCategory(item.category))) return false;
  }

  if (filters.accounts.length > 0) {
    const wanted = new Set(filters.accounts.map(normalizeCategory));
    if (!wanted.has(normalizeCategory(item.account))) return false;
  }

  if (filters.period !== null && !isDateInRange(item.date, filters.period)) return false;
  return true;
}

export function applyHistoryFilters<T extends FilterableTransaction>(items: T[], filters: HistoryFilters): T[] {
  return hasActiveFilters(filters) ? items.filter((item) => matchesFilters(item, filters)) : items;
}

/** Os anos que o período toca (cada um vira uma consulta ao banco); vazio se o período é inválido. */
export function yearsInRange(range: DateRange): string[] {
  const from = parseDueDate(range.from);
  const to = parseDueDate(range.to);
  if (!from || !to || from > to) return [];
  const years: string[] = [];
  for (let year = from.getFullYear(); year <= to.getFullYear() && years.length <= MAX_PERIOD_YEARS + 1; year++) {
    years.push(String(year));
  }
  return years;
}

// ------------------------------------------------------------------- textos

export interface FilterChip {
  kind: FilterKind;
  label: string;
}

/** Uma etiqueta por filtro ativo, para mostrar sob a busca. */
export function describeFilters(filters: HistoryFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  const { minAmount, maxAmount, categories, accounts, period } = filters;

  if (minAmount !== null && maxAmount !== null) {
    chips.push({ kind: "value", label: `Valor: ${formatCurrency(minAmount)} a ${formatCurrency(maxAmount)}` });
  } else if (minAmount !== null) {
    chips.push({ kind: "value", label: `Valor: a partir de ${formatCurrency(minAmount)}` });
  } else if (maxAmount !== null) {
    chips.push({ kind: "value", label: `Valor: até ${formatCurrency(maxAmount)}` });
  }

  if (categories.length > 0) {
    chips.push({
      kind: "categories",
      label: categories.length <= 2 ? `Categorias: ${categories.join(", ")}` : `${categories.length} categorias`,
    });
  }

  if (accounts.length > 0) {
    chips.push({
      kind: "accounts",
      label: accounts.length <= 2 ? `Contas: ${accounts.join(", ")}` : `${accounts.length} contas`,
    });
  }

  if (period !== null) chips.push({ kind: "period", label: `Período: ${period.from} a ${period.to}` });
  return chips;
}

export interface TransactionsSummary {
  count: number;
  income: number;
  expense: number;
}

/** Quantas transações e quanto entrou e saiu nelas (para o resumo do resultado filtrado). */
export function summarizeTransactions(items: { amount: number; type: "income" | "expense" }[]): TransactionsSummary {
  let income = 0;
  let expense = 0;
  for (const item of items) {
    if (item.type === "income") income += item.amount;
    else expense += item.amount;
  }
  return { count: items.length, income, expense };
}

// ------------------------------------------------------------------- atalhos de período

export type PeriodPreset = "last30" | "last90" | "thisYear";

export const PERIOD_PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "last30", label: "Últimos 30 dias" },
  { id: "last90", label: "Últimos 90 dias" },
  { id: "thisYear", label: "Este ano" },
];

/** O período de um atalho, terminando hoje. */
export function presetRange(preset: PeriodPreset, today: Date = new Date()): DateRange {
  const end = startOfDay(today);
  let start: Date;
  if (preset === "thisYear") start = new Date(end.getFullYear(), 0, 1);
  else start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (preset === "last30" ? 29 : 89));
  return { from: formatDateToString(start), to: formatDateToString(end) };
}
