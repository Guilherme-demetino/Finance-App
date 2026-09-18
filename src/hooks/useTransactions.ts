import { useEffect, useState } from "react";
import { colors } from "../constants/colors";
import { getAllCategories } from "../database/categories";
import {
  createTransaction,
  deleteTransaction,
  deleteTransactionsByMonth,
  getAllTransactions,
  TransactionInput,
  updateTransaction,
} from "../database/transactions";
import type { EnrichedTransaction } from "../types";
import { getMonthNumber } from "../utils/dates";

export interface MonthDatum {
  label: string;
  income: number;
  expense: number;
}

const MONTH_LABELS = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

const MONTH_INDEX_BY_NUMBER: Record<string, number> = {
  "01": 0,
  "02": 1,
  "03": 2,
  "04": 3,
  "05": 4,
  "06": 5,
  "07": 6,
  "08": 7,
  "09": 8,
  "10": 9,
  "11": 10,
  "12": 11,
};

// Cores padrão para as categorias do sistema (usadas até o usuário criar
// uma categoria customizada com cor própria, que sobrescreve estas).
const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  salário: colors.income,
  investimentos: colors.accent,
  alimentação: colors.categoryOrange,
  transporte: colors.categoryPurple,
  lazer: colors.categoryPink,
  moradia: colors.categoryAmber,
  saúde: colors.expense,
  outros: colors.categoryNeutral,
};

function emptyMonthsData(): MonthDatum[] {
  return MONTH_LABELS.map((label) => ({ label, income: 0, expense: 0 }));
}

/**
 * Busca, filtra por mês/ano e agrega as transações do app. Encapsula o
 * que antes vivia direto na tela do dashboard (fetch + soma + agrupamento
 * mensal para o gráfico anual).
 */
export function useTransactions(selectedMonth: string, selectedYear: string) {
  const [transactions, setTransactions] = useState<EnrichedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [monthsData, setMonthsData] = useState<MonthDatum[]>(emptyMonthsData);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const [rawTransactions, rawCategories] = await Promise.all([
        getAllTransactions(),
        getAllCategories(),
      ]);

      const categoryColorMap: Record<string, string> = {
        ...DEFAULT_CATEGORY_COLORS,
      };
      rawCategories.forEach((cat) => {
        if (cat.name) {
          categoryColorMap[cat.name.trim().toLowerCase()] = cat.color;
        }
      });

      const enriched: EnrichedTransaction[] = rawTransactions.map((item) => {
        const catKey = item.category_id
          ? item.category_id.trim().toLowerCase()
          : "";
        return {
          ...item,
          category: item.category_id,
          color: categoryColorMap[catKey] || colors.textSecondary,
        };
      });

      const yearTransactions = enriched.filter(
        (item) => item.date && item.date.endsWith(`/${selectedYear}`),
      );

      const monthNumber = getMonthNumber(selectedMonth);
      const monthTransactions = yearTransactions.filter((item) =>
        item.date.includes(`/${monthNumber}/${selectedYear}`),
      );
      setTransactions(monthTransactions);

      let income = 0;
      let expense = 0;
      monthTransactions.forEach((item) => {
        if (item.type === "income") income += item.amount;
        else expense += item.amount;
      });
      setTotalIncome(income);
      setTotalExpense(expense);

      const calculatedMonthsData = emptyMonthsData();
      yearTransactions.forEach((item) => {
        const parts = item.date.split("/");
        if (parts.length === 3) {
          const idx = MONTH_INDEX_BY_NUMBER[parts[1]];
          if (idx !== undefined) {
            if (item.type === "income") {
              calculatedMonthsData[idx].income += item.amount;
            } else {
              calculatedMonthsData[idx].expense += item.amount;
            }
          }
        }
      });
      setMonthsData(calculatedMonthsData);
    } catch (error) {
      console.log("Erro ao buscar transações:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh não é memoizada, roda só quando o período muda
  }, [selectedMonth, selectedYear]);

  const saveTransaction = async (
    editingId: number | null,
    data: TransactionInput,
  ) => {
    if (editingId) {
      await updateTransaction(editingId, data);
    } else {
      await createTransaction(data);
    }
    await refresh();
  };

  const removeTransaction = async (id: number) => {
    await deleteTransaction(id);
    await refresh();
  };

  const removeAllForCurrentPeriod = async () => {
    await deleteTransactionsByMonth(getMonthNumber(selectedMonth), selectedYear);
    await refresh();
  };

  return {
    transactions,
    isLoading,
    totalIncome,
    totalExpense,
    monthsData,
    refresh,
    saveTransaction,
    removeTransaction,
    removeAllForCurrentPeriod,
  };
}
