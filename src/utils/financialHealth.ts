import type { DebtRow } from "../types";
import { formatCurrency } from "./currency";
import { parseDueDate } from "./dueReminders";

/**
 * "Saúde financeira" do mês: uma nota de 0 a 100 que junta três áreas, cada uma
 * com a própria nota e uma frase explicando de onde ela vem (nada de número
 * mágico): o saldo do mês, o orçamento e as dívidas em aberto.
 */

export type HealthStatus = "no-data" | "healthy" | "attention" | "risk";
export type PillarId = "cashflow" | "budget" | "debts";

export interface HealthPillar {
  id: PillarId;
  label: string;
  /** 0 a 100. */
  score: number;
  detail: string;
}

export interface FinancialHealth {
  status: HealthStatus;
  statusLabel: string;
  /** Nota geral (0 a 100); null quando não há dados para avaliar. */
  score: number | null;
  /** Uma frase que resume a situação (a área mais fraca, ou "tudo em ordem"). */
  headline: string;
  pillars: HealthPillar[];
  /** Avisos do que ficou fora da nota e como incluir. */
  hints: string[];
}

// Peso de cada área na nota geral (só entram as áreas que têm dados).
const WEIGHTS: Record<PillarId, number> = { cashflow: 40, budget: 30, debts: 30 };
const LABELS: Record<PillarId, string> = {
  cashflow: "Saldo do mês",
  budget: "Orçamento",
  debts: "Dívidas a pagar",
};

/** Nota geral a partir da qual o mês é "Saudável" e "Atenção". Abaixo disso, "Em risco". */
export const HEALTHY_MIN = 75;
export const ATTENTION_MIN = 50;
/** Uma área com nota abaixo disso impede o selo de "Saudável", mesmo que a média seja alta. */
export const WEAK_PILLAR_MAX = 50;

/** Sobra do mês, em proporção da receita, a partir da qual a área do saldo tem nota máxima. */
export const GOOD_SAVINGS_RATE = 0.2;
/** Uso do orçamento a partir do qual começa a perder nota (o mesmo limite dos avisos do Início). */
export const BUDGET_WARNING_USAGE = 0.8;
/** Dívidas a pagar, em proporção da receita do mês, até onde a nota é máxima. */
export const DEBT_COMFORTABLE_RATIO = 0.25;
const DEBT_OVERDUE_PENALTY = 20;
const DEBT_OVERDUE_PENALTY_CAP = 40;
/** Nota das dívidas quando há o que pagar mas nenhuma receita no mês para comparar. */
const DEBT_NO_INCOME_SCORE = 40;

