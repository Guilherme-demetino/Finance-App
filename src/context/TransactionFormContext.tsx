import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DEFAULT_ACCOUNT_NAME } from "../database/accounts";
import type {
  DisplayTransaction,
  TransactionRepeatMode,
  TransactionType,
} from "../types";
import { formatCurrencyInput } from "../utils/currency";
import { getMonthNumber } from "../utils/dates";
import { useAlert } from "./AlertContext";
import { usePeriod, useToday } from "./PeriodContext";
import { useTransactionsMutations } from "./TransactionsContext";
import { logError } from "../utils/logger";

/**
 * Campos do formulário de transação. Mudam a cada tecla digitada, por isso
 * ficam num contexto próprio: assim digitar não re-renderiza as telas.
 */
interface TransactionFormContextValue {
  isTransactionModalOpen: boolean;
  setIsTransactionModalOpen: (value: boolean) => void;
  editingTransactionId: string | null;
  setEditingTransactionId: (value: string | null) => void;
  transactionType: TransactionType;
  setTransactionType: (value: TransactionType) => void;
  transactionTitle: string;
  setTransactionTitle: (value: string) => void;
  transactionAmount: string;
  setTransactionAmount: (value: string) => void;
  transactionDate: string;
  setTransactionDate: (value: string) => void;
  transactionCategory: string;
  setTransactionCategory: (value: string) => void;
  transactionAccount: string;
  setTransactionAccount: (value: string) => void;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  recurringMonths: number;
  setRecurringMonths: (value: number) => void;
  installmentCount: number;
  setInstallmentCount: (value: number) => void;
  handleSaveTransaction: () => Promise<void>;
}

/** Ações que abrem o formulário. Estáveis enquanto se digita, então quem só abre o modal (ex: histórico) não re-renderiza. */
interface TransactionActionsContextValue {
  handleOpenEditTransaction: (item: DisplayTransaction) => void;
  openNewTransactionModal: () => void;
}

const TransactionFormContext =
  createContext<TransactionFormContextValue | null>(null);
const TransactionActionsContext =
  createContext<TransactionActionsContextValue | null>(null);

