import { useEffect, useState } from "react";
import { colors } from "../constants/colors";
import { getAllCategories } from "../database/categories";
import { getCategoryBudgets, setCategoryBudget } from "../database/categoryBudgets";
import type { EnrichedTransaction } from "../types";
import { getMonthNumber } from "../utils/dates";
import { DEFAULT_CATEGORY_COLORS } from "./useTransactions";

export interface CategoryBudgetItem {
  category: string;
  color: string;
  spent: number;
  goal: number | null;
}

/**
 * Cruza as categorias de despesa cadastradas com o quanto já foi gasto em
 * cada uma no mês/ano selecionado e a meta (se houver) definida para o
 * período — usado pela lista de metas por categoria no Orçamento.
 */
export function useCategoryBudgets(
  selectedMonth: string,
  selectedYear: string,
  transactions: EnrichedTransaction[],
) {
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudgetItem[]>(
    [],
  );
  const [isLoadingCategoryBudgets, setIsLoadingCategoryBudgets] =
    useState(true);

  const refresh = async () => {
    setIsLoadingCategoryBudgets(true);
    try {
      const [categories, budgetRows] = await Promise.all([
        getAllCategories(),
        getCategoryBudgets(getMonthNumber(selectedMonth), selectedYear),
      ]);

      const goalsByCategory: Record<string, number> = {};
      budgetRows.forEach((row) => {
        goalsByCategory[row.category.trim().toLowerCase()] = row.amount;
      });

      const spentByCategory: Record<string, number> = {};
      const displayNameByKey: Record<string, string> = {};
      transactions.forEach((item) => {
        if (item.type !== "expense") return;
        const raw = (item.category_id || "").trim();
        if (!raw) return;
        const key = raw.toLowerCase();
        spentByCategory[key] = (spentByCategory[key] || 0) + item.amount;
        if (!displayNameByKey[key]) displayNameByKey[key] = raw;
      });

      const expenseCategories = categories.filter(
        (cat) => cat.type === "expense",
      );

      const merged: CategoryBudgetItem[] = expenseCategories.map((cat) => {
        const key = cat.name.trim().toLowerCase();
        return {
          category: cat.name,
          color: cat.color || DEFAULT_CATEGORY_COLORS[key] || colors.categoryNeutral,
          spent: spentByCategory[key] || 0,
          goal: goalsByCategory[key] ?? null,
        };
      });

      // Categorias usadas em transações mas que não existem (mais) na
      // tabela categories — ainda mostramos se tiverem gasto ou meta.
      Object.keys(spentByCategory).forEach((key) => {
        const alreadyListed = merged.some(
          (item) => item.category.trim().toLowerCase() === key,
        );
        if (!alreadyListed) {
          merged.push({
            category: displayNameByKey[key],
            color: DEFAULT_CATEGORY_COLORS[key] || colors.categoryNeutral,
            spent: spentByCategory[key],
            goal: goalsByCategory[key] ?? null,
          });
        }
      });

      // Categorias com meta definida primeiro, depois as com maior gasto.
      merged.sort((a, b) => {
        if (!!a.goal !== !!b.goal) return a.goal ? -1 : 1;
        return b.spent - a.spent;
      });

      setCategoryBudgets(merged);
    } catch (error) {
      console.log("Erro ao buscar metas por categoria:", error);
    } finally {
      setIsLoadingCategoryBudgets(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh não é memoizada, roda quando período ou transações mudam
  }, [selectedMonth, selectedYear, transactions]);

  const saveCategoryGoal = async (category: string, amount: number) => {
    await setCategoryBudget(
      category,
      getMonthNumber(selectedMonth),
      selectedYear,
      amount,
    );
    await refresh();
  };

  return {
    categoryBudgets,
    isLoadingCategoryBudgets,
    saveCategoryGoal,
    refreshCategoryBudgets: refresh,
  };
}
