import type { TransactionType } from "../types";
import { parseDateString } from "./dates";

export interface MonthProjection {
  /** Saldo do que já aconteceu até hoje (inclusive). */
  currentBalance: number;
  /** Receitas/despesas do mês com data depois de hoje (fixas, parcelas, lançamentos futuros). */
  upcomingIncome: number;
  upcomingExpense: number;
  upcomingCount: number;
  /** Saldo esperado no fim do mês: o de hoje + o que ainda vai cair. */
  projectedBalance: number;
}

/**
 * Projeta o saldo do fim do mês a partir das transações do mês: o que tem
 * data até hoje já aconteceu; o que tem data depois de hoje ainda vai cair.
 */
export function computeMonthProjection(
  transactions: { date: string; type: TransactionType; amount: number }[],
  today: Date = new Date(),
): MonthProjection {
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();

  let currentBalance = 0;
  let upcomingIncome = 0;
  let upcomingExpense = 0;
  let upcomingCount = 0;

  transactions.forEach((t) => {
    const signed = t.type === "income" ? t.amount : -t.amount;
    const isUpcoming = parseDateString(t.date).getTime() > todayStart;

    if (isUpcoming) {
      upcomingCount++;
      if (t.type === "income") upcomingIncome += t.amount;
      else upcomingExpense += t.amount;
    } else {
      currentBalance += signed;
    }
  });

  return {
    currentBalance,
    upcomingIncome,
    upcomingExpense,
    upcomingCount,
    projectedBalance: currentBalance + upcomingIncome - upcomingExpense,
  };
}
