import Animated, {
  useAnimatedScrollHandler,
} from "react-native-reanimated";

import { AnnualPanoramaCard } from "../../components/AnnualPanoramaCard";
import { BalanceCard } from "../../components/BalanceCard";
import { GeneralBalanceCard } from "../../components/GeneralBalanceCard";
import { MonthlyBudgetCard } from "../../components/MonthlyBudgetCard";
import { SummaryCards } from "../../components/SummaryCards";

import { useDashboardContext } from "../../context/DashboardContext";
import { styles } from "../../styles/dashboardStyles";
import { formatCurrencyInput } from "../../utils/currency";

export default function DashboardHomeScreen() {
  const {
    totalBalance,
    selectedMonth,
    selectedYear,
    totalIncome,
    totalExpense,
    budget,
    isEditingBudget,
    setIsEditingBudget,
    updateBudget,
    formattedTransactions,
    openLandscapePanorama,
    scrollY,
  } = useDashboardContext();

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  return (
    <Animated.ScrollView
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.scrollContent, { paddingTop: 10 }]}
    >
      <BalanceCard
        totalBalance={totalBalance}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      <SummaryCards totalIncome={totalIncome} totalExpense={totalExpense} />

      <MonthlyBudgetCard
        budget={budget}
        totalExpense={totalExpense}
        isEditingBudget={isEditingBudget}
        setIsEditingBudget={setIsEditingBudget}
        onSaveBudget={updateBudget}
        formatCurrency={formatCurrencyInput}
      />

      <GeneralBalanceCard
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        transactions={formattedTransactions}
      />

      <AnnualPanoramaCard onPress={openLandscapePanorama} />
    </Animated.ScrollView>
  );
}
