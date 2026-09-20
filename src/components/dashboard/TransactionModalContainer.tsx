import { useBudgetActions } from "../../context/BudgetContext";
import { useTransactionForm } from "../../context/TransactionFormContext";
import { formatCurrencyInput } from "../../utils/currency";
import { TransactionModal } from "../transactions/TransactionModal";

/** Modal de nova/edição de transação, ligado ao contexto do formulário. */
export function TransactionModalContainer() {
  const {
    isTransactionModalOpen,
    setIsTransactionModalOpen,
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
    isRecurring,
    setIsRecurring,
    recurringMonths,
    setRecurringMonths,
    installmentCount,
    setInstallmentCount,
    editingTransactionId,
    handleSaveTransaction,
  } = useTransactionForm();
  const { handleDeleteCategory } = useBudgetActions();

  return (
    <TransactionModal
      visible={isTransactionModalOpen}
      onClose={() => {
        setEditingTransactionId(null);
        setIsTransactionModalOpen(false);
      }}
      transactionType={transactionType}
      setTransactionType={setTransactionType}
      transactionTitle={transactionTitle}
      setTransactionTitle={setTransactionTitle}
      transactionAmount={transactionAmount}
      setTransactionAmount={setTransactionAmount}
      transactionDate={transactionDate}
      setTransactionDate={setTransactionDate}
      transactionCategory={transactionCategory}
      setTransactionCategory={setTransactionCategory}
      isRecurring={isRecurring}
      setIsRecurring={setIsRecurring}
      recurringMonths={recurringMonths}
      setRecurringMonths={setRecurringMonths}
      installmentCount={installmentCount}
      setInstallmentCount={setInstallmentCount}
      isEditing={!!editingTransactionId}
      formatCurrency={formatCurrencyInput}
      onSave={handleSaveTransaction}
      onDeleteCategory={handleDeleteCategory}
    />
  );
}
