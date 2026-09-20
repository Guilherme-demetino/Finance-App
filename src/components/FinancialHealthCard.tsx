import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { Text, makeStyles, useTheme } from "../theme";
import {
  ATTENTION_MIN,
  HEALTHY_MIN,
  WEAK_PILLAR_MAX,
  type FinancialHealth,
  type HealthStatus,
} from "../utils/financialHealth";

const RING_SIZE = 84;
const RING_STROKE = 9;

const STATUS_ICON: Record<HealthStatus, "checkmark-circle" | "warning" | "alert-circle" | "help-circle"> = {
  healthy: "checkmark-circle",
  attention: "warning",
  risk: "alert-circle",
  "no-data": "help-circle",
};

/**
 * Saúde financeira do mês: a nota de 0 a 100 num anel, o estado ("Saudável",
 * "Atenção", "Em risco") e a frase que resume. Ao expandir mostra a nota de cada
 * área e por quê. A cor nunca é o único sinal: o texto e o ícone dizem o estado.
 */
export function FinancialHealthCard({ health }: { health: FinancialHealth }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);

  const toneFor = (score: number) =>
    score >= HEALTHY_MIN ? colors.income : score >= ATTENTION_MIN ? colors.categoryAmber : colors.expense;
  const statusColor: Record<HealthStatus, string> = {
    healthy: colors.income,
    attention: colors.categoryAmber,
    risk: colors.expense,
    "no-data": colors.textMuted,
  };
  const tone = statusColor[health.status];

  const center = RING_SIZE / 2;
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = health.score === null ? 0 : (circumference * health.score) / 100;

  const summary =
    health.score === null
      ? `Saúde financeira: ${health.statusLabel}. ${health.headline}`
      : `Saúde financeira: nota ${health.score} de 100, ${health.statusLabel}. ${health.headline}`;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Saúde Financeira</Text>
      <Text style={styles.subtitle}>Saldo, orçamento e dívidas do mês numa nota só</Text>

      <View style={styles.summaryRow} accessible accessibilityLabel={summary}>
        <View style={styles.ringWrapper}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <G rotation="-90" origin={`${center}, ${center}`}>
              <Circle cx={center} cy={center} r={radius} stroke={colors.surfaceAlt} strokeWidth={RING_STROKE} fill="none" />
              {filled > 0 && (
                <Circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={tone}
                  strokeWidth={RING_STROKE}
                  fill="none"
                  strokeDasharray={`${filled} ${circumference}`}
                  strokeLinecap="round"
                />
              )}
            </G>
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={styles.score}>{health.score === null ? "–" : health.score}</Text>
          </View>
        </View>

        <View style={styles.summaryText}>
          <View style={styles.statusRow}>
            <Ionicons name={STATUS_ICON[health.status]} size={20} color={tone} />
            <Text style={styles.statusLabel}>{health.statusLabel}</Text>
          </View>
          <Text style={styles.headline}>{health.headline}</Text>
        </View>
      </View>

      {health.pillars.length > 0 && (
        <TouchableOpacity
          style={styles.toggle}
          onPress={() => setExpanded((current) => !current)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? "Ocultar detalhes da saúde financeira" : "Ver detalhes da saúde financeira"}
        >
          <Text style={styles.toggleText}>{expanded ? "Ocultar detalhes" : "Ver detalhes"}</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {expanded && (
        <View style={styles.details}>
          {health.pillars.map((pillar) => (
            <View key={pillar.id} style={styles.pillar}>
              <View style={styles.pillarHeader}>
                <Text style={styles.pillarLabel}>{pillar.label}</Text>
                <Text style={styles.pillarScore}>{Math.round(pillar.score)}/100</Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[styles.fill, { width: `${Math.round(pillar.score)}%`, backgroundColor: toneFor(pillar.score) }]}
                />
              </View>
              <Text style={styles.pillarDetail}>{pillar.detail}</Text>
            </View>
          ))}

          {health.hints.map((hint) => (
            <View key={hint} style={styles.hintRow}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={styles.hint}>{hint}</Text>
            </View>
          ))}

          <Text style={styles.method}>
            A nota vai de 0 a 100: saldo do mês (peso 40), orçamento (30) e dívidas a pagar (30). A partir de{" "}
            {HEALTHY_MIN} o mês é saudável, de {ATTENTION_MIN} a {HEALTHY_MIN - 1} pede atenção e abaixo de{" "}
            {ATTENTION_MIN} está em risco. Uma área abaixo de {WEAK_PILLAR_MAX} impede o selo de saudável.
          </Text>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: "bold", color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  summaryRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 16 },
  ringWrapper: { width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" },
  ringCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  score: { fontSize: 26, fontWeight: "bold", color: colors.textPrimary },
  summaryText: { flex: 1 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusLabel: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  headline: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  toggleText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  details: { marginTop: 4 },
  pillar: { marginTop: 14 },
  pillarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pillarLabel: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  pillarScore: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    marginTop: 6,
    overflow: "hidden",
  },
  fill: { height: 6, borderRadius: 3 },
  pillarDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 17 },
  hintRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 12 },
  hint: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  method: { fontSize: 11, color: colors.textMuted, marginTop: 16, lineHeight: 16 },
}));
