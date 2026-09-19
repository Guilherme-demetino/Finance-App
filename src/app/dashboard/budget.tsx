import { useState } from "react";
import Animated, {
  useAnimatedScrollHandler,
} from "react-native-reanimated";

import { CategoryBudgetsCard } from "../../components/CategoryBudgetsCard";
import { MonthlyBudgetCard } from "../../components/MonthlyBudgetCard";
import { SavingsGoalsCard } from "../../components/SavingsGoalsCard";

import { useBudgetActions, useBudgetData } from "../../context/BudgetContext";
import { useScrollY } from "../../context/DashboardUiContext";
import { useSavingsContext } from "../../context/SavingsContext";
import { useTransactionsData } from "../../context/TransactionsContext";
import { styles } from "../../styles/dashboardStyles";
import { formatCurrencyInput } from "../../utils/currency";

export default function DashboardBudgetScreen() {
  const { totalExpense } = useTransactionsData();
  const {
    budget,
    updateBudget,
    categoryBudgets,
    isLoadingCategoryBudgets,
    saveCategoryGoal,
    refreshCategoryBudgets,
  } = useBudgetData();
  const { handleDeleteCategory } = useBudgetActions();
  const {
    savingsGoals,
    isLoadingSavings,
    setIsSavingsModalOpen,
    setDepositGoal,
    handleDeleteSavingsGoal,
  } = useSavingsContext();
  const scrollY = useScrollY();
  // Só o cartão de orçamento usa esse estado, então não precisa ficar num contexto.
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  return (
    <Animated.ScrollView
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.scrollContent, { paddingTop: 10 }]}
    >
      <MonthlyBudgetCard
        budget={budget}
        totalExpense={totalExpense}
        isEditingBudget={isEditingBudget}
        setIsEditingBudget={setIsEditingBudget}
        onSaveBudget={updateBudget}
        formatCurrency={formatCurrencyInput}
      />

      <CategoryBudgetsCard
        items={categoryBudgets}
        isLoading={isLoadingCategoryBudgets}
        onSaveGoal={saveCategoryGoal}
        onCategoryCreated={refreshCategoryBudgets}
        onDeleteCategory={handleDeleteCategory}
        formatCurrency={formatCurrencyInput}
      />

      <SavingsGoalsCard
        goals={savingsGoals}
        isLoading={isLoadingSavings}
        onOpenCreate={() => setIsSavingsModalOpen(true)}
        onOpenDeposit={setDepositGoal}
        onDelete={handleDeleteSavingsGoal}
      />
    </Animated.ScrollView>
  );
}
