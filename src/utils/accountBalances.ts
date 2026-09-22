import type { EnrichedTransaction } from "../types";
import { DEFAULT_ACCOUNT_NAME } from "../database/accounts";

export interface AccountBalance {
  account: string;
  income: number;
  expense: number;
  balance: number;
}

/**
 * Separa o saldo do período (já calculado pelo resto do app) por conta. Só faz sentido mostrar quando há mais de
 * uma conta em uso: com uma só, o saldo total já é a mesma coisa.
 */
export function groupBalancesByAccount(transactions: EnrichedTransaction[]): AccountBalance[] {
  const byAccount = new Map<string, AccountBalance>();

  for (const item of transactions) {
    const name = (item.account || "").trim() || DEFAULT_ACCOUNT_NAME;
    const current = byAccount.get(name) ?? { account: name, income: 0, expense: 0, balance: 0 };
    if (item.type === "income") current.income += item.amount;
    else current.expense += item.amount;
    current.balance = current.income - current.expense;
    byAccount.set(name, current);
  }

  return [...byAccount.values()].sort((a, b) => b.balance - a.balance);
}
