import { useSavingsContext } from "../../context/SavingsContext";
import { formatCurrencyInput } from "../../utils/currency";
import { SavingsDepositModal } from "../savings/SavingsDepositModal";
import { SavingsGoalModal } from "../savings/SavingsGoalModal";

/** Modais de criar meta e de guardar/retirar dinheiro de uma meta. */
export function SavingsModalsContainer() {
  const {
    isSavingsModalOpen,
    setIsSavingsModalOpen,
    depositGoal,
    setDepositGoal,
    handleAddSavingsGoal,
    handleChangeSavings,
  } = useSavingsContext();

  return (
    <>
      <SavingsGoalModal
        visible={isSavingsModalOpen}
        onClose={() => setIsSavingsModalOpen(false)}
        formatCurrency={formatCurrencyInput}
        onSave={(data) => {
          setIsSavingsModalOpen(false);
          handleAddSavingsGoal(data);
        }}
      />

      <SavingsDepositModal
        goal={depositGoal}
        onClose={() => setDepositGoal(null)}
        formatCurrency={formatCurrencyInput}
        onConfirm={(goal, delta) => {
          setDepositGoal(null);
          handleChangeSavings(goal, delta);
        }}
      />
    </>
  );
}
