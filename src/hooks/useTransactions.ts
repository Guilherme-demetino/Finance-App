import { useEffect, useState } from "react";
import { ACCENT_COLORS, CATEGORY_COLORS } from "../constants/colors";
import { getAllCategories } from "../database/categories";
import {
  createInstallmentTransactions,
  createRecurringTransactions,
  createTransaction,
  deleteTransaction,
  deleteTransactionsByGroupId,
  deleteTransactionsByMonth,
  deleteTransactionsFromIdInGroup,
  getTransactionsByYear,
  restoreTransaction,
  TransactionInput,
  updateTransaction,
} from "../database/transactions";
import type {
  CategoryRow,
  EnrichedTransaction,
  TransactionRepeatMode,
  TransactionRow,
} from "../types";
import { getMonthNumber } from "../utils/dates";
import { logError } from "../utils/logger";
import { notifyCardsChanged } from "../services/cardsEvents";

interface MonthDatum {
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
export const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  salário: ACCENT_COLORS.income,
  investimentos: ACCENT_COLORS.accent,
  pix: CATEGORY_COLORS.categoryCyan,
  alimentação: CATEGORY_COLORS.categoryOrange,
  transporte: CATEGORY_COLORS.categoryPurple,
  lazer: CATEGORY_COLORS.categoryPink,
  moradia: CATEGORY_COLORS.categoryAmber,
  saúde: ACCENT_COLORS.expense,
  outros: CATEGORY_COLORS.categoryNeutral,
};

function emptyMonthsData(): MonthDatum[] {
  return MONTH_LABELS.map((label) => ({ label, income: 0, expense: 0 }));
}

interface PeriodData {
  transactions: EnrichedTransaction[];
  totalIncome: number;
  totalExpense: number;
  monthsData: MonthDatum[];
}

/** Junta a cor da categoria (a do usuário ou a padrão) a cada transação. */
export function enrichTransactions(
  rawTransactions: TransactionRow[],
  rawCategories: CategoryRow[],
): EnrichedTransaction[] {
  const categoryColorMap: Record<string, string> = {
    ...DEFAULT_CATEGORY_COLORS,
  };
  rawCategories.forEach((cat) => {
    if (cat.name) {
      categoryColorMap[cat.name.trim().toLowerCase()] = cat.color;
    }
  });

  return rawTransactions.map((item) => {
    const catKey = item.category_id
      ? item.category_id.trim().toLowerCase()
      : "";
    return {
      ...item,
      category: item.category_id,
      color: categoryColorMap[catKey] || CATEGORY_COLORS.categoryNeutral,
    };
  });
}

async function loadPeriodData(
  selectedMonth: string,
  selectedYear: string,
): Promise<PeriodData> {
  const [rawTransactions, rawCategories] = await Promise.all([
    getTransactionsByYear(selectedYear),
    getAllCategories(),
  ]);

  const enriched = enrichTransactions(rawTransactions, rawCategories);

  // A consulta já traz só o ano selecionado.
  const yearTransactions = enriched;

  const monthNumber = getMonthNumber(selectedMonth);
  const monthTransactions = yearTransactions.filter((item) =>
    item.date.includes(`/${monthNumber}/${selectedYear}`),
  );
  let income = 0;
  let expense = 0;
  monthTransactions.forEach((item) => {
    if (item.type === "income") income += item.amount;
    else expense += item.amount;
  });
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
  return {
    transactions: monthTransactions,
    totalIncome: income,
    totalExpense: expense,
    monthsData: calculatedMonthsData,
  };
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
  // A última exclusão de uma transação (não de séries/mês inteiro): dá pra desfazer enquanto isso ficar preenchido.
  const [pendingUndo, setPendingUndo] = useState<{ id: number; description: string } | null>(null);

  const applyPeriodData = (data: PeriodData) => {
    setTransactions(data.transactions);
    setTotalIncome(data.totalIncome);
    setTotalExpense(data.totalExpense);
    setMonthsData(data.monthsData);
  };

  const refresh = async () => {
    setIsLoading(true);
    try {
      applyPeriodData(await loadPeriodData(selectedMonth, selectedYear));
    } catch (error) {
      logError("Erro ao buscar transações:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Trocou o período: volta pra "carregando" já nesta renderização, sem
  // setState dentro do effect.
  const period = `${selectedMonth}/${selectedYear}`;
  const [loadedPeriod, setLoadedPeriod] = useState(period);
  if (loadedPeriod !== period) {
    setLoadedPeriod(period);
    setIsLoading(true);
  }

  useEffect(() => {
    let cancelled = false;
    loadPeriodData(selectedMonth, selectedYear)
      .then((data) => {
        if (!cancelled) applyPeriodData(data);
      })
      .catch((error) => logError("Erro ao buscar transações:", error))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, selectedYear]);

  const saveTransaction = async (
    editingId: number | null,
    data: TransactionInput,
    repeatMode: TransactionRepeatMode = { kind: "single" },
  ) => {
    if (editingId) {
      // Editar sempre afeta só essa ocorrência, nunca a série toda.
      await updateTransaction(editingId, data);
    } else if (repeatMode.kind === "recurring") {
      await createRecurringTransactions(data, repeatMode.months);
    } else if (repeatMode.kind === "installment") {
      await createInstallmentTransactions(data, repeatMode.count);
    } else {
      await createTransaction(data);
    }
    await refresh();
    // Editar uma despesa que é compra de cartão também muda a compra: a tela de cartões relê.
    if (editingId) notifyCardsChanged();
  };

  // Apagar despesas que são compras de cartão tira a compra do cartão: a tela de cartões relê.
  // A exclusão tem prazo (Lixeira): guarda o suficiente pra oferecer "Desfazer" logo em seguida.
  const removeTransaction = async (id: number) => {
    const target = transactions.find((item) => item.id === id);
    await deleteTransaction(id);
    await refresh();
    notifyCardsChanged();
    setPendingUndo(target ? { id, description: target.description } : null);
  };

  const undoDelete = async () => {
    if (!pendingUndo) return;
    const { id } = pendingUndo;
    setPendingUndo(null);
    await restoreTransaction(id);
    await refresh();
    notifyCardsChanged();
  };

  const dismissUndo = () => setPendingUndo(null);

  const removeAllForCurrentPeriod = async () => {
    await deleteTransactionsByMonth(getMonthNumber(selectedMonth), selectedYear);
    await refresh();
    notifyCardsChanged();
  };

  const removeSeries = async (groupId: string) => {
    await deleteTransactionsByGroupId(groupId);
    await refresh();
    notifyCardsChanged();
  };

  const removeSeriesFromId = async (groupId: string, fromId: number) => {
    await deleteTransactionsFromIdInGroup(groupId, fromId);
    await refresh();
    notifyCardsChanged();
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
    removeSeries,
    removeSeriesFromId,
    pendingUndo,
    undoDelete,
    dismissUndo,
  };
}
