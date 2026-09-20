import Animated, {
  useAnimatedScrollHandler,
} from "react-native-reanimated";

import { AlertsCard } from "../../components/AlertsCard";
import { AnnualPanoramaCard } from "../../components/AnnualPanoramaCard";
import { BalanceCard } from "../../components/BalanceCard";
import { GeneralBalanceCard } from "../../components/GeneralBalanceCard";
import { MonthComparisonCard } from "../../components/MonthComparisonCard";
import { MonthProjectionCard } from "../../components/MonthProjectionCard";
import { SummaryCards } from "../../components/SummaryCards";

import { useBudgetData } from "../../context/BudgetContext";
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
    includeSpendingAlerts: isCurrentPeriod,
  });
  const projection = isCurrentPeriod
    ? computeMonthProjection(transactions)
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

      <SummaryCards totalIncome={totalIncome} totalExpense={totalExpense} />

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
