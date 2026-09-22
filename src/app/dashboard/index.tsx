import Animated, {
  useAnimatedScrollHandler,
} from "react-native-reanimated";

import { AccountBalancesCard } from "../../components/overview/AccountBalancesCard";
import { AlertsCard } from "../../components/overview/AlertsCard";
import { AnnualPanoramaCard } from "../../components/overview/AnnualPanoramaCard";
import { BalanceCard } from "../../components/overview/BalanceCard";
import { GeneralBalanceCard } from "../../components/overview/GeneralBalanceCard";
import { MonthComparisonCard } from "../../components/overview/MonthComparisonCard";
import { MonthProjectionCard } from "../../components/overview/MonthProjectionCard";
import { SummaryCards } from "../../components/overview/SummaryCards";
import { FinancialHealthContainer } from "../../components/dashboard/FinancialHealthContainer";
import { SubscriptionsCard } from "../../components/subscriptions/SubscriptionsCard";

import { useBudgetData } from "../../context/BudgetContext";
import { useCardsContext } from "../../context/CardsContext";
import { useDebtsContext } from "../../context/DebtsContext";
import { usePanorama, useScrollY } from "../../context/DashboardUiContext";
import { usePeriod } from "../../context/PeriodContext";
import { useTransactionsData } from "../../context/TransactionsContext";
import { useDashboardStyles } from "../../styles/dashboardStyles";
import { buildAlerts } from "../../utils/alerts";
import { MONTH_NAMES } from "../../utils/dates";
import { computeMonthProjection } from "../../utils/monthProjection";

export default function DashboardHomeScreen() {
  const styles = useDashboardStyles();
  const { selectedMonth, selectedYear } = usePeriod();
  const {
    totalBalance,
    totalIncome,
    totalExpense,
    formattedTransactions,
    transactions,
  } = useTransactionsData();
  const { budget, categoryBudgets, comparison, isLoadingComparison } =
    useBudgetData();
  const { pendingDebts } = useDebtsContext();
  const { invoiceDues } = useCardsContext();
  const { openLandscapePanorama } = usePanorama();
  const scrollY = useScrollY();

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  // Previsão e avisos de gasto só fazem sentido no mês em curso.
  const now = new Date();
  const isCurrentPeriod =
    selectedMonth === MONTH_NAMES[now.getMonth()] &&
    selectedYear === String(now.getFullYear());

  const alerts = buildAlerts({
    budget,
    totalExpense,
    categories: categoryBudgets,
    pendingDebts,
    invoices: invoiceDues,
    includeSpendingAlerts: isCurrentPeriod,
  });
  // Transferência entre contas não é receita nem despesa de verdade: fora da projeção do saldo.
  const projection = isCurrentPeriod
    ? computeMonthProjection(transactions.filter((item) => !item.transfer_group_id))
    : null;

  return (
    <Animated.ScrollView
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.scrollContent, { paddingTop: 10 }]}
    >
      <AlertsCard alerts={alerts} />

      <BalanceCard
        totalBalance={totalBalance}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      <AccountBalancesCard transactions={transactions} />

      <SummaryCards totalIncome={totalIncome} totalExpense={totalExpense} />

      <FinancialHealthContainer />

      <SubscriptionsCard />

      {projection ? <MonthProjectionCard projection={projection} /> : null}

      <GeneralBalanceCard
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        transactions={formattedTransactions}
      />

      <MonthComparisonCard
        comparison={comparison}
        isLoading={isLoadingComparison}
        selectedMonth={selectedMonth}
      />

      <AnnualPanoramaCard onPress={openLandscapePanorama} />
    </Animated.ScrollView>
  );
}
