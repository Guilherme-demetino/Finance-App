import { formatCurrency } from "./currency";
import { parseDateString } from "./dates";

/**
 * Ritmo e projeção das metas de economia: quando a meta é atingida se você continuar guardando no ritmo de até agora,
 * e se isso cai dentro do prazo.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const AVG_MONTH_DAYS = 30.4375;
/** Dias de meta antes de projetar: com menos histórico que isso o "ritmo" seria só chute. */
export const MIN_DAYS_FOR_PACE = 14;
/** Acima disso a projeção não ajuda (uma meta que levaria décadas): diz só que o ritmo é baixo demais. */
const MAX_PROJECTED_MONTHS = 600;

export interface SavingsGoalFacts {
  saved_amount: number;
  target_amount: number;
  /** Quanto já estava guardado quando a meta foi criada: não conta como ritmo. */
  start_amount: number;
  /** DD/MM/AAAA */
  created_date: string;
  deadline: string | null;
}

export type SavingsOutlook =
  | { kind: "done" }
  /** A meta é nova demais para calcular um ritmo. */
  | { kind: "too-early"; daysLeft: number }
  /** Nada foi guardado desde que a meta foi criada. */
  | { kind: "no-progress" }
  | { kind: "too-slow" }
  | {
      kind: "projected";
      /** Quanto foi guardado por mês, em média, desde a criação da meta. */
      monthlyPace: number;
      /** Quando a meta é atingida se o ritmo continuar. */
      projectedDate: Date;
      /** Contra o prazo: dentro dele ou depois; null quando a meta não tem prazo. */
      deadlineStatus: "on-track" | "behind" | null;
      /** Meses de atraso em relação ao prazo (0 quando dentro do prazo ou sem prazo). */
      monthsLate: number;
    };

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Dias inteiros entre dois dias do calendário (imune a horário de verão). */
function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY_MS);
}

/**
 * Quando a meta é atingida no ritmo atual: o que foi guardado desde a criação da meta (sem o valor que já estava lá no
 * começo), dividido pelo tempo que passou. O ritmo é a média desde o início, então um mês ruim não derruba a projeção
 * de uma vez.
 */
export function savingsOutlook(goal: SavingsGoalFacts, today: Date = new Date()): SavingsOutlook {
  if (goal.target_amount > 0 && goal.saved_amount >= goal.target_amount) return { kind: "done" };

  const now = startOfDay(today);
  const elapsedDays = Math.max(0, daysBetween(parseDateString(goal.created_date), now));
  if (elapsedDays < MIN_DAYS_FOR_PACE) return { kind: "too-early", daysLeft: MIN_DAYS_FOR_PACE - elapsedDays };

  const gained = goal.saved_amount - goal.start_amount;
  if (!(gained > 0)) return { kind: "no-progress" };

  const monthlyPace = gained / (elapsedDays / AVG_MONTH_DAYS);
  const monthsToGo = (goal.target_amount - goal.saved_amount) / monthlyPace;
  if (monthsToGo > MAX_PROJECTED_MONTHS) return { kind: "too-slow" };

  const projectedDate = startOfDay(new Date(now.getTime() + Math.ceil(monthsToGo * AVG_MONTH_DAYS) * DAY_MS));
  if (!goal.deadline) return { kind: "projected", monthlyPace, projectedDate, deadlineStatus: null, monthsLate: 0 };

  const deadline = startOfDay(parseDateString(goal.deadline));
  if (projectedDate.getTime() <= deadline.getTime()) {
    return { kind: "projected", monthlyPace, projectedDate, deadlineStatus: "on-track", monthsLate: 0 };
  }
  const monthsLate = Math.max(1, Math.ceil(daysBetween(deadline, projectedDate) / AVG_MONTH_DAYS));
  return { kind: "projected", monthlyPace, projectedDate, deadlineStatus: "behind", monthsLate };
}

/**
 * Quanto da meta já deveria estar guardado hoje para chegar no prazo em linha reta, de 0 a 100 (do valor da meta).
 * null sem prazo, ou quando o prazo não vem depois da criação.
 */
export function expectedSavingsPercent(goal: SavingsGoalFacts, today: Date = new Date()): number | null {
  if (!goal.deadline || goal.target_amount <= 0) return null;
  const created = startOfDay(parseDateString(goal.created_date));
  const deadline = startOfDay(parseDateString(goal.deadline));
  const total = daysBetween(created, deadline);
  if (total <= 0) return null;

  const fraction = Math.min(1, Math.max(0, daysBetween(created, startOfDay(today)) / total));
  const expected = goal.start_amount + (goal.target_amount - goal.start_amount) * fraction;
  return Math.min(100, Math.max(0, (expected / goal.target_amount) * 100));
}

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "jan/2027". */
export function formatMonthYear(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]}/${date.getFullYear()}`;
}

export interface OutlookText {
  text: string;
  /** "good": no prazo; "bad": atrasada; "muted": ainda sem projeção. */
  tone: "good" | "bad" | "muted";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A frase da projeção que aparece na meta; null quando a meta já foi alcançada. */
export function describeOutlook(outlook: SavingsOutlook): OutlookText | null {
  switch (outlook.kind) {
    case "done":
      return null;
    case "too-early":
      return {
        text: `A projeção aparece depois de ${MIN_DAYS_FOR_PACE} dias de meta (faltam ${plural(outlook.daysLeft, "dia", "dias")}).`,
        tone: "muted",
      };
    case "no-progress":
      return { text: "Ainda sem depósitos: guarde algo para ver quando a meta será atingida.", tone: "muted" };
    case "too-slow":
      return { text: "No ritmo atual a meta levaria décadas: aumente o quanto guarda por mês.", tone: "bad" };
    case "projected": {
      const base = `No ritmo atual (${formatCurrency(outlook.monthlyPace)}/mês) você chega lá em ${formatMonthYear(outlook.projectedDate)}`;
      if (outlook.deadlineStatus === "on-track") return { text: `${base}, dentro do prazo.`, tone: "good" };
      if (outlook.deadlineStatus === "behind") {
        return { text: `${base}, ${plural(outlook.monthsLate, "mês", "meses")} depois do prazo.`, tone: "bad" };
      }
      return { text: `${base}.`, tone: "muted" };
    }
  }
}
