import { useEffect, useState } from "react";
import { getBudget, setBudget } from "../database/budgets";
import { getMonthNumber } from "../utils/dates";

/**
 * Orçamento definido pelo usuário para o mês/ano selecionado. Diferente
 * do total de receitas — é um valor próprio, persistido, que o usuário
 * controla e compara contra o quanto já gastou no período.
 */
export function useBudget(selectedMonth: string, selectedYear: string) {
  const [budget, setBudgetState] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const amount = await getBudget(
        getMonthNumber(selectedMonth),
        selectedYear,
      );
      setBudgetState(amount);
    } catch (error) {
      console.log("Erro ao buscar orçamento:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh não é memoizada, roda só quando o período muda
  }, [selectedMonth, selectedYear]);

  const updateBudget = async (amount: number) => {
    await setBudget(getMonthNumber(selectedMonth), selectedYear, amount);
    setBudgetState(amount);
  };

  return { budget, isLoading, updateBudget };
}
