import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { TouchableOpacity, View } from "react-native";

import { useSubscriptionsContext } from "../../context/SubscriptionsContext";
import { Text, makeStyles, useTheme } from "../../theme";
import { formatCurrency } from "../../utils/currency";

/** Resumo das assinaturas no Início: total por mês e quantos reajustes foram achados. Toca para abrir a tela delas. */
export function SubscriptionsCard() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { summary, alerts, subscriptions, isLoading } = useSubscriptionsContext();

  if (isLoading) return null;

  const hasAny = subscriptions.length > 0;
  const label = hasAny
    ? `Assinaturas: ${formatCurrency(summary.monthlyTotal)} por mês${alerts.length > 0 ? `, ${alerts.length} ${alerts.length === 1 ? "reajuste" : "reajustes"}` : ""}`
    : "Assinaturas recorrentes";

  return (
    <TouchableOpacity
      onPress={() => router.push("/dashboard/subscriptions")}
      style={[styles.card, alerts.length > 0 && { borderColor: colors.expense }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="repeat" size={22} color={colors.accent} />
      <View style={styles.text}>
        <Text style={styles.title}>Assinaturas</Text>
        {hasAny ? (
          <Text style={styles.subtitle}>
            {formatCurrency(summary.monthlyTotal)} por mês · {summary.activeCount} {summary.activeCount === 1 ? "ativa" : "ativas"}
          </Text>
        ) : (
          <Text style={styles.subtitle}>Controle o que você paga todo mês e seja avisado de reajustes</Text>
        )}
        {alerts.length > 0 ? (
          <Text style={[styles.subtitle, { color: colors.expense, fontWeight: "600" }]}>
            {alerts.length === 1 ? `Reajuste em ${alerts[0].name}` : `${alerts.length} assinaturas com reajuste`}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { flex: 1, gap: 2 },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
}));
