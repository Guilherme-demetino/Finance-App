import type { DebtRow, TransactionRow } from "../types";
import { formatCurrency } from "./currency";
// Só o tipo: creditCards.ts importa parseDueDate daqui, um import de valor faria um ciclo.
import type { InvoiceDue } from "./creditCards";

/** Preferências dos lembretes de vencimento (guardadas em app_meta). */
export interface ReminderSettings {
  enabled: boolean;
  /** Quantos dias antes do vencimento o aviso chega (0 = no próprio dia). */
  daysBefore: number;
  /** Hora do dia (0-23) em que o aviso chega. */
  hour: number;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  daysBefore: 1,
  hour: 9,
};

export const DAYS_BEFORE_OPTIONS = [0, 1, 2, 3, 7] as const;
export const HOUR_OPTIONS = [8, 9, 12, 18, 20] as const;

/** Identificadores das notificações do app começam assim: só cancelamos o que é nosso. */
export const REMINDER_ID_PREFIX = "due-reminder-";

// Até quantos dias à frente agendamos (o resto entra quando o app for aberto de novo).
const HORIZON_DAYS = 60;
// Teto de notificações agendadas ao mesmo tempo (uma por dia de vencimento).
const MAX_REMINDERS = 40;
// Quantas linhas cabem numa notificação que junta vários vencimentos.
const MAX_LINES = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseReminderSettings(raw: {
  enabled: string | null;
  daysBefore: string | null;
  hour: string | null;
}): ReminderSettings {
  // Number(null) e Number("") dão 0, que seria uma opção válida (no dia / meia-noite): sem valor salvo é o padrão.
  const toNumber = (value: string | null) => (value === null || value.trim() === "" ? NaN : Number(value));
  const daysBefore = toNumber(raw.daysBefore);
  const hour = toNumber(raw.hour);
  return {
    enabled: raw.enabled === "1",
    daysBefore: (DAYS_BEFORE_OPTIONS as readonly number[]).includes(daysBefore)
      ? daysBefore
      : DEFAULT_REMINDER_SETTINGS.daysBefore,
    hour: (HOUR_OPTIONS as readonly number[]).includes(hour)
      ? hour
      : DEFAULT_REMINDER_SETTINGS.hour,
  };
}

/** Uma conta a vencer: dívida a pagar/cobrar, parcela, despesa recorrente ou fatura de cartão. */
export interface DueItem {
  id: string;
  label: string;
  amount: number;
  /** Dia do vencimento, à meia-noite (horário local). */
  due: Date;
  /** "pay" = você paga; "receive" = você recebe (dívida que emprestou). */
  kind: "pay" | "receive";
}

/** Uma notificação pronta para agendar. */
export interface PlannedReminder {
  id: string;
  fireAt: Date;
  title: string;
  body: string;
  /** Vencimentos que essa notificação cobre. */
  itemCount: number;
}

