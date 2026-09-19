import { useEffect, useState } from "react";
import { getBudget, setBudget } from "../database/budgets";
import { getMonthNumber } from "../utils/dates";
import { logError } from "../utils/logger";

/**
 * Orçamento definido pelo usuário para o mês/ano selecionado. Diferente
 * do total de receitas — é um valor próprio, persistido, que o usuário
 * controla e compara contra o quanto já gastou no período.
 */
export function useBudget(selectedMonth: string, selectedYear: string) {
  const [budget, setBudgetState] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Trocou o período: volta pra "carregando" já nesta renderização (sem setState no effect).
  const period = `${selectedMonth}/${selectedYear}`;
  const [loadedPeriod, setLoadedPeriod] = useState(period);
  if (loadedPeriod !== period) {
    setLoadedPeriod(period);
    setIsLoading(true);
  }

  useEffect(() => {
    let cancelled = false;
    getBudget(getMonthNumber(selectedMonth), selectedYear)
      .then((amount) => {
        if (!cancelled) setBudgetState(amount);
      })
      .catch((error) => logError("Erro ao buscar orçamento:", error))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, selectedYear]);

  const updateBudget = async (amount: number) => {
    await setBudget(getMonthNumber(selectedMonth), selectedYear, amount);
    setBudgetState(amount);
  };

  return { budget, isLoading, updateBudget };
}
