import { createContext, useMemo, type ReactNode } from "react";

import { useStableCallback } from "../hooks/useStableCallback";
import { useBudget } from "../hooks/useBudget";
import { useCategoryBudgets } from "../hooks/useCategoryBudgets";
import { useMonthComparison } from "../hooks/useMonthComparison";
import { logError } from "../utils/logger";
import { useAccountFilter } from "./AccountFilterContext";
import { useAlert } from "./AlertContext";
import { usePeriod } from "./PeriodContext";
import { useTransactionsData } from "./TransactionsContext";
import { useRequiredContext } from "./useRequiredContext";

type BudgetHook = ReturnType<typeof useBudget>;
type CategoryBudgetsHook = ReturnType<typeof useCategoryBudgets>;
type ComparisonHook = ReturnType<typeof useMonthComparison>;

/** Orçamento do mês, metas por categoria e comparativo com o mês anterior. */
interface BudgetData {
  budget: BudgetHook["budget"];
  updateBudget: BudgetHook["updateBudget"];
  categoryBudgets: CategoryBudgetsHook["categoryBudgets"];
  isLoadingCategoryBudgets: boolean;
  saveCategoryGoal: CategoryBudgetsHook["saveCategoryGoal"];
  removeCategoryGoal: CategoryBudgetsHook["removeCategoryGoal"];
  refreshCategoryBudgets: CategoryBudgetsHook["refreshCategoryBudgets"];
  comparison: ComparisonHook["comparison"];
  isLoadingComparison: boolean;
}

/** Excluir categoria, com identidade fixa: o formulário de transação usa isso sem acompanhar os dados do orçamento. */
interface BudgetActions {
  handleDeleteCategory: (id: number) => Promise<void>;
}

const BudgetDataContext = createContext<BudgetData | null>(null);
const BudgetActionsContext = createContext<BudgetActions | null>(null);

export function BudgetProvider({ children }: { children: ReactNode }) {
  const { selectedMonth, selectedYear } = usePeriod();
  const { selectedAccount } = useAccountFilter();
  const { transactions } = useTransactionsData();
  const { showAlert } = useAlert();

  const { budget, updateBudget } = useBudget(selectedMonth, selectedYear);

  const {
    categoryBudgets,
    isLoadingCategoryBudgets,
    saveCategoryGoal,
    removeCategoryGoal,
    removeCategory,
    refreshCategoryBudgets,
  } = useCategoryBudgets(selectedMonth, selectedYear, transactions);

  const { comparison, isLoadingComparison } = useMonthComparison(
    selectedMonth,
    selectedYear,
    transactions,
    selectedAccount,
  );

  const handleDeleteCategory = useStableCallback(async (id: number) => {
    try {
      await removeCategory(id);
      showAlert("Sucesso", "Categoria excluída com sucesso.");
    } catch (error) {
      logError("Erro ao excluir categoria:", error);
      showAlert("Erro", "Não foi possível excluir a categoria.");
    }
  });
  const actions = useMemo(
    () => ({ handleDeleteCategory }),
    [handleDeleteCategory],
  );

  const data: BudgetData = {
    budget,
    updateBudget,
    categoryBudgets,
    isLoadingCategoryBudgets,
    saveCategoryGoal,
    removeCategoryGoal,
    refreshCategoryBudgets,
    comparison,
    isLoadingComparison,
  };

  return (
    <BudgetActionsContext.Provider value={actions}>
      <BudgetDataContext.Provider value={data}>
        {children}
      </BudgetDataContext.Provider>
    </BudgetActionsContext.Provider>
  );
}

export function useBudgetData() {
  return useRequiredContext(
    BudgetDataContext,
    "useBudgetData",
    "BudgetProvider",
  );
}

export function useBudgetActions() {
  return useRequiredContext(
    BudgetActionsContext,
    "useBudgetActions",
    "BudgetProvider",
  );
}
