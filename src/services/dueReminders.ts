import type { DebtRow, TransactionRow } from "../types";
import type { InvoiceDue } from "../utils/creditCards";
import {
  collectDueItems,
  parseReminderSettings,
  planReminders,
  REMINDER_ID_PREFIX,
  type PlannedReminder,
  type ReminderSettings,
} from "../utils/dueReminders";

/** Chaves da tabela app_meta usadas pelos lembretes. */
export const REMINDER_META = {
  enabled: "due_reminders_enabled",
  daysBefore: "due_reminders_days_before",
  hour: "due_reminders_hour",
} as const;

/** Notificação de teste: fica fora do prefixo, então a sincronização não a cancela. */
export const TEST_REMINDER_ID = "reminder-test";
const TEST_DELAY_MS = 5000;

export interface ReminderPermission {
  granted: boolean;
  /** false = o Android não mostra mais o pedido; só pelas configurações do sistema. */
  canAskAgain: boolean;
}

/** O que o serviço precisa do sistema de notificações; nos testes vira um faz-de-conta. */
export interface ReminderScheduler {
  /** Cria o canal de notificação (obrigatório no Android antes de pedir permissão ou agendar). */
  prepare(): Promise<void>;
  getPermission(): Promise<ReminderPermission>;
  requestPermission(): Promise<ReminderPermission>;
  listScheduledIds(): Promise<string[]>;
  cancel(id: string): Promise<void>;
  schedule(reminder: { id: string; title: string; body: string; date: Date }): Promise<void>;
}

export interface DueReminderDeps {
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  readDebts(): Promise<DebtRow[]>;
  readRecurringExpenses(): Promise<TransactionRow[]>;
  /** Faturas de cartão por pagar. Opcional: quem não informa não recebe avisos de fatura. */
  readInvoices?(): Promise<InvoiceDue[]>;
  scheduler: ReminderScheduler;
  now(): Date;
}

export type SyncResult =
  | { status: "disabled" }
  | { status: "no-permission" }
  | { status: "scheduled"; count: number };

type Denied = { status: "denied"; canAskAgain: boolean };

export type EnableResult = { status: "enabled"; count: number } | Denied;

export async function getReminderSettings(deps: DueReminderDeps): Promise<ReminderSettings> {
  return parseReminderSettings({
    enabled: await deps.getMeta(REMINDER_META.enabled),
    daysBefore: await deps.getMeta(REMINDER_META.daysBefore),
    hour: await deps.getMeta(REMINDER_META.hour),
  });
}

async function saveSettings(deps: DueReminderDeps, settings: ReminderSettings): Promise<void> {
  await deps.setMeta(REMINDER_META.enabled, settings.enabled ? "1" : "0");
  await deps.setMeta(REMINDER_META.daysBefore, String(settings.daysBefore));
  await deps.setMeta(REMINDER_META.hour, String(settings.hour));
}

async function planFor(deps: DueReminderDeps, settings: ReminderSettings): Promise<PlannedReminder[]> {
  const [debts, transactions, invoices] = await Promise.all([
    deps.readDebts(),
    deps.readRecurringExpenses(),
    deps.readInvoices ? deps.readInvoices() : Promise.resolve([]),
  ]);
  const now = deps.now();
  return planReminders({
    items: collectDueItems({ debts, transactions, invoices, today: now }),
    settings,
    now,
  });
}

async function cancelOurs(scheduler: ReminderScheduler): Promise<void> {
  const ids = (await scheduler.listScheduledIds()).filter((id) => id.startsWith(REMINDER_ID_PREFIX));
  for (const id of ids) await scheduler.cancel(id);
}

async function runSync(deps: DueReminderDeps): Promise<SyncResult> {
  const settings = await getReminderSettings(deps);
  if (!settings.enabled) {
    await cancelOurs(deps.scheduler);
    return { status: "disabled" };
  }

  // Sem permissão (ex.: o usuário desligou nas configurações do Android) não adianta agendar.
  const permission = await deps.scheduler.getPermission();
  if (!permission.granted) {
    await cancelOurs(deps.scheduler);
    return { status: "no-permission" };
  }

  const planned = await planFor(deps, settings);
  await deps.scheduler.prepare();
  await cancelOurs(deps.scheduler);
  for (const reminder of planned) {
    await deps.scheduler.schedule({
      id: reminder.id,
      title: reminder.title,
      body: reminder.body,
      date: reminder.fireAt,
    });
  }
  return { status: "scheduled", count: planned.length };
}

// Sincronizações em fila: duas ao mesmo tempo (abrir o painel + salvar algo) se atropelariam
// no meio do "cancela tudo, agenda de novo".
let queue: Promise<unknown> = Promise.resolve();

/**
 * Deixa as notificações agendadas iguais ao que está no banco agora: cancela as
 * do app e agenda de novo. Chamar depois de qualquer mudança em dívidas, parcelas
 * ou nas preferências, e ao abrir o painel.
 */
export function syncDueReminders(deps: DueReminderDeps): Promise<SyncResult> {
  const run = queue.then(() => runSync(deps));
  queue = run.catch(() => undefined);
  return run;
}

/** Liga os lembretes: pede a permissão de notificação e, só com ela, salva e agenda. */
export async function enableDueReminders(deps: DueReminderDeps): Promise<EnableResult> {
  await deps.scheduler.prepare();
  let permission = await deps.scheduler.getPermission();
  if (!permission.granted) permission = await deps.scheduler.requestPermission();
  if (!permission.granted) return { status: "denied", canAskAgain: permission.canAskAgain };

  const current = await getReminderSettings(deps);
  await saveSettings(deps, { ...current, enabled: true });
  const result = await syncDueReminders(deps);
  return { status: "enabled", count: result.status === "scheduled" ? result.count : 0 };
}

export async function disableDueReminders(deps: DueReminderDeps): Promise<void> {
  const current = await getReminderSettings(deps);
  await saveSettings(deps, { ...current, enabled: false });
  await syncDueReminders(deps);
}

/** Muda quantos dias antes e/ou a hora e reagenda. */
export async function updateReminderTiming(
  deps: DueReminderDeps,
  patch: Partial<Pick<ReminderSettings, "daysBefore" | "hour">>,
): Promise<SyncResult> {
  const current = await getReminderSettings(deps);
  await saveSettings(deps, { ...current, ...patch });
  return syncDueReminders(deps);
}

/** O que seria avisado com as preferências atuais (ligado ou não), para mostrar na tela. */
export async function previewDueReminders(deps: DueReminderDeps): Promise<PlannedReminder[]> {
  const settings = await getReminderSettings(deps);
  return planFor(deps, { ...settings, enabled: true });
}

export async function getReminderPermission(deps: DueReminderDeps): Promise<ReminderPermission> {
  return deps.scheduler.getPermission();
}

/** Notificação de teste em poucos segundos, para conferir que o aparelho mostra os avisos. */
export async function sendTestReminder(deps: DueReminderDeps): Promise<{ status: "sent" } | Denied> {
  await deps.scheduler.prepare();
  let permission = await deps.scheduler.getPermission();
  if (!permission.granted) permission = await deps.scheduler.requestPermission();
  if (!permission.granted) return { status: "denied", canAskAgain: permission.canAskAgain };

  await deps.scheduler.schedule({
    id: TEST_REMINDER_ID,
    title: "Teste de lembrete",
    body: "É assim que os avisos de contas a vencer vão aparecer.",
    date: new Date(deps.now().getTime() + TEST_DELAY_MS),
  });
  return { status: "sent" };
}
