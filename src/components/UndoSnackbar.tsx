import { useEffect } from "react";
import { TouchableOpacity, View } from "react-native";
import { useStableCallback } from "../hooks/useStableCallback";
import { Text, makeStyles } from "../theme";

const AUTO_DISMISS_MS = 6000;

interface UndoSnackbarProps {
  description: string;
  onUndo: () => void;
  onDismiss: () => void;
}

/** Aviso rápido de "transação excluída", com a chance de desfazer antes de sumir sozinho. */
export function UndoSnackbar({ description, onUndo, onDismiss }: UndoSnackbarProps) {
  const styles = useStyles();
  const stableDismiss = useStableCallback(onDismiss);

  useEffect(() => {
    const timer = setTimeout(stableDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // Reinicia a contagem só quando a transação exibida muda (não a cada re-render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.bar}>
        <Text style={styles.message} numberOfLines={1}>
          {`"${description}" foi excluída`}
        </Text>
        <TouchableOpacity onPress={onUndo} style={styles.undoButton} accessibilityRole="button">
          <Text style={styles.undoText}>Desfazer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => {
  const { colors } = theme;
  return {
    container: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 200,
      alignItems: "center",
    },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      elevation: 6,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    message: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
      marginRight: 12,
    },
    undoButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    undoText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "700",
    },
  };
});
