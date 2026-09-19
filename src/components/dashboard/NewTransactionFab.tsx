import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";

import { colors } from "../../constants/colors";
import { useTransactionActions } from "../../context/TransactionFormContext";
import { styles } from "../../styles/dashboardStyles";

/** Botão "+" flutuante. Só usa as ações (estáveis), então nunca re-renderiza por dados. */
export function NewTransactionFab() {
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
