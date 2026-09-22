import { createContext, useEffect, useMemo, type ReactNode } from "react";

import { purgeExpiredDeletedTransactions } from "../database/transactions";
import { useStableCallback } from "../hooks/useStableCallback";
import { useTransactions } from "../hooks/useTransactions";
import type { DisplayTransaction } from "../types";
import { logError } from "../utils/logger";
import { toDisplayTransaction } from "../utils/transactionDisplay";
import { useAlert } from "./AlertContext";
import { usePeriod } from "./PeriodContext";
import { useRequiredContext } from "./useRequiredContext";

type TransactionsHook = ReturnType<typeof useTransactions>;

/** Transações do período e o que se calcula a partir delas. Muda quando os dados carregam ou o período troca. */
interface TransactionsData {
  transactions: TransactionsHook["transactions"];
  isLoadingTransactions: boolean;
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  monthsData: TransactionsHook["monthsData"];
  formattedTransactions: DisplayTransaction[];
  handleDeleteTransaction: (id: string) => Promise<void>;
  handleDeleteAllTransactions: () => Promise<void>;
  handleDeleteSeriesFromId: (groupId: string, fromId: number) => Promise<void>;
  handleDeleteSeries: (groupId: string) => Promise<void>;
  /** A última transação excluída (não série/mês inteiro), enquanto ainda dá pra desfazer. */
  pendingUndo: TransactionsHook["pendingUndo"];
  undoDelete: TransactionsHook["undoDelete"];
  dismissUndo: TransactionsHook["dismissUndo"];
}

/** Ações de escrita com identidade fixa: quem só grava (dívidas, formulário) não re-renderiza quando os dados mudam. */
interface TransactionsMutations {
  saveTransaction: TransactionsHook["saveTransaction"];
  refreshTransactions: TransactionsHook["refresh"];
}

const TransactionsDataContext = createContext<TransactionsData | null>(null);
const TransactionsMutationsContext =
  createContext<TransactionsMutations | null>(null);

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { selectedMonth, selectedYear } = usePeriod();
  const { showAlert } = useAlert();

  const {
    transactions,
    isLoading: isLoadingTransactions,
    totalIncome,
    totalExpense,
    monthsData,
    saveTransaction,
    removeTransaction,
    removeAllForCurrentPeriod,
    removeSeries,
    removeSeriesFromId,
    refresh,
    pendingUndo,
    undoDelete,
    dismissUndo,
  } = useTransactions(selectedMonth, selectedYear);
  const totalBalance = totalIncome - totalExpense;

  // Uma vez por sessão (ao abrir o painel): limpa da Lixeira quem já passou do prazo. Não precisa relêr nada — são
  // linhas que já estavam escondidas das listas ativas.
  useEffect(() => {
    purgeExpiredDeletedTransactions().catch((error) =>
      logError("Erro ao limpar a Lixeira de transações:", error),
    );
  }, []);

  const stableSaveTransaction = useStableCallback(saveTransaction);
  const stableRefreshTransactions = useStableCallback(refresh);
  const mutations = useMemo(
    () => ({
      saveTransaction: stableSaveTransaction,
      refreshTransactions: stableRefreshTransactions,
    }),
    [stableSaveTransaction, stableRefreshTransactions],
  );

  const formattedTransactions: DisplayTransaction[] = useMemo(
    () => transactions.map(toDisplayTransaction),
    [transactions],
  );

  // Sem alerta de sucesso aqui: quem avisa é o snackbar de "Desfazer" (ver UndoSnackbar).
  const handleDeleteTransaction = async (id: string) => {
    try {
      await removeTransaction(Number(id));
    } catch (error) {
      logError("Erro ao excluir transação:", error);
      showAlert("Erro", "Não foi possível excluir a transação.");
    }
  };

  const handleDeleteAllTransactions = async () => {
    try {
      await removeAllForCurrentPeriod();
      showAlert(
        "Sucesso",
        "Todas as transações deste período foram excluídas.",
      );
    } catch (error) {
      logError("Erro ao excluir transações:", error);
      showAlert("Erro", "Não foi possível excluir as transações.");
    }
  };

  const handleDeleteSeriesFromId = async (groupId: string, fromId: number) => {
    try {
      await removeSeriesFromId(groupId, fromId);
      showAlert(
        "Sucesso",
        "Esta e as próximas ocorrências da série foram excluídas.",
      );
    } catch (error) {
      logError("Erro ao excluir ocorrências futuras da série:", error);
      showAlert("Erro", "Não foi possível excluir as ocorrências futuras.");
    }
  };

  const handleDeleteSeries = async (groupId: string) => {
    try {
      await removeSeries(groupId);
      showAlert("Sucesso", "Série excluída com sucesso.");
    } catch (error) {
      logError("Erro ao excluir série:", error);
      showAlert("Erro", "Não foi possível excluir a série.");
    }
  };

  const data: TransactionsData = {
    transactions,
    isLoadingTransactions,
    totalIncome,
    totalExpense,
    totalBalance,
    monthsData,
    formattedTransactions,
    handleDeleteTransaction,
    handleDeleteAllTransactions,
    handleDeleteSeriesFromId,
    handleDeleteSeries,
    pendingUndo,
    undoDelete,
    dismissUndo,
  };

  return (
    <TransactionsMutationsContext.Provider value={mutations}>
      <TransactionsDataContext.Provider value={data}>
        {children}
      </TransactionsDataContext.Provider>
    </TransactionsMutationsContext.Provider>
  );
}

export function useTransactionsData() {
  return useRequiredContext(
    TransactionsDataContext,
    "useTransactionsData",
    "TransactionsProvider",
  );
}

export function useTransactionsMutations() {
  return useRequiredContext(
    TransactionsMutationsContext,
    "useTransactionsMutations",
    "TransactionsProvider",
  );
}
