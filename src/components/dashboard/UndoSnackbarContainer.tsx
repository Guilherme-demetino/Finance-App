import { useTransactionsData } from "../../context/TransactionsContext";
import { UndoSnackbar } from "../UndoSnackbar";

export function UndoSnackbarContainer() {
  const { pendingUndo, undoDelete, dismissUndo } = useTransactionsData();

  if (!pendingUndo) return null;

  return (
    <UndoSnackbar
      description={pendingUndo.description}
      onUndo={undoDelete}
      onDismiss={dismissUndo}
    />
  );
}