export function TransactionFormProvider({ children }: { children: ReactNode }) {
  const { selectedMonth, selectedYear } = usePeriod();
  const { currentMonthNum, currentYearStr, currentDay } = useToday();
  const { saveTransaction } = useTransactionsMutations();
  const { showAlert } = useAlert();

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);
  const [transactionType, setTransactionType] =
    useState<TransactionType>("income");
  const [transactionTitle, setTransactionTitle] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    `${currentDay}/${currentMonthNum}/${currentYearStr}`,
  );
  const [transactionCategory, setTransactionCategory] = useState("Salário");
  const [transactionAccount, setTransactionAccount] = useState(DEFAULT_ACCOUNT_NAME);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState(12);
  const [installmentCount, setInstallmentCount] = useState(1);

  const handleOpenEditTransaction = useCallback((item: DisplayTransaction) => {
    setEditingTransactionId(item.id);
    setTransactionType(item.type);
    setTransactionTitle(item.description);

    const rawCents = Math.round(item.amount * 100).toString();
    setTransactionAmount(formatCurrencyInput(rawCents));

    setTransactionDate(item.date);
    setTransactionCategory(
      item.category || (item.type === "income" ? "Salário" : "Alimentação"),
    );
    setTransactionAccount(item.account || DEFAULT_ACCOUNT_NAME);
    // Editar sempre mexe só nessa ocorrência — nunca reabre como
    // recorrente/parcelada, mesmo se a transação original era uma delas.
    setIsRecurring(false);
    setRecurringMonths(12);
    setInstallmentCount(1);
    setIsTransactionModalOpen(true);
  }, []);

  const handleSaveTransaction = async () => {
    if (
      !transactionTitle ||
      !String(transactionTitle).trim() ||
      !transactionAmount ||
      !String(transactionAmount).trim()
    ) {
      showAlert("Atenção", "Preencha o título e o valor da transação.");
      return;
    }

    const cleanNumericValue = Number(
      String(transactionAmount).replace(/\./g, "").replace(",", "."),
    );

    if (isNaN(cleanNumericValue) || cleanNumericValue <= 0) {
      showAlert("Atenção", "Insira um valor válido.");
      return;
    }

    const safeTitle = String(transactionTitle).trim();
    const safeDate =
      String(transactionDate).trim() ||
      `${currentDay}/${currentMonthNum}/${currentYearStr}`;
    const safeType: TransactionType =
      transactionType === "income" ? "income" : "expense";

    const rawCat = String(transactionCategory || "").trim();
    const safeCategory =
      rawCat !== "" ? rawCat : safeType === "income" ? "Salário" : "Outros";

    const repeatMode: TransactionRepeatMode = isRecurring
      ? { kind: "recurring", months: recurringMonths }
      : installmentCount > 1
        ? { kind: "installment", count: installmentCount }
        : { kind: "single" };

    try {
      await saveTransaction(
        editingTransactionId ? Number(editingTransactionId) : null,
        {
          amount: cleanNumericValue,
          date: safeDate,
          description: safeTitle,
          type: safeType,
          category: safeCategory,
          account: transactionAccount,
        },
        repeatMode,
      );

      const successMessage = editingTransactionId
        ? "Transação atualizada com sucesso!"
        : repeatMode.kind === "recurring"
          ? `Transação recorrente cadastrada! Ela vai aparecer todo mês pelos próximos ${repeatMode.months} meses.`
          : repeatMode.kind === "installment"
            ? `Compra parcelada em ${repeatMode.count}x cadastrada com sucesso!`
            : "Transação salva com sucesso!";
      showAlert("Sucesso", successMessage);

      setTransactionTitle("");
      setTransactionAmount("");
      setEditingTransactionId(null);
      setIsRecurring(false);
      setRecurringMonths(12);
      setInstallmentCount(1);
      setTransactionAccount(DEFAULT_ACCOUNT_NAME);
      setIsTransactionModalOpen(false);
    } catch (error) {
      logError("Erro ao salvar transação:", error);
      showAlert("Erro", "Não foi possível salvar a transação.");
    }
  };

  const openNewTransactionModal = useCallback(() => {
    setEditingTransactionId(null);
    setTransactionType("income");
    setTransactionTitle("");
    setTransactionAmount("");
    setTransactionCategory("Salário");
    setTransactionAccount(DEFAULT_ACCOUNT_NAME);
    setIsRecurring(false);
    setRecurringMonths(12);
    setInstallmentCount(1);

    const targetMonth = getMonthNumber(selectedMonth);
    let dayToUse = "01";
    if (targetMonth === currentMonthNum && selectedYear === currentYearStr) {
      dayToUse = currentDay;
    }

    setTransactionDate(`${dayToUse}/${targetMonth}/${selectedYear}`);
    setIsTransactionModalOpen(true);
  }, [
    selectedMonth,
    selectedYear,
    currentMonthNum,
    currentYearStr,
    currentDay,
  ]);

  const actions = useMemo(
    () => ({ handleOpenEditTransaction, openNewTransactionModal }),
    [handleOpenEditTransaction, openNewTransactionModal],
  );

  const form: TransactionFormContextValue = {
    isTransactionModalOpen,
    setIsTransactionModalOpen,
    editingTransactionId,
    setEditingTransactionId,
    transactionType,
    setTransactionType,
    transactionTitle,
    setTransactionTitle,
    transactionAmount,
    setTransactionAmount,
    transactionDate,
    setTransactionDate,
    transactionCategory,
    setTransactionCategory,
    transactionAccount,
    setTransactionAccount,
    isRecurring,
    setIsRecurring,
    recurringMonths,
    setRecurringMonths,
    installmentCount,
    setInstallmentCount,
    handleSaveTransaction,
  };

  return (
    <TransactionActionsContext.Provider value={actions}>
      <TransactionFormContext.Provider value={form}>
        {children}
      </TransactionFormContext.Provider>
    </TransactionActionsContext.Provider>
  );
}

export function useTransactionForm() {
  const ctx = useContext(TransactionFormContext);
  if (!ctx) {
    throw new Error(
      "useTransactionForm deve ser usado dentro de um TransactionFormProvider",
    );
  }
  return ctx;
}

export function useTransactionActions() {
  const ctx = useContext(TransactionActionsContext);
  if (!ctx) {
    throw new Error(
      "useTransactionActions deve ser usado dentro de um TransactionFormProvider",
    );
  }
  return ctx;
}