const STATUS_LABELS: Record<HealthStatus, string> = {
  "no-data": "Sem dados",
  healthy: "Saudável",
  attention: "Atenção",
  risk: "Em risco",
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const percent = (ratio: number) => Math.round(ratio * 100);

// ------------------------------------------------------------------ as áreas

/** Saldo do mês: quanto da receita sobrou (ou faltou). */
function cashflowPillar(income: number, expense: number): HealthPillar | null {
  if (income <= 0) {
    if (expense <= 0) return null;
    return {
      id: "cashflow",
      label: LABELS.cashflow,
      score: 0,
      detail: "Há gastos no mês e nenhuma receita registrada.",
    };
  }

  const rate = (income - expense) / income;
  let score: number;
  if (rate >= GOOD_SAVINGS_RATE) score = 100;
  else if (rate >= 0) score = 60 + (rate / GOOD_SAVINGS_RATE) * 40;
  else score = 60 + rate * 120; // gastar 50% além da receita zera a nota

  let detail: string;
  if (rate >= GOOD_SAVINGS_RATE) {
    detail = `Sobrou ${percent(rate)}% da receita do mês.`;
  } else if (percent(rate) === 0) {
    detail = "Você gastou praticamente tudo o que recebeu no mês.";
  } else if (rate > 0) {
    detail = `Sobrou só ${percent(rate)}% da receita do mês (o ideal é a partir de ${percent(GOOD_SAVINGS_RATE)}%).`;
  } else {
    detail = `Você gastou ${percent(-rate)}% a mais do que recebeu no mês.`;
  }

  return { id: "cashflow", label: LABELS.cashflow, score: clamp(score), detail };
}

/** Orçamento do mês: quanto dele já foi usado. */
function budgetPillar(expense: number, budget: number): HealthPillar {
  const usage = expense / budget;
  let score: number;
  if (usage <= BUDGET_WARNING_USAGE) score = 100;
  else if (usage <= 1) score = 100 - ((usage - BUDGET_WARNING_USAGE) / (1 - BUDGET_WARNING_USAGE)) * 40;
  else score = 60 - (usage - 1) * 120; // estourar em 50% zera a nota

  let detail: string;
  if (usage > 1) detail = `Você estourou o orçamento do mês em ${formatCurrency(expense - budget)}.`;
  else if (usage === 1) detail = "Você usou todo o orçamento do mês.";
  else if (usage > BUDGET_WARNING_USAGE) detail = `Você já usou ${Math.floor(usage * 100)}% do orçamento: perto do limite.`;
  else detail = `Você usou ${Math.floor(usage * 100)}% do orçamento do mês.`;

  return { id: "budget", label: LABELS.budget, score: clamp(score), detail };
}

/** Dívidas a pagar em aberto, em relação à receita do mês, com desconto para as vencidas. */
function debtsPillar(borrowed: DebtRow[], income: number, today: Date): HealthPillar {
  const total = borrowed.reduce((sum, debt) => sum + debt.amount, 0);
  if (borrowed.length === 0 || total <= 0) {
    return { id: "debts", label: LABELS.debts, score: 100, detail: "Nenhuma dívida a pagar em aberto." };
  }

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const overdue = borrowed.filter((debt) => {
    const due = parseDueDate(debt.due_date);
    return due !== null && due < todayStart;
  }).length;

  let score: number;
  if (income > 0) {
    const ratio = total / income;
    if (ratio <= DEBT_COMFORTABLE_RATIO) score = 100;
    else if (ratio <= 1) score = 100 - ((ratio - DEBT_COMFORTABLE_RATIO) / (1 - DEBT_COMFORTABLE_RATIO)) * 60;
    else score = 40 - (ratio - 1) * 40;
  } else {
    score = DEBT_NO_INCOME_SCORE;
  }
  score -= Math.min(DEBT_OVERDUE_PENALTY_CAP, overdue * DEBT_OVERDUE_PENALTY);

  const share = income > 0 ? ` (${percent(total / income)}% da receita do mês)` : "";
  const late = overdue > 0 ? `, ${overdue} ${overdue === 1 ? "vencida" : "vencidas"}` : "";
  return {
    id: "debts",
    label: LABELS.debts,
    score: clamp(score),
    detail: `Você deve ${formatCurrency(total)}${share}${late}.`,
  };
}

// ---------------------------------------------------------------- nota geral

export interface HealthInput {
  /** Receitas e despesas do mês mostrado (as mesmas do saldo do Início). */
  income: number;
  expense: number;
  /** Orçamento do mês; null quando não foi definido. */
  budget: number | null;
  /** Dívidas pendentes (das duas direções: a pagar e a receber). */
  pendingDebts: DebtRow[];
  /** As dívidas em aberto são "de agora": só entram na nota do mês atual. */
  includeDebts: boolean;
  today?: Date;
}

export function computeFinancialHealth(input: HealthInput): FinancialHealth {
  const { income, expense, budget, pendingDebts, includeDebts, today = new Date() } = input;
  const hasActivity = income > 0 || expense > 0;
  const hints: string[] = [];
  const pillars: HealthPillar[] = [];

  const cashflow = cashflowPillar(income, expense);
  if (cashflow) pillars.push(cashflow);

  if (hasActivity) {
    if (budget !== null && budget > 0) pillars.push(budgetPillar(expense, budget));
    else hints.push("Defina o orçamento do mês para ele entrar na nota.");
  }

  if (includeDebts) {
    const borrowed = pendingDebts.filter((debt) => debt.type === "borrowed");
    // Sem nada para avaliar no mês e sem dívida a pagar, "sem dívidas" sozinho não diz nada.
    if (hasActivity || borrowed.length > 0) pillars.push(debtsPillar(borrowed, income, today));

    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const lateToReceive = pendingDebts.filter((debt) => {
      const due = parseDueDate(debt.due_date);
      return debt.type === "lent" && due !== null && due < todayStart;
    }).length;
    if (lateToReceive > 0) {
      hints.push(
        `${lateToReceive} ${lateToReceive === 1 ? "cobrança" : "cobranças"} a receber em atraso (não entra na nota).`,
      );
    }
  } else {
    hints.push("As dívidas em aberto só entram na nota do mês atual.");
  }

  if (pillars.length === 0) {
    return {
      status: "no-data",
      statusLabel: STATUS_LABELS["no-data"],
      score: null,
      headline: "Registre receitas e despesas para ver a nota do mês.",
      pillars,
      hints,
    };
  }

  const weightSum = pillars.reduce((sum, pillar) => sum + WEIGHTS[pillar.id], 0);
  const score = Math.round(pillars.reduce((sum, pillar) => sum + pillar.score * WEIGHTS[pillar.id], 0) / weightSum);
  const weakest = pillars.reduce((worst, pillar) => (pillar.score < worst.score ? pillar : worst));

  let status: HealthStatus;
  if (score >= HEALTHY_MIN) status = "healthy";
  else if (score >= ATTENTION_MIN) status = "attention";
  else status = "risk";
  // Uma área em risco não some na média: o mês não fica "Saudável" com ela.
  if (status === "healthy" && weakest.score < WEAK_PILLAR_MAX) status = "attention";

  return {
    status,
    statusLabel: STATUS_LABELS[status],
    score,
    headline: status === "healthy" ? "As finanças do mês estão em ordem." : weakest.detail,
    pillars,
    hints,
  };
}
