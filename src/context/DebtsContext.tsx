import { createContext, useState, type ReactNode } from "react";

import type { DebtInput } from "../database/debts";
import { useDebts } from "../hooks/useDebts";
import type { DebtRow, TransactionType } from "../types";
import { logError } from "../utils/logger";
import { useAlert } from "./AlertContext";
import { useToday } from "./PeriodContext";
import { useTransactionsMutations } from "./TransactionsContext";
import { useRequiredContext } from "./useRequiredContext";

type DebtsHook = ReturnType<typeof useDebts>;

interface DebtsContextValue {
  pendingDebts: DebtsHook["pendingDebts"];
  settledDebts: DebtsHook["settledDebts"];
  totalToReceive: number;
  totalToPay: number;
  isLoadingDebts: boolean;
  isDebtModalOpen: boolean;
  setIsDebtModalOpen: (value: boolean) => void;
  handleAddDebt: (data: DebtInput) => Promise<void>;
  handleSettleDebt: (debt: DebtRow) => Promise<void>;
  handleDeleteDebt: (id: number) => Promise<void>;
}

const DebtsContext = createContext<DebtsContextValue | null>(null);

/**
 * Quitar de fato move dinheiro: vira uma transação normal, a partir da data
 * da quitação (não afeta meses já fechados). Fica fora do provider para o
 * React Compiler conseguir otimizá-lo (ele não aceita condicionais dentro de try).
 */
function buildSettlementTransaction(debt: DebtRow, date: string) {
  const isLent = debt.type === "lent";
  const type: TransactionType = isLent ? "income" : "expense";
  return {
    amount: debt.amount,
    date,
    description: isLent
      ? `Recebimento de ${debt.person}`
      : `Pagamento a ${debt.person}`,
    type,
    category: "Empréstimos",
  };
}

export function DebtsProvider({ children }: { children: ReactNode }) {
  const { currentDay, currentMonthNum, currentYearStr } = useToday();
  const { saveTransaction } = useTransactionsMutations();
  const { showAlert } = useAlert();

  const {
    pendingDebts,
    settledDebts,
    totalToReceive,
    totalToPay,
    isLoadingDebts,
    addDebt,
    settleDebt,
    removeDebt,
  } = useDebts();
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);

  const handleAddDebt = async (data: DebtInput) => {
    try {
      await addDebt(data);
      showAlert("Sucesso", "Registrado com sucesso.");
    } catch (error) {
      logError("Erro ao registrar dívida/empréstimo:", error);
      showAlert("Erro", "Não foi possível registrar.");
    }
  };

  const handleSettleDebt = async (debt: DebtRow) => {
    try {
      const todayStr = `${currentDay}/${currentMonthNum}/${currentYearStr}`;
      await settleDebt(debt.id, todayStr);

      // Só a partir de agora o valor entra no saldo.
      await saveTransaction(null, buildSettlementTransaction(debt, todayStr));

      showAlert("Sucesso", "Dívida quitada e registrada no seu saldo.");
    } catch (error) {
      logError("Erro ao quitar dívida:", error);
      showAlert("Erro", "Não foi possível quitar a dívida.");
    }
  };

  const handleDeleteDebt = async (id: number) => {
    try {
      await removeDebt(id);
      showAlert("Sucesso", "Registro excluído com sucesso.");
    } catch (error) {
      logError("Erro ao excluir dívida:", error);
      showAlert("Erro", "Não foi possível excluir o registro.");
    }
  };

  const value: DebtsContextValue = {
    pendingDebts,
    settledDebts,
    totalToReceive,
    totalToPay,
    isLoadingDebts,
    isDebtModalOpen,
    setIsDebtModalOpen,
    handleAddDebt,
    handleSettleDebt,
    handleDeleteDebt,
  };

  return (
    <DebtsContext.Provider value={value}>{children}</DebtsContext.Provider>
  );
}

export function useDebtsContext() {
  return useRequiredContext(DebtsContext, "useDebtsContext", "DebtsProvider");
}
