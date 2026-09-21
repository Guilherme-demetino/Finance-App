import { createContext, useState, type ReactNode } from "react";

import { useSavingsGoals } from "../hooks/useSavingsGoals";
import type { SavingsGoalRow } from "../types";
import { logError } from "../utils/logger";
import { useAlert } from "./AlertContext";
import { useToday } from "./PeriodContext";
import { useRequiredContext } from "./useRequiredContext";

interface SavingsContextValue {
  savingsGoals: SavingsGoalRow[];
  isLoadingSavings: boolean;
  isSavingsModalOpen: boolean;
  setIsSavingsModalOpen: (value: boolean) => void;
  depositGoal: SavingsGoalRow | null;
  setDepositGoal: (goal: SavingsGoalRow | null) => void;
  /** A meta que está sendo editada (abre o formulário já preenchido); null = nenhuma. */
  editingGoal: SavingsGoalRow | null;
  setEditingGoal: (goal: SavingsGoalRow | null) => void;
  handleAddSavingsGoal: (data: SavingsGoalFormData) => Promise<void>;
  handleEditSavingsGoal: (id: number, data: SavingsGoalFormData) => Promise<void>;
  handleChangeSavings: (goal: SavingsGoalRow, delta: number) => Promise<void>;
  handleDeleteSavingsGoal: (id: number) => Promise<void>;
}

/** O que o formulário de meta entrega ao salvar (criar ou editar). */
export interface SavingsGoalFormData {
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
}

const SavingsContext = createContext<SavingsContextValue | null>(null);

export function SavingsProvider({ children }: { children: ReactNode }) {
  const { currentDay, currentMonthNum, currentYearStr } = useToday();
  const { showAlert } = useAlert();

  const {
    savingsGoals,
    isLoadingSavings,
    addSavingsGoal,
    editSavingsGoal,
    changeSavedAmount,
    removeSavingsGoal,
  } = useSavingsGoals();
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);
  const [depositGoal, setDepositGoal] = useState<SavingsGoalRow | null>(null);
  const [editingGoal, setEditingGoal] = useState<SavingsGoalRow | null>(null);

  const handleAddSavingsGoal = async (data: SavingsGoalFormData) => {
    try {
      await addSavingsGoal({
        ...data,
        createdDate: `${currentDay}/${currentMonthNum}/${currentYearStr}`,
      });
      showAlert("Sucesso", "Meta de economia criada.");
    } catch (error) {
      logError("Erro ao criar meta de economia:", error);
      showAlert("Erro", "Não foi possível criar a meta.");
    }
  };

  const handleEditSavingsGoal = async (id: number, data: SavingsGoalFormData) => {
    try {
      await editSavingsGoal(id, data);
      showAlert("Sucesso", "Meta de economia atualizada.");
    } catch (error) {
      logError("Erro ao editar meta de economia:", error);
      showAlert("Erro", "Não foi possível atualizar a meta.");
    }
  };

  const handleChangeSavings = async (goal: SavingsGoalRow, delta: number) => {
    try {
      await changeSavedAmount(goal, delta);
    } catch (error) {
      logError("Erro ao atualizar valor guardado:", error);
      showAlert("Erro", "Não foi possível atualizar a meta.");
    }
  };

  const handleDeleteSavingsGoal = async (id: number) => {
    try {
      await removeSavingsGoal(id);
      showAlert("Sucesso", "Meta excluída com sucesso.");
    } catch (error) {
      logError("Erro ao excluir meta de economia:", error);
      showAlert("Erro", "Não foi possível excluir a meta.");
    }
  };

  const value: SavingsContextValue = {
    savingsGoals,
    isLoadingSavings,
    isSavingsModalOpen,
    setIsSavingsModalOpen,
    depositGoal,
    setDepositGoal,
    editingGoal,
    setEditingGoal,
    handleAddSavingsGoal,
    handleEditSavingsGoal,
    handleChangeSavings,
    handleDeleteSavingsGoal,
  };

  return (
    <SavingsContext.Provider value={value}>{children}</SavingsContext.Provider>
  );
}

export function useSavingsContext() {
  return useRequiredContext(
    SavingsContext,
    "useSavingsContext",
    "SavingsProvider",
  );
}
