import Animated, {
  useAnimatedScrollHandler,
} from "react-native-reanimated";

import { CategoryBudgetsCard } from "../../components/CategoryBudgetsCard";
import { MonthlyBudgetCard } from "../../components/MonthlyBudgetCard";

import { useDashboardContext } from "../../context/DashboardContext";
import { styles } from "../../styles/dashboardStyles";
import { formatCurrencyInput } from "../../utils/currency";

export default function DashboardBudgetScreen() {
  const {
    budget,
    totalExpense,
    isEditingBudget,
    setIsEditingBudget,
    updateBudget,
    categoryBudgets,
    isLoadingCategoryBudgets,
    saveCategoryGoal,
    handleDeleteCategory,
    refreshCategoryBudgets,
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
    </Animated.ScrollView>
  );
}
