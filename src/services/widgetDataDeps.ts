import { getAllCardPayments, getAllCardPurchases, getAllCreditCards } from "../database/creditCards";
import { getAllDebts } from "../database/debts";
import { getRecurringExpenses, getTransactionsByMonth } from "../database/transactions";
import { unpaidInvoiceDues } from "../utils/creditCards";
import { collectDueItems } from "../utils/dueReminders";
import { computeMonthBalance, formatUpcomingBills, type MonthBalanceData, type UpcomingBillItem } from "../utils/widgetData";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Saldo do mês atual de verdade (não o que o painel estiver mostrando) — para o widget de tela inicial. */
export async function loadMonthBalance(): Promise<MonthBalanceData> {
  const now = new Date();
  const rows = await getTransactionsByMonth(pad(now.getMonth() + 1), String(now.getFullYear()));
  return computeMonthBalance(rows);
}

/** As próximas contas a vencer (dívidas, parcelas/recorrências e faturas de cartão) — para o widget de tela inicial. */
export async function loadUpcomingBills(): Promise<UpcomingBillItem[]> {
  const today = new Date();
  const [debts, transactions, cards, purchases, payments] = await Promise.all([
    getAllDebts(),
    getRecurringExpenses(),
    getAllCreditCards(),
    getAllCardPurchases(),
    getAllCardPayments(),
  ]);
  const invoices = unpaidInvoiceDues({ cards, purchases, payments, today });
  const items = collectDueItems({ debts, transactions, invoices, today });
  return formatUpcomingBills(items, today);
}
