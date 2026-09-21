import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";

import { Text, makeStyles, useTheme } from "../theme";

interface GoalEditButtonProps {
  /** Descrição para leitores de tela, ex.: "Editar meta Viagem". */
  label: string;
  onPress: () => void;
  /** Com a edição aberta o botão vira "Fechar". */
  isOpen?: boolean;
}

/** O botão "Editar" das metas (lápis + texto: o ícone sozinho passava despercebido). */
export function GoalEditButton({ label, onPress, isOpen = false }: GoalEditButtonProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.button}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: isOpen }}
    >
      <Ionicons name={isOpen ? "close-outline" : "create-outline"} size={15} color={colors.textPrimary} />
      <Text style={styles.text}>{isOpen ? "Fechar" : "Editar"}</Text>
    </TouchableOpacity>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
  },
  text: { color: colors.textPrimary, fontSize: 12, fontWeight: "600" },
}));
