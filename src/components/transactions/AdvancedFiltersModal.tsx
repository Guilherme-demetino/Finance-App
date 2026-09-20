import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, ScrollView, TouchableOpacity, View } from "react-native";

import { CalendarPicker } from "../forms/CalendarPicker";
import { Text, TextInput, makeStyles, modalCard, modalScrim, useTheme } from "../../theme";
import { formatCurrencyInput, parseCurrencyInput } from "../../utils/currency";
import { parseDueDate } from "../../utils/dueReminders";
import { formatDateToString } from "../../utils/dates";
import {
  PERIOD_PRESETS,
  presetRange,
  validateFilters,
  type HistoryFilters,
} from "../../utils/historyFilters";

interface AdvancedFiltersModalProps {
  visible: boolean;
  /** Os filtros em uso: o formulário abre já preenchido com eles. */
  value: HistoryFilters;
  /** Categorias que podem ser marcadas. */
  categories: string[];
  onApply: (filters: HistoryFilters) => void;
  onClose: () => void;
}

/** Valor em reais → o texto que o campo mostra ("1.250,50"); vazio para "sem limite". */
const toFieldText = (amount: number | null) => (amount === null ? "" : formatCurrencyInput(String(Math.round(amount * 100))));

const sameCategory = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

type CalendarTarget = "from" | "to" | null;

