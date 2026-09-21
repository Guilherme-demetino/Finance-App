import { useSavingsContext } from "../../context/SavingsContext";
import { formatCurrencyInput } from "../../utils/currency";
import { SavingsDepositModal } from "../savings/SavingsDepositModal";
import { SavingsGoalModal } from "../savings/SavingsGoalModal";

/** Modais de criar/editar meta e de guardar/retirar dinheiro de uma meta. */
export function SavingsModalsContainer() {
  const {
    isSavingsModalOpen,
    setIsSavingsModalOpen,
    editingGoal,
    setEditingGoal,
    depositGoal,
    setDepositGoal,
    handleAddSavingsGoal,
    handleEditSavingsGoal,
    handleChangeSavings,
  } = useSavingsContext();

  const closeGoalForm = () => {
    setIsSavingsModalOpen(false);
    setEditingGoal(null);
  };

  return (
    <>
      {/* Um formulário só: vazio para criar, preenchido (editingGoal) para editar. */}
      <SavingsGoalModal
        visible={isSavingsModalOpen || editingGoal !== null}
        goal={editingGoal}
        onClose={closeGoalForm}
        formatCurrency={formatCurrencyInput}
        onSave={(data) => {
          closeGoalForm();
          if (editingGoal) handleEditSavingsGoal(editingGoal.id, data);
          else handleAddSavingsGoal(data);
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
