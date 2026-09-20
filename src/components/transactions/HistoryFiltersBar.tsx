import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";

import { Text, makeStyles, useTheme } from "../../theme";
import { formatCurrency } from "../../utils/currency";
import {
  activeFilterKinds,
  describeFilters,
  type FilterKind,
  type HistoryFilters,
  type TransactionsSummary,
} from "../../utils/historyFilters";

interface HistoryFiltersBarProps {
  filters: HistoryFilters;
  /** Quantas transações apareceram e quanto entrou e saiu nelas (só mostrado com filtro ativo). */
  summary: TransactionsSummary;
  /** O período personalizado não pôde ser carregado. */
  hasError?: boolean;
  onOpen: () => void;
  onClear: (kind: FilterKind) => void;
  onClearAll: () => void;
}

/**
 * Sob a busca: o botão "Filtros" (com quantos grupos estão ativos), uma etiqueta removível para
 * cada filtro em uso e, com filtro ativo, o resumo do que apareceu.
 */
export function HistoryFiltersBar({ filters, summary, hasError = false, onOpen, onClear, onClearAll }: HistoryFiltersBarProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const count = activeFilterKinds(filters).length;
  const chips = describeFilters(filters);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={[styles.button, count > 0 && styles.buttonActive]}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={count > 0 ? `Filtros avançados, ${count} ativos` : "Filtros avançados"}
        >
          <Ionicons name="options-outline" size={18} color={count > 0 ? colors.accent : colors.textSecondary} />
          <Text style={[styles.buttonText, count > 0 && styles.buttonTextActive]}>
            {count > 0 ? `Filtros (${count})` : "Filtros"}
          </Text>
        </TouchableOpacity>

        {count > 0 && (
          <TouchableOpacity onPress={onClearAll} accessibilityRole="button" accessibilityLabel="Limpar todos os filtros">
            <Text style={styles.link}>Limpar filtros</Text>
          </TouchableOpacity>
        )}
      </View>

      {chips.length > 0 && (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <TouchableOpacity
              key={chip.kind}
              style={styles.chip}
              onPress={() => onClear(chip.kind)}
              accessibilityRole="button"
              accessibilityLabel={`Remover filtro: ${chip.label}`}
            >
              <Text style={styles.chipText}>{chip.label}</Text>
              <Ionicons name="close" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {hasError && (
        <Text style={styles.error} accessibilityRole="alert">
          Não foi possível carregar as transações desse período. Tente de novo.
        </Text>
      )}

      {count > 0 && !hasError && (
        <Text style={styles.summary} accessibilityLabel={`${summary.count} transações. Receitas ${formatCurrency(summary.income)}. Despesas ${formatCurrency(summary.expense)}.`}>
          {summary.count} {summary.count === 1 ? "transação" : "transações"}
          {summary.count > 0 && (
            <>
              {" · "}
              <Text style={styles.income}>Receitas {formatCurrency(summary.income)}</Text>
              {" · "}
              <Text style={styles.expense}>Despesas {formatCurrency(summary.expense)}</Text>
            </>
          )}
        </Text>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { marginBottom: 12 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  buttonActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}26` },
  buttonText: { color: colors.textSecondary, fontSize: 14, fontWeight: "600" },
  buttonTextActive: { color: colors.textPrimary },
  link: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipText: { color: colors.textPrimary, fontSize: 12, fontWeight: "600" },
  summary: { color: colors.textMuted, fontSize: 12, marginTop: 10, lineHeight: 17 },
  income: { color: colors.income, fontWeight: "600" },
  expense: { color: colors.expense, fontWeight: "600" },
  error: { color: colors.expense, fontSize: 13, fontWeight: "600", marginTop: 10, lineHeight: 18 },
}));
