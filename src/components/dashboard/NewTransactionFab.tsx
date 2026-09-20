import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";

import { useTransactionActions } from "../../context/TransactionFormContext";
import { useDashboardStyles } from "../../styles/dashboardStyles";
import { useTheme } from "../../theme";

/** Botão "+" flutuante. Só usa as ações (estáveis), então nunca re-renderiza por dados. */
export function NewTransactionFab() {
  const { colors } = useTheme();
  const styles = useDashboardStyles();
  const { openNewTransactionModal } = useTransactionActions();

  return (
    <TouchableOpacity
      style={[styles.fab, { bottom: 108 }]}
      onPress={openNewTransactionModal}
    >
      <Ionicons name="add" size={28} color={colors.textPrimary} />
    </TouchableOpacity>
  );
}
