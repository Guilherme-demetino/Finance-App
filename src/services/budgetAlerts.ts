import {
  buildBudgetNotification,
  collectUsage,
  parseAlertState,
  periodKey,
  planBudgetAlerts,
  type BudgetNotification,
} from "../utils/budgetAlerts";
import { logError } from "../utils/logger";
import type { ReminderPermission } from "./dueReminders";

/** Chaves da tabela app_meta usadas pelos alertas de orçamento. */
export const BUDGET_ALERT_META = {
  enabled: "budget_alerts_enabled",
  state: "budget_alerts_state",
} as const;

/** O que o serviço precisa do sistema de notificações; nos testes vira um faz-de-conta. */
export interface BudgetAlertNotifier {
  /** Cria o canal de notificação (obrigatório no Android antes de pedir permissão ou avisar). */
  prepare(): Promise<void>;
  getPermission(): Promise<ReminderPermission>;
  requestPermission(): Promise<ReminderPermission>;
  /** Mostra a notificação agora. */
  notify(notification: BudgetNotification): Promise<void>;
}

export interface BudgetAlertDeps {
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  /** Despesas, metas por categoria e orçamento de um mês ("01".."12") e ano. */
  readMonth(
    month: string,
    year: string,
  ): Promise<{
    expenses: { category_id: string; amount: number }[];
    goals: { category: string; amount: number }[];
    budget: number | null;
  }>;
  notifier: BudgetAlertNotifier;
  now(): Date;
}

type Denied = { status: "denied"; canAskAgain: boolean };
export type EnableBudgetAlertsResult = { status: "enabled" } | Denied;

export type RunBudgetAlertsResult =
  | { status: "disabled" }
  | { status: "no-permission" }
  /** `notified`: quantos avisos saíram (vários que cruzaram juntos viram uma notificação só). */
  | { status: "checked"; notified: number };

export async function getBudgetAlertsEnabled(deps: BudgetAlertDeps): Promise<boolean> {
  return (await deps.getMeta(BUDGET_ALERT_META.enabled)) === "1";
}

/** Esquece o que já foi avisado: o próximo cálculo só anota o ponto de partida, sem avisar. */
export async function resetBudgetAlertState(deps: BudgetAlertDeps): Promise<void> {
  await deps.setMeta(BUDGET_ALERT_META.state, "");
}

async function runCheck(deps: BudgetAlertDeps): Promise<RunBudgetAlertsResult> {
  if (!(await getBudgetAlertsEnabled(deps))) return { status: "disabled" };
  // Sem permissão não adianta calcular: o estado não avança, e o que cruzou avisa quando voltar.
  if (!(await deps.notifier.getPermission()).granted) return { status: "no-permission" };

  const now = deps.now();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const { expenses, goals, budget } = await deps.readMonth(month, String(now.getFullYear()));

  const { notices, next } = planBudgetAlerts({
    usages: collectUsage({ expenses, goals, budget }),
    previous: parseAlertState(await deps.getMeta(BUDGET_ALERT_META.state)),
    period: periodKey(now),
  });

  const notification = buildBudgetNotification(notices);
  if (notification) {
    await deps.notifier.prepare();
    // Só depois de avisar é que o estado avança: se a notificação falhar, tenta de novo na próxima.
    await deps.notifier.notify(notification);
  }
  await deps.setMeta(BUDGET_ALERT_META.state, JSON.stringify(next));
  return { status: "checked", notified: notices.length };
}

// Duas verificações ao mesmo tempo (salvar algo + abrir o painel) avisariam duas vezes a mesma coisa.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Vê se algum limite do mês (orçamento ou meta de categoria) chegou perto ou estourou desde
 * a última vez e avisa por notificação. Chamar depois de qualquer mudança nas transações,
 * nas metas ou no orçamento, e ao abrir o painel.
 */
export function runBudgetAlerts(deps: BudgetAlertDeps): Promise<RunBudgetAlertsResult> {
  const run = queue.then(() => runCheck(deps));
  queue = run.catch(() => undefined);
  return run;
}

async function ensurePermission(deps: BudgetAlertDeps): Promise<ReminderPermission> {
  await deps.notifier.prepare();
  const current = await deps.notifier.getPermission();
  return current.granted ? current : deps.notifier.requestPermission();
}

/** Liga os alertas: pede a permissão de notificação e, só com ela, liga e anota o ponto de partida. */
export async function enableBudgetAlerts(deps: BudgetAlertDeps): Promise<EnableBudgetAlertsResult> {
  const permission = await ensurePermission(deps);
  if (!permission.granted) return { status: "denied", canAskAgain: permission.canAskAgain };

  await deps.setMeta(BUDGET_ALERT_META.enabled, "1");
  await resetBudgetAlertState(deps);
  // Ponto de partida: o que já estava perto do limite antes de ligar não vira aviso.
  await runBudgetAlerts(deps).catch((error) => logError("Erro ao anotar o ponto de partida dos alertas:", error));
  return { status: "enabled" };
}

export async function disableBudgetAlerts(deps: BudgetAlertDeps): Promise<void> {
  await deps.setMeta(BUDGET_ALERT_META.enabled, "0");
  await resetBudgetAlertState(deps);
}

/** Um alerta de exemplo agora, para conferir que a notificação aparece no aparelho. */
export async function sendTestBudgetAlert(deps: BudgetAlertDeps): Promise<{ status: "sent" } | Denied> {
  const permission = await ensurePermission(deps);
  if (!permission.granted) return { status: "denied", canAskAgain: permission.canAskAgain };

  await deps.notifier.notify({
    id: "budget-alert-test",
    title: "Teste de alerta: Alimentação",
    body: "É assim que o aviso aparece quando uma categoria chega perto do limite do mês.",
  });
  return { status: "sent" };
}
