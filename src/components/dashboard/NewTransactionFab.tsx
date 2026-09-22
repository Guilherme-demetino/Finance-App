import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";

import { useTransactionActions } from "../../context/TransactionFormContext";
import { useDashboardStyles } from "../../styles/dashboardStyles";
import { useTheme } from "../../theme";

/** Botão "+" flutuante. Só usa as ações (estáveis), então nunca re-renderiza por dados. */
export function NewTransactionFab() {
  const { colors, fontScale } = useTheme();
  const styles = useDashboardStyles();
  const { openNewTransactionModal } = useTransactionActions();

  // Acompanha o crescimento da barra de abas (fontScale maior por acessibilidade) para não colar nela.
  const bottom = 132 + Math.round((fontScale - 1) * 20);

  return (
    <TouchableOpacity
      style={[styles.fab, { bottom }]}
      onPress={openNewTransactionModal}
    >
      <Ionicons name="add" size={28} color={colors.textPrimary} />
    </TouchableOpacity>
  );
}