/** DD/MM/AAAA → Date à meia-noite; null se o texto não for uma data de verdade (sem cair em "hoje"). */
export function parseDueDate(value: string | null | undefined): Date | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const valid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Dias inteiros entre dois dias do calendário (imune a horário de verão). */
function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY_MS);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function formatDay(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * Tudo o que ainda vai vencer: dívidas pendentes com data combinada, as faturas de
 * cartão por pagar e, entre as transações, as despesas parceladas ou recorrentes de hoje em diante. Já vencido
 * fica de fora (os avisos do Início cuidam disso; lembrar de novo seria ruído).
 */
export function collectDueItems(params: {
  debts: DebtRow[];
  transactions: TransactionRow[];
  /** Faturas de cartão ainda por pagar (ver unpaidInvoiceDues). */
  invoices?: InvoiceDue[];
  today?: Date;
}): DueItem[] {
  const today = startOfDay(params.today ?? new Date());
  const items: DueItem[] = [];

  for (const debt of params.debts) {
    if (debt.status !== "pending") continue;
    const due = parseDueDate(debt.due_date);
    if (!due || due < today) continue;
    const isLent = debt.type === "lent";
    items.push({
      id: `debt-${debt.id}`,
      label: `${isLent ? "Cobrar" : "Pagar"} ${debt.person}`,
      amount: debt.amount,
      due,
      kind: isLent ? "receive" : "pay",
    });
  }

  for (const row of params.transactions) {
    if (row.type !== "expense" || !row.recurrence_type) continue;
    const due = parseDueDate(row.date);
    if (!due || due < today) continue;
    const name = row.description?.trim() || row.category_id || "Despesa";
    // As parcelas já são salvas como "Notebook (2/5)": só acrescenta o número quando a descrição não traz.
    const hasNumber = /\(\d+\/\d+\)\s*$/.test(name);
    const installment =
      row.recurrence_type === "installment" && row.installment_number && row.installment_total && !hasNumber
        ? ` (parcela ${row.installment_number}/${row.installment_total})`
        : "";
    items.push({
      id: `transaction-${row.id}`,
      label: `${name}${installment}`,
      amount: row.amount,
      due,
      kind: "pay",
    });
  }

  for (const invoice of params.invoices ?? []) {
    const due = parseDueDate(invoice.dueDate);
    if (!due || due < today) continue;
    items.push({
      id: invoice.id,
      label: `Fatura ${invoice.cardName}`,
      amount: invoice.amount,
      due,
      kind: "pay",
    });
  }

  return items;
}

function whenPhrase(days: number): string {
  if (days <= 0) return "hoje";
  if (days === 1) return "amanhã";
  return `em ${days} dias`;
}

/**
 * Transforma os vencimentos em notificações: uma por dia de vencimento (várias
 * contas no mesmo dia viram um aviso só), na hora escolhida, `daysBefore` dias
 * antes. Se esse horário já passou mas o vencimento ainda não, o aviso vai para
 * o dia do vencimento (melhor tarde que nunca). Os mais próximos primeiro.
 */
export function planReminders(params: {
  items: DueItem[];
  settings: ReminderSettings;
  now: Date;
}): PlannedReminder[] {
  const { items, settings, now } = params;
  const horizon = now.getTime() + HORIZON_DAYS * DAY_MS;
  const groups = new Map<string, { fireAt: Date; due: Date; items: DueItem[] }>();

  for (const item of items) {
    let day = addDays(item.due, -settings.daysBefore);
    let fireAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), settings.hour);
    if (fireAt <= now) {
      day = item.due;
      fireAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), settings.hour);
    }
    if (fireAt <= now || fireAt.getTime() > horizon) continue;

    const key = `${dayKey(item.due)}|${fireAt.getTime()}`;
    const group = groups.get(key) ?? { fireAt, due: item.due, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }

  return [...groups.values()]
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
    .slice(0, MAX_REMINDERS)
    .map((group) => {
      const when = whenPhrase(daysBetween(group.fireAt, group.due));
      const sorted = [...group.items].sort(
        (a, b) => (a.kind === b.kind ? 0 : a.kind === "pay" ? -1 : 1) || a.label.localeCompare(b.label),
      );
      const id = `${REMINDER_ID_PREFIX}${dayKey(group.due)}`;

      if (sorted.length === 1) {
        const [item] = sorted;
        return {
          id,
          fireAt: group.fireAt,
          title: `${item.label} vence ${when}`,
          body: `${formatCurrency(item.amount)} · ${formatDay(group.due)}`,
          itemCount: 1,
        };
      }

      const lines = sorted
        .slice(0, MAX_LINES)
        .map((item) => `• ${item.label}: ${formatCurrency(item.amount)}`);
      if (sorted.length > MAX_LINES) lines.push(`e mais ${sorted.length - MAX_LINES}`);
      return {
        id,
        fireAt: group.fireAt,
        title: `${sorted.length} vencimentos ${when}`,
        body: lines.join("\n"),
        itemCount: sorted.length,
      };
    });
}

export function reminderDaysLabel(daysBefore: number): string {
  if (daysBefore === 0) return "No dia";
  if (daysBefore === 1) return "1 dia antes";
  return `${daysBefore} dias antes`;
}

export function reminderHourLabel(hour: number): string {
  return `${pad(hour)}:00`;
}

/** "20/09 às 09:00": quando a notificação vai chegar. */
export function formatReminderTime(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
