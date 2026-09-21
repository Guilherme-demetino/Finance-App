import type { DebtRow } from "../types";
import { formatCurrency } from "./currency";
import type { InvoiceDue } from "./creditCards";
import { parseDateString } from "./dates";

type AlertLevel = "warning" | "danger";

export interface AppAlert {
  id: string;
  level: AlertLevel;
  message: string;
}

interface CategoryUsage {
  category: string;
  spent: number;
  goal: number | null;
}

// A partir de quanto da meta/orçamento usado o aviso amarelo aparece.
export const WARNING_THRESHOLD = 0.8;
// Quantos dias antes do vencimento a dívida já entra nos avisos.
const DEBT_DUE_SOON_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(dueDate: string, today: Date): number {
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  return Math.round((parseDateString(dueDate).getTime() - todayStart) / DAY_MS);
}

/**
 * Monta os avisos do Início: orçamento e metas por categoria estourando ou
 * perto disso, e dívidas e faturas de cartão vencidas ou perto de vencer. Os mais graves vêm
 * primeiro. `includeSpendingAlerts` deve ser false ao olhar meses que não
 * são o atual, onde falar de "orçamento estourando" não faz sentido.
 */
export function buildAlerts(params: {
  budget: number | null;
  totalExpense: number;
  categories: CategoryUsage[];
  pendingDebts: DebtRow[];
  /** Faturas de cartão por pagar (ver unpaidInvoiceDues). */
  invoices?: InvoiceDue[];
  today?: Date;
  includeSpendingAlerts?: boolean;
}): AppAlert[] {
  const {
    budget,
    totalExpense,
    categories,
    pendingDebts,
    invoices = [],
    today = new Date(),
    includeSpendingAlerts = true,
  } = params;
  const alerts: AppAlert[] = [];

  if (includeSpendingAlerts) {
    if (budget !== null && budget > 0) {
      const usage = totalExpense / budget;
      if (usage >= 1) {
        alerts.push({
          id: "budget",
          level: "danger",
          message: `Você estourou o orçamento do mês em ${formatCurrency(totalExpense - budget)}.`,
        });
      } else if (usage >= WARNING_THRESHOLD) {
        alerts.push({
          id: "budget",
          level: "warning",
          message: `Você já usou ${Math.floor(usage * 100)}% do orçamento do mês.`,
        });
      }
    }

    categories.forEach((item) => {
      if (item.goal === null || item.goal <= 0) return;
      const usage = item.spent / item.goal;
      if (usage >= 1) {
        alerts.push({
          id: `category-${item.category}`,
          level: "danger",
          message: `${item.category}: meta estourada em ${formatCurrency(item.spent - item.goal)}.`,
        });
      } else if (usage >= WARNING_THRESHOLD) {
        alerts.push({
          id: `category-${item.category}`,
          level: "warning",
          message: `${item.category}: ${Math.floor(usage * 100)}% da meta usada.`,
        });
      }
    });
  }

  pendingDebts.forEach((debt) => {
    if (!debt.due_date) return;
    const days = daysUntil(debt.due_date, today);
    const action = debt.type === "lent" ? "Cobrar" : "Pagar";
    const value = formatCurrency(debt.amount);

    if (days < 0) {
      alerts.push({
        id: `debt-${debt.id}`,
        level: "danger",
        message: `${action} ${debt.person}: ${value} venceu em ${debt.due_date}.`,
      });
    } else if (days <= DEBT_DUE_SOON_DAYS) {
      const when =
        days === 0 ? "vence hoje" : `vence em ${days} ${days === 1 ? "dia" : "dias"}`;
      alerts.push({
        id: `debt-${debt.id}`,
        level: "warning",
        message: `${action} ${debt.person}: ${value} ${when}.`,
      });
    }
  });

  invoices.forEach((invoice) => {
    const days = daysUntil(invoice.dueDate, today);
    const value = formatCurrency(invoice.amount);

    if (days < 0) {
      alerts.push({
        id: invoice.id,
        level: "danger",
        message: `Fatura ${invoice.cardName}: ${value} venceu em ${invoice.dueDate}.`,
      });
    } else if (days <= DEBT_DUE_SOON_DAYS) {
      const when =
        days === 0 ? "vence hoje" : `vence em ${days} ${days === 1 ? "dia" : "dias"}`;
      alerts.push({
        id: invoice.id,
        level: "warning",
        message: `Fatura ${invoice.cardName}: ${value} ${when}.`,
      });
    }
  });

  // Sort estável: graves primeiro, mantendo a ordem de criação dentro do nível.
  return alerts
    .map((alert, index) => ({ alert, index }))
    .sort((a, b) => {
      if (a.alert.level !== b.alert.level) {
        return a.alert.level === "danger" ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map(({ alert }) => alert);
}
