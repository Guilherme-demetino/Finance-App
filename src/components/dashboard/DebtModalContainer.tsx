import { useDebtsContext } from "../../context/DebtsContext";
import { useToday } from "../../context/PeriodContext";
import { formatCurrencyInput } from "../../utils/currency";
import { DebtModal } from "../DebtModal";
import { SettleDebtModal } from "../SettleDebtModal";

export function DebtModalContainer() {
  const {
    isDebtModalOpen,
    setIsDebtModalOpen,
    handleAddDebt,
    pendingSettleDebt,
    cancelSettleDebt,
    handleSettleDebt,
  } = useDebtsContext();
  const { currentDay, currentMonthNum, currentYearStr } = useToday();

  return (
    <>
      <DebtModal
        visible={isDebtModalOpen}
        onClose={() => setIsDebtModalOpen(false)}
        formatCurrency={formatCurrencyInput}
        onSave={(data) => {
          setIsDebtModalOpen(false);
          handleAddDebt({
            ...data,
            date: `${currentDay}/${currentMonthNum}/${currentYearStr}`,
          });
        }}
      />

      <SettleDebtModal
        debt={pendingSettleDebt}
        onCancel={cancelSettleDebt}
        onConfirm={(account) => {
          const debt = pendingSettleDebt;
          cancelSettleDebt();
          if (debt) handleSettleDebt(debt, account);
        }}
      />
    </>
  );
}
