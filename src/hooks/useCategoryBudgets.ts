import { useEffect, useState } from "react";
import { CATEGORY_COLORS } from "../constants/colors";
import { deleteCategory, getAllCategories } from "../database/categories";
import {
  getCategoryBudgets,
  removeCategoryBudget,
  setCategoryBudget,
} from "../database/categoryBudgets";
import type { EnrichedTransaction } from "../types";
import { getMonthNumber } from "../utils/dates";
import { DEFAULT_CATEGORY_COLORS } from "./useTransactions";
import { logError } from "../utils/logger";

export interface CategoryBudgetItem {
  /** null quando a categoria não existe (mais) na tabela categories — só apareceu por causa de transações/meta antigas. */
  id: number | null;
  category: string;
  color: string;
  spent: number;
  goal: number | null;
  /** A meta atual repete nos meses seguintes (foi definida assim, ou é herdada de um mês anterior)? Sem meta, false. */
  repeatMonthly: boolean;
}

async function buildCategoryBudgets(
  selectedMonth: string,
  selectedYear: string,
  transactions: EnrichedTransaction[],
): Promise<CategoryBudgetItem[]> {
  const [categories, budgetRows] = await Promise.all([
    getAllCategories(),
    getCategoryBudgets(getMonthNumber(selectedMonth), selectedYear),
  ]);

  const goalsByCategory: Record<string, number> = {};
  const repeatByCategory: Record<string, boolean> = {};
  budgetRows.forEach((row) => {
    const key = row.category.trim().toLowerCase();
    goalsByCategory[key] = row.amount;
    repeatByCategory[key] = row.repeat_monthly === 1;
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
      id: cat.id,
      category: cat.name,
      color: cat.color || DEFAULT_CATEGORY_COLORS[key] || CATEGORY_COLORS.categoryNeutral,
      spent: spentByCategory[key] || 0,
      goal: goalsByCategory[key] ?? null,
      repeatMonthly: repeatByCategory[key] ?? false,
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
        id: null,
        category: displayNameByKey[key],
        color: DEFAULT_CATEGORY_COLORS[key] || CATEGORY_COLORS.categoryNeutral,
        spent: spentByCategory[key],
        goal: goalsByCategory[key] ?? null,
        repeatMonthly: repeatByCategory[key] ?? false,
      });
    }
  });

  // Categorias com meta definida primeiro, depois as com maior gasto.
  merged.sort((a, b) => {
    if (!!a.goal !== !!b.goal) return a.goal ? -1 : 1;
    return b.spent - a.spent;
  });

  return merged;
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
      setCategoryBudgets(
        await buildCategoryBudgets(selectedMonth, selectedYear, transactions),
      );
    } catch (error) {
      logError("Erro ao buscar metas por categoria:", error);
    } finally {
      setIsLoadingCategoryBudgets(false);
    }
  };

  // Mudou o período ou as transações: volta pra "carregando" já nesta
  // renderização, sem setState dentro do effect.
  const [loadedFor, setLoadedFor] = useState({
    selectedMonth,
    selectedYear,
    transactions,
  });
  if (
    loadedFor.selectedMonth !== selectedMonth ||
    loadedFor.selectedYear !== selectedYear ||
    loadedFor.transactions !== transactions
  ) {
    setLoadedFor({ selectedMonth, selectedYear, transactions });
    setIsLoadingCategoryBudgets(true);
  }

  useEffect(() => {
    let cancelled = false;
    buildCategoryBudgets(selectedMonth, selectedYear, transactions)
      .then((items) => {
        if (!cancelled) setCategoryBudgets(items);
      })
      .catch((error) => logError("Erro ao buscar metas por categoria:", error))
      .finally(() => {
        if (!cancelled) setIsLoadingCategoryBudgets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, selectedYear, transactions]);

  /** `repeat` marca se a meta vale também nos meses seguintes, até ser mudada ou removida. */
  const saveCategoryGoal = async (category: string, amount: number, repeat: boolean) => {
    await setCategoryBudget(
      category,
      getMonthNumber(selectedMonth),
      selectedYear,
      amount,
      repeat,
    );
    await refresh();
  };

  /** Tira a meta da categoria no mês/ano selecionado (a categoria e os gastos continuam). */
  const removeCategoryGoal = async (category: string) => {
    await removeCategoryBudget(
      category,
      getMonthNumber(selectedMonth),
      selectedYear,
    );
    await refresh();
  };

  const removeCategory = async (id: number) => {
    await deleteCategory(id);
    await refresh();
  };

  return {
    categoryBudgets,
    isLoadingCategoryBudgets,
    saveCategoryGoal,
    removeCategoryGoal,
    removeCategory,
    refreshCategoryBudgets: refresh,
  };
}
