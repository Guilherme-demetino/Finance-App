import type { TransactionRow } from "../types";
import { formatCurrency } from "./currency";
import type { DueItem } from "./dueReminders";

export interface MonthBalanceData {
  balanceText: string;
  incomeText: string;
  expenseText: string;
  isPositive: boolean;
}

/** Saldo do mês (receitas - despesas) a partir das transações já filtradas por mês/ano; ignora transferências. */
export function computeMonthBalance(transactions: TransactionRow[]): MonthBalanceData {
  let income = 0;
  let expense = 0;
  for (const row of transactions) {
    if (row.transfer_group_id) continue;
    if (row.type === "income") income += row.amount;
    else expense += row.amount;
  }
  const balance = income - expense;
  return {
    balanceText: formatCurrency(balance),
    incomeText: formatCurrency(income),
    expenseText: formatCurrency(expense),
    isPositive: balance >= 0,
  };
}

export interface UpcomingBillItem {
  id: string;
  label: string;
  amountText: string;
  /** "hoje", "amanhã" ou "DD/MM". */
  whenText: string;
  /** true = dívida que emprestou (vão te pagar); false = conta/dívida que você paga. */
  isReceivable: boolean;
}

const MAX_UPCOMING_BILLS = 4;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dueWhenText(due: Date, today: Date): string {
  const days = Math.round((startOfDay(due).getTime() - startOfDay(today).getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "amanhã";
  return `${String(due.getDate()).padStart(2, "0")}/${String(due.getMonth() + 1).padStart(2, "0")}`;
}

/** As próximas contas a vencer prontas para o widget: as mais próximas primeiro, limitadas a um punhado. */
export function formatUpcomingBills(items: DueItem[], today: Date): UpcomingBillItem[] {
  return [...items]
    .sort((a, b) => a.due.getTime() - b.due.getTime())
    .slice(0, MAX_UPCOMING_BILLS)
    .map((item) => ({
      id: item.id,
      label: item.label,
      amountText: formatCurrency(item.amount),
      whenText: dueWhenText(item.due, today),
      isReceivable: item.kind === "receive",
    }));
}