function FiltersForm({ value, categories, onApply, onClose }: Omit<AdvancedFiltersModalProps, "visible">) {
  const theme = useTheme();
  const { colors } = theme;
  const styles = useStyles();

  const [useCustomPeriod, setUseCustomPeriod] = useState(value.period !== null);
  const [from, setFrom] = useState<string | null>(value.period?.from ?? null);
  const [to, setTo] = useState<string | null>(value.period?.to ?? null);
  const [minText, setMinText] = useState(toFieldText(value.minAmount));
  const [maxText, setMaxText] = useState(toFieldText(value.maxAmount));
  const [selected, setSelected] = useState<string[]>(value.categories);
  const [calendarFor, setCalendarFor] = useState<CalendarTarget>(null);

  const draft: HistoryFilters = {
    minAmount: parseCurrencyInput(minText),
    maxAmount: parseCurrencyInput(maxText),
    categories: selected,
    period: useCustomPeriod ? { from: from ?? "", to: to ?? "" } : null,
  };
  const error = validateFilters(draft);

  const reset = () => {
    setUseCustomPeriod(false);
    setFrom(null);
    setTo(null);
    setMinText("");
    setMaxText("");
    setSelected([]);
  };

  const toggleCategory = (name: string) =>
    setSelected((current) =>
      current.some((item) => sameCategory(item, name))
        ? current.filter((item) => !sameCategory(item, name))
        : [...current, name],
    );

  const applyPreset = (range: { from: string; to: string }) => {
    setUseCustomPeriod(true);
    setFrom(range.from);
    setTo(range.to);
  };

  const calendarValue = (target: "from" | "to") => parseDueDate(target === "from" ? from : to) ?? new Date();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: modalScrim(theme, 0.6) }]}>
        <View style={[styles.card, modalCard(theme)]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title} accessibilityRole="header">
              Filtros avançados
            </Text>

            {/* ------------------------------------------------------------ período */}
            <Text style={styles.section}>Período</Text>
            <View style={styles.row}>
              {[
                { custom: false, label: "Mês selecionado" },
                { custom: true, label: "Personalizado" },
              ].map((option) => {
                const isActive = useCustomPeriod === option.custom;
                return (
                  <TouchableOpacity
                    key={option.label}
                    style={[styles.segment, isActive && styles.segmentActive]}
                    onPress={() => setUseCustomPeriod(option.custom)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`Período: ${option.label}`}
                  >
                    <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {useCustomPeriod && (
              <>
                <View style={styles.row}>
                  {(["from", "to"] as const).map((target) => {
                    const date = target === "from" ? from : to;
                    const label = target === "from" ? "De" : "Até";
                    return (
                      <TouchableOpacity
                        key={target}
                        style={styles.dateButton}
                        onPress={() => setCalendarFor(target)}
                        accessibilityRole="button"
                        accessibilityLabel={date ? `${label}: ${date}` : `${label}: escolher data`}
                      >
                        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                        <View>
                          <Text style={styles.dateLabel}>{label}</Text>
                          <Text style={styles.dateValue}>{date ?? "Escolher"}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.chips}>
                  {PERIOD_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.id}
                      style={styles.chip}
                      onPress={() => applyPreset(presetRange(preset.id))}
                      accessibilityRole="button"
                      accessibilityLabel={`Usar ${preset.label}`}
                    >
                      <Text style={styles.chipText}>{preset.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* -------------------------------------------------------------- valor */}
            <Text style={styles.section}>Valor</Text>
            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Mínimo (R$)</Text>
                <TextInput
                  style={styles.input}
                  value={minText}
                  onChangeText={(text) => setMinText(formatCurrencyInput(text))}
                  keyboardType="numeric"
                  placeholder="0,00"
                  placeholderTextColor={colors.textPlaceholder}
                  accessibilityLabel="Valor mínimo"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Máximo (R$)</Text>
                <TextInput
                  style={styles.input}
                  value={maxText}
                  onChangeText={(text) => setMaxText(formatCurrencyInput(text))}
                  keyboardType="numeric"
                  placeholder="sem limite"
                  placeholderTextColor={colors.textPlaceholder}
                  accessibilityLabel="Valor máximo"
                />
              </View>
            </View>

            {/* --------------------------------------------------------- categorias */}
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Categorias</Text>
              {selected.length > 0 && (
                <TouchableOpacity onPress={() => setSelected([])} accessibilityRole="button" accessibilityLabel="Desmarcar todas as categorias">
                  <Text style={styles.link}>Desmarcar ({selected.length})</Text>
                </TouchableOpacity>
              )}
            </View>
            {categories.length === 0 ? (
              <Text style={styles.hint}>Nenhuma categoria cadastrada ainda.</Text>
            ) : (
              <View style={styles.chips}>
                {categories.map((name) => {
                  const checked = selected.some((item) => sameCategory(item, name));
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[styles.chip, checked && styles.chipChecked]}
                      onPress={() => toggleCategory(name)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      accessibilityLabel={`Categoria ${name}`}
                    >
                      {checked && <Ionicons name="checkmark" size={14} color={colors.accent} />}
                      <Text style={[styles.chipText, checked && styles.chipTextChecked]}>{name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <Text style={styles.hint}>Marque quantas quiser: aparecem as transações de qualquer uma delas.</Text>

            {error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, error !== null && styles.disabled]}
              onPress={() => {
                if (error === null) onApply(draft);
              }}
              disabled={error !== null}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Aplicar filtros</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={reset} accessibilityRole="button">
              <Text style={styles.secondaryText}>Limpar tudo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityRole="button">
              <Text style={styles.closeText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {calendarFor !== null && (
        <CalendarPicker
          visible
          value={calendarValue(calendarFor)}
          onClose={() => setCalendarFor(null)}
          onSelect={(date) => {
            const text = formatDateToString(date);
            if (calendarFor === "from") setFrom(text);
            else setTo(text);
            setCalendarFor(null);
          }}
          accentColor={colors.accent}
        />
      )}
    </Modal>
  );
}

/** Filtros avançados da busca do histórico. O formulário só existe enquanto o modal está aberto: cada abertura começa dos filtros em uso. */
export function AdvancedFiltersModal({ visible, ...rest }: AdvancedFiltersModalProps) {
  if (!visible) return null;
  return <FiltersForm {...rest} />;
}


const useStyles = makeStyles(({ colors }) => ({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxHeight: "92%",
    borderRadius: 20,
    padding: 20,
  },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: 4 },
  section: { color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", gap: 10 },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
  },
  segmentActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}26` },
  segmentText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", textAlign: "center" },
  segmentTextActive: { color: colors.textPrimary },
  dateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
  },
  dateLabel: { color: colors.textMuted, fontSize: 11 },
  dateValue: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipChecked: { borderColor: colors.accent, backgroundColor: `${colors.accent}26` },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  chipTextChecked: { color: colors.textPrimary },
  field: { flex: 1 },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  link: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  error: { color: colors.expense, fontSize: 14, fontWeight: "600", lineHeight: 20, marginTop: 14 },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },
  primaryText: { color: colors.textOnColor, fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
  },
  secondaryText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  closeButton: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  closeText: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.4 },
}));
