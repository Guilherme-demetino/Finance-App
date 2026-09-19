import { useEffect, useState } from "react";
import { colors } from "../constants/colors";
import { getAllCategories } from "../database/categories";
import { getTransactionsByMonth } from "../database/transactions";
import type { EnrichedTransaction, TransactionRow } from "../types";
import { getMonthNumber, getPreviousMonth } from "../utils/dates";
import { DEFAULT_CATEGORY_COLORS } from "./useTransactions";

interface CategoryComparisonItem {
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

async function buildComparison(
  selectedMonth: string,
  selectedYear: string,
): Promise<MonthComparisonResult> {
  const { month: prevMonth, year: prevYear } = getPreviousMonth(
    selectedMonth,
    selectedYear,
  );
  const currentMonthNumber = getMonthNumber(selectedMonth);
  const prevMonthNumber = getMonthNumber(prevMonth);

  // Só os dois meses comparados, em vez do histórico inteiro.
  const [currentMonthRows, previousMonthRows, categories] = await Promise.all([
    getTransactionsByMonth(currentMonthNumber, selectedYear),
    getTransactionsByMonth(prevMonthNumber, prevYear),
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

  const currentExpenses = currentMonthRows.filter((t) => t.type === "expense");
  const previousExpenses = previousMonthRows.filter(
    (t) => t.type === "expense",
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

  return {
    currentTotal,
    previousTotal,
    changePercent,
    previousMonthLabel: `${prevMonth} de ${prevYear}`,
    categories: categoryItems,
    hasPreviousData: previousExpenses.length > 0,
  };
}

/**
 * Compara os gastos do mês/ano selecionado com o mês anterior, no total e
 * por categoria — reaproveita as transações já existentes no banco, sem
 * precisar de nenhuma tabela nova.
 */
export function useMonthComparison(
  selectedMonth: string,
  selectedYear: string,
  // Não é lido diretamente (esse hook busca os meses por conta própria) —
  // serve só de gatilho pra recalcular quando outra transação é
  // criada/editada em outro lugar (ex: ao quitar uma dívida).
  refreshTrigger: EnrichedTransaction[],
) {
  const [comparison, setComparison] = useState<MonthComparisonResult | null>(
    null,
  );
  const [isLoadingComparison, setIsLoadingComparison] = useState(true);

  // Mudou o período (ou outra transação foi criada/editada): volta pra
  // "carregando" já nesta renderização, sem setState dentro do effect.
  const [loadedFor, setLoadedFor] = useState({
    selectedMonth,
    selectedYear,
    refreshTrigger,
  });
  if (
    loadedFor.selectedMonth !== selectedMonth ||
    loadedFor.selectedYear !== selectedYear ||
    loadedFor.refreshTrigger !== refreshTrigger
  ) {
    setLoadedFor({ selectedMonth, selectedYear, refreshTrigger });
    setIsLoadingComparison(true);
  }

  useEffect(() => {
    let cancelled = false;
    buildComparison(selectedMonth, selectedYear)
      .then((result) => {
        if (!cancelled) setComparison(result);
      })
      .catch((error) => console.log("Erro ao calcular comparativo mensal:", error))
      .finally(() => {
        if (!cancelled) setIsLoadingComparison(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, selectedYear, refreshTrigger]);

  return { comparison, isLoadingComparison };
}
