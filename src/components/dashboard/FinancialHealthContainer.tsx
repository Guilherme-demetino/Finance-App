import { useBudgetData } from "../../context/BudgetContext";
import { useDebtsContext } from "../../context/DebtsContext";
import { usePeriod } from "../../context/PeriodContext";
import { useTransactionsData } from "../../context/TransactionsContext";
import { computeFinancialHealth } from "../../utils/financialHealth";
import { MONTH_NAMES } from "../../utils/dates";
import { FinancialHealthCard } from "../FinancialHealthCard";

/**
 * Liga a saúde financeira aos dados do painel: receita e despesa do mês mostrado,
 * orçamento e dívidas em aberto. As dívidas são "de agora", então só entram na
 * nota quando o mês mostrado é o atual.
 */
export function FinancialHealthContainer() {
  const { selectedMonth, selectedYear } = usePeriod();
  const { totalIncome, totalExpense } = useTransactionsData();
  const { budget } = useBudgetData();
  const { pendingDebts } = useDebtsContext();

  const now = new Date();
  const isCurrentPeriod =
    selectedMonth === MONTH_NAMES[now.getMonth()] && selectedYear === String(now.getFullYear());

  const health = computeFinancialHealth({
    income: totalIncome,
    expense: totalExpense,
    budget,
    pendingDebts,
    includeDebts: isCurrentPeriod,
  });

  return <FinancialHealthCard health={health} />;
}
