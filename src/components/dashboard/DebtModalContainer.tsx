import { useDebtsContext } from "../../context/DebtsContext";
import { useToday } from "../../context/PeriodContext";
import { formatCurrencyInput } from "../../utils/currency";
import { DebtModal } from "../DebtModal";

export function DebtModalContainer() {
  const { isDebtModalOpen, setIsDebtModalOpen, handleAddDebt } =
    useDebtsContext();
  const { currentDay, currentMonthNum, currentYearStr } = useToday();

  return (
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
  );
}
