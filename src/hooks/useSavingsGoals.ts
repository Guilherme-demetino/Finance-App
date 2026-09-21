import { useEffect, useState } from "react";
import {
  createSavingsGoal,
  deleteSavingsGoal,
  getAllSavingsGoals,
  updateSavedAmount,
  updateSavingsGoal,
  type SavingsGoalInput,
} from "../database/savingsGoals";
import type { SavingsGoalRow } from "../types";
import { logError } from "../utils/logger";

/**
 * Metas de economia ("juntar R$ 5.000 até dezembro"). Ficam separadas do
 * saldo: guardar dinheiro numa meta não é receita nem despesa.
 */
export function useSavingsGoals() {
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalRow[]>([]);
  const [isLoadingSavings, setIsLoadingSavings] = useState(true);

  const refreshSavings = async () => {
    setIsLoadingSavings(true);
    try {
      setSavingsGoals(await getAllSavingsGoals());
    } catch (error) {
      logError("Erro ao buscar metas de economia:", error);
    } finally {
      setIsLoadingSavings(false);
    }
  };

  useEffect(() => {
    // isLoadingSavings já começa true, então aqui só busca (sem setState síncrono).
    let cancelled = false;
    getAllSavingsGoals()
      .then((rows) => {
        if (!cancelled) setSavingsGoals(rows);
      })
      .catch((error) => logError("Erro ao buscar metas de economia:", error))
      .finally(() => {
        if (!cancelled) setIsLoadingSavings(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addSavingsGoal = async (data: SavingsGoalInput) => {
    await createSavingsGoal(data);
    await refreshSavings();
  };

  /** Edita os dados de uma meta (nome, valor, quanto já foi guardado e prazo). */
  const editSavingsGoal = async (
    id: number,
    data: Omit<SavingsGoalInput, "createdDate">,
  ) => {
    await updateSavingsGoal(id, data);
    await refreshSavings();
  };

  /** Soma (ou subtrai, com delta negativo) um valor ao já guardado, sem ficar abaixo de zero. */
  const changeSavedAmount = async (goal: SavingsGoalRow, delta: number) => {
    const next = Math.max(0, Math.round((goal.saved_amount + delta) * 100) / 100);
    await updateSavedAmount(goal.id, next);
    await refreshSavings();
  };

  const removeSavingsGoal = async (id: number) => {
    await deleteSavingsGoal(id);
    await refreshSavings();
  };

  return {
    savingsGoals,
    isLoadingSavings,
    addSavingsGoal,
    editSavingsGoal,
    changeSavedAmount,
    removeSavingsGoal,
  };
}
