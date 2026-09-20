import { WARNING_THRESHOLD } from "./alerts";
import { formatCurrency } from "./currency";

/**
 * Alertas de orçamento por notificação: avisa quando o gasto do mês numa categoria (ou no
 * orçamento do mês) chega perto do limite ou passa dele. Lógica pura: o serviço lê o banco
 * e manda a notificação. Os números são os mesmos dos avisos do Início (mesmo limite de
 * 80%, mesma soma de despesas do mês), para o aviso e a tela nunca discordarem.
 */

/** 0 = dentro do limite, 1 = perto (a partir de 80%), 2 = estourou (100% ou mais). */
export type AlertLevel = 0 | 1 | 2;

export const TOTAL_BUDGET_KEY = "budget";
const TOTAL_BUDGET_LABEL = "Orçamento do mês";

export interface BudgetUsage {
  /** "budget" ou "category:<nome em minúsculas>". */
  key: string;
  label: string;
  spent: number;
  limit: number;
}

export function levelFor(spent: number, limit: number): AlertLevel {
  if (!(limit > 0)) return 0;
  const usage = spent / limit;
  if (usage >= 1) return 2;
  return usage >= WARNING_THRESHOLD ? 1 : 0;
}

const categoryKey = (name: string) => `category:${name.trim().toLowerCase()}`;

/** Gasto do mês contra cada limite definido: o orçamento do mês e a meta de cada categoria. */
export function collectUsage(input: {
  expenses: { category_id: string; amount: number }[];
  goals: { category: string; amount: number }[];
  budget: number | null;
}): BudgetUsage[] {
  const spentByCategory = new Map<string, number>();
  let totalExpense = 0;
  for (const expense of input.expenses) {
    totalExpense += expense.amount;
    const name = (expense.category_id || "").trim();
    if (!name) continue;
    const key = categoryKey(name);
    spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + expense.amount);
  }

  const usages: BudgetUsage[] = [];
  if (input.budget !== null && input.budget > 0) {
    usages.push({ key: TOTAL_BUDGET_KEY, label: TOTAL_BUDGET_LABEL, spent: totalExpense, limit: input.budget });
  }
  for (const goal of input.goals) {
    if (!(goal.amount > 0)) continue;
    const key = categoryKey(goal.category);
    usages.push({ key, label: goal.category.trim(), spent: spentByCategory.get(key) ?? 0, limit: goal.amount });
  }
  return usages;
}

// ------------------------------------------------------------ o que já foi avisado

export interface BudgetAlertState {
  /** Mês a que o estado se refere, "AAAA-MM": virou o mês, recomeça do zero. */
  period: string;
  items: Record<string, { level: AlertLevel; spent: number }>;
}

export function periodKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function parseAlertState(raw: string | null): BudgetAlertState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { period?: unknown; items?: unknown };
    if (typeof parsed.period !== "string" || typeof parsed.items !== "object" || parsed.items === null) return null;
    const items: BudgetAlertState["items"] = {};
    for (const [key, value] of Object.entries(parsed.items as Record<string, unknown>)) {
      const item = value as { level?: unknown; spent?: unknown };
      if ((item.level !== 0 && item.level !== 1 && item.level !== 2) || typeof item.spent !== "number") return null;
      items[key] = { level: item.level, spent: item.spent };
    }
    return { period: parsed.period, items };
  } catch {
    return null;
  }
}

export interface BudgetNotice {
  key: string;
  label: string;
  level: 1 | 2;
  spent: number;
  limit: number;
}

/**
 * Compara o uso de agora com o que já foi avisado e diz o que avisar de novo.
 *
 * - Sem estado anterior (recém-ligado, dados restaurados ou zerados): só anota o ponto de
 *   partida, sem avisar sobre o que já estava assim.
 * - Avisa quando o nível SOBE e o gasto também aumentou: mudar o limite (que é você mexendo
 *   na meta) não dispara aviso, gastar dispara.
 * - Cada nível avisa uma vez por mês; se o gasto cai abaixo (editou ou apagou) e volta a
 *   cruzar, avisa de novo.
 */
export function planBudgetAlerts(input: {
  usages: BudgetUsage[];
  previous: BudgetAlertState | null;
  period: string;
}): { notices: BudgetNotice[]; next: BudgetAlertState; baseline: boolean } {
  const { usages, previous, period } = input;
  const baseline = previous === null;
  const before = previous !== null && previous.period === period ? previous.items : {};

  const next: BudgetAlertState = { period, items: {} };
  const notices: BudgetNotice[] = [];
  for (const usage of usages) {
    const level = levelFor(usage.spent, usage.limit);
    const seen = before[usage.key] ?? { level: 0 as AlertLevel, spent: 0 };
    if (!baseline && level > seen.level && usage.spent > seen.spent) {
      notices.push({ key: usage.key, label: usage.label, level: level as 1 | 2, spent: usage.spent, limit: usage.limit });
    }
    next.items[usage.key] = { level, spent: usage.spent };
  }
  return { notices, next, baseline };
}

// ---------------------------------------------------------------- a notificação

export interface BudgetNotification {
  id: string;
  title: string;
  body: string;
}

function describe(notice: BudgetNotice): { title: string; body: string; short: string } {
  const detail = `${formatCurrency(notice.spent)} de ${formatCurrency(notice.limit)}`;
  const over = formatCurrency(notice.spent - notice.limit);
  const percent = Math.floor((notice.spent / notice.limit) * 100);
  const isTotal = notice.key === TOTAL_BUDGET_KEY;
  // "do orçamento" (masculino) e "da meta" (feminino).
  const ofLimit = isTotal ? "do orçamento" : "da meta";

  if (notice.level === 2) {
    return {
      title: isTotal ? "Orçamento do mês estourado" : `${notice.label}: meta estourada`,
      body: `Você passou ${over} ${ofLimit} do mês (${detail}).`,
      short: `estourou em ${over}`,
    };
  }
  return {
    title: isTotal ? "Orçamento do mês: quase no limite" : `${notice.label}: perto do limite`,
    body: `Você já usou ${percent}% ${ofLimit} do mês (${detail}).`,
    short: `${percent}% usado`,
  };
}

/** Uma notificação para o que precisa ser avisado agora (várias de uma vez viram uma só). */
export function buildBudgetNotification(notices: BudgetNotice[]): BudgetNotification | null {
  if (notices.length === 0) return null;
  if (notices.length === 1) {
    const [notice] = notices;
    const { title, body } = describe(notice);
    return { id: `budget-alert-${notice.key}-${notice.level}`, title, body };
  }
  return {
    id: "budget-alert-group",
    title: `${notices.length} alertas de orçamento`,
    body: notices.map((notice) => `• ${notice.label}: ${describe(notice).short}`).join("\n"),
  };
}
