import { Switch, TouchableOpacity, View } from "react-native";

import { useBudgetAlerts } from "../hooks/useBudgetAlerts";
import { makeStyles, Text, useTheme } from "../theme";
import { WARNING_THRESHOLD } from "../utils/alerts";

/**
 * Alertas de orçamento: uma notificação na hora em que o gasto do mês numa categoria (ou no
 * orçamento do mês) chega perto do limite ou passa dele. Vive na tela de lembretes.
 */
export function BudgetAlertsCard() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { snapshot, isBusy, notice, setEnabled, sendTest, openSystemSettings } = useBudgetAlerts();

  const enabled = snapshot?.enabled ?? false;
  // Ligado no app, mas o Android bloqueou as notificações: nada chega até liberar.
  const blocked = enabled && snapshot !== null && !snapshot.permitted;

  return (
    <View>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.title}>Alertas de orçamento</Text>
            <Text style={styles.hint}>
              Uma notificação na hora em que uma categoria chega a {Math.round(WARNING_THRESHOLD * 100)}% da meta do
              mês ou passa dela. Vale também para o orçamento do mês e usa os mesmos números dos avisos do Início.
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            disabled={snapshot === null || isBusy}
            trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
            thumbColor={colors.textPrimary}
            accessibilityLabel="Alertas de orçamento"
          />
        </View>
        <Text style={[styles.hint, styles.spaced]}>
          Cada aviso vem uma vez por mês e por categoria. Só avisa o que acontecer depois de ligar: o que já estava
          perto do limite não vira aviso.
        </Text>
      </View>

      {notice !== null && (
        <View style={styles.noticeBox} accessibilityRole="alert">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      {blocked && (
        <View style={styles.noticeBox} accessibilityRole="alert">
          <Text style={styles.noticeText}>
            As notificações estão bloqueadas para o app no Android, então nenhum alerta chega.
          </Text>
          <TouchableOpacity style={styles.button} onPress={openSystemSettings} accessibilityRole="button">
            <Text style={styles.buttonText}>Abrir configurações do Android</Text>
          </TouchableOpacity>
        </View>
      )}

      {snapshot !== null && (
        <TouchableOpacity
          style={[styles.button, isBusy && styles.disabled]}
          onPress={sendTest}
          disabled={isBusy}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Enviar alerta de teste</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.textPrimary, fontSize: 17, fontWeight: "700", marginBottom: 8 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  spaced: { marginTop: 10 },
  switchRow: { flexDirection: "row", alignItems: "center" },
  switchText: { flex: 1, paddingRight: 12 },
  noticeBox: {
    backgroundColor: `${colors.expense}26`,
    borderColor: colors.expense,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  buttonText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.4 },
}));
