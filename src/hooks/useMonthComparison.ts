import { useEffect, useState } from "react";
import { colors } from "../constants/colors";
import { getAllCategories } from "../database/categories";
import { getAllTransactions } from "../database/transactions";
import type { TransactionRow } from "../types";
import { getMonthNumber, getPreviousMonth } from "../utils/dates";
import { DEFAULT_CATEGORY_COLORS } from "./useTransactions";

export interface CategoryComparisonItem {
  category: string;
  color: string;
  current: number;
  previous: number;
  /** null quando não dá pra calcular variação percentual (mês anterior sem gasto nessa categoria). */
  changePercent: number | null;
}

export interface MonthComparisonResult {
  currentTotal: number;
  previousTotal: number;
  changePercent: number | null;
  previousMonthLabel: string;
  categories: CategoryComparisonItem[];
  hasPreviousData: boolean;
}

function sumExpensesByCategory(
  transactions: TransactionRow[],
): Record<string, number> {
  const map: Record<string, number> = {};
  transactions.forEach((t) => {
    const key = (t.category_id || "Outros").trim().toLowerCase();
    map[key] = (map[key] || 0) + t.amount;
  });
  return map;
}

/**
 * Compara os gastos do mês/ano selecionado com o mês anterior, no total e
 * por categoria — reaproveita as transações já existentes no banco, sem
 * precisar de nenhuma tabela nova.
 */
export function useMonthComparison(selectedMonth: string, selectedYear: string) {
  const [comparison, setComparison] = useState<MonthComparisonResult | null>(
    null,
  );
  const [isLoadingComparison, setIsLoadingComparison] = useState(true);

  const refresh = async () => {
    setIsLoadingComparison(true);
    try {
      const [allTransactions, categories] = await Promise.all([
        getAllTransactions(),
        getAllCategories(),
      ]);

      const categoryColorMap: Record<string, string> = {
        ...DEFAULT_CATEGORY_COLORS,
      };
      categories.forEach((cat) => {
        if (cat.name) {
          categoryColorMap[cat.name.trim().toLowerCase()] = cat.color;
        }
      });

      const { month: prevMonth, year: prevYear } = getPreviousMonth(
        selectedMonth,
        selectedYear,
      );
      const currentMonthNumber = getMonthNumber(selectedMonth);
      const prevMonthNumber = getMonthNumber(prevMonth);

      const currentExpenses = allTransactions.filter(
        (t) =>
          t.type === "expense" &&
          t.date.includes(`/${currentMonthNumber}/${selectedYear}`),
      );
      const previousExpenses = allTransactions.filter(
        (t) =>
          t.type === "expense" &&
          t.date.includes(`/${prevMonthNumber}/${prevYear}`),
      );

      const currentTotal = currentExpenses.reduce((sum, t) => sum + t.amount, 0);
      const previousTotal = previousExpenses.reduce(
        (sum, t) => sum + t.amount,
        0,
      );

      const changePercent =
        previousTotal > 0
          ? ((currentTotal - previousTotal) / previousTotal) * 100
          : null;

      const currentByCategory = sumExpensesByCategory(currentExpenses);
      const previousByCategory = sumExpensesByCategory(previousExpenses);

      const displayNameByKey: Record<string, string> = {};
      [...currentExpenses, ...previousExpenses].forEach((t) => {
        const raw = (t.category_id || "Outros").trim();
        const key = raw.toLowerCase();
        if (!displayNameByKey[key]) displayNameByKey[key] = raw;
      });

      const allKeys = new Set([
        ...Object.keys(currentByCategory),
        ...Object.keys(previousByCategory),
      ]);

      const categoryItems: CategoryComparisonItem[] = Array.from(allKeys).map(
        (key) => {
          const current = currentByCategory[key] || 0;
          const previous = previousByCategory[key] || 0;
          return {
            category: displayNameByKey[key] || key,
            color: categoryColorMap[key] || colors.categoryNeutral,
            current,
            previous,
            changePercent: previous > 0 ? ((current - previous) / previous) * 100 : null,
          };
        },
      );

      // Categorias que mais pesaram na mudança do mês primeiro.
      categoryItems.sort(
        (a, b) =>
          Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous),
      );

      setComparison({
        currentTotal,
        previousTotal,
        changePercent,
        previousMonthLabel: `${prevMonth} de ${prevYear}`,
        categories: categoryItems,
        hasPreviousData: previousExpenses.length > 0,
      });
    } catch (error) {
      console.log("Erro ao calcular comparativo mensal:", error);
    } finally {
      setIsLoadingComparison(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh não é memoizada, roda só quando o período muda
  }, [selectedMonth, selectedYear]);

  return { comparison, isLoadingComparison };
}
