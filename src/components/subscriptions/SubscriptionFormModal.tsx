import { useState } from "react";
import { TouchableOpacity, View } from "react-native";

import { DEFAULT_EXPENSE_CATEGORIES, PIX_CATEGORY } from "../../constants/categories";
import { Text, TextInput, makeStyles, useTheme } from "../../theme";
import type { SubscriptionRow } from "../../types";
import { formatCurrencyInput, parseCurrencyInput } from "../../utils/currency";
import { CYCLE_LABELS, validateSubscription, type SubscriptionInput } from "../../utils/subscriptions";
import { CategoryChips } from "../forms/CategoryChips";
import { TopFormSheet } from "../forms/TopFormSheet";

interface SubscriptionFormModalProps {
  visible: boolean;
  /** Assinatura a editar: o formulário abre preenchido com ela. Sem ela, é o de criar. */
  subscription?: SubscriptionRow | null;
  onClose: () => void;
  onSave: (input: SubscriptionInput) => void;
  /** Erro vindo de fora (ex.: falha ao gravar). */
  errorMessage?: string | null;
}

const CATEGORY_OPTIONS = [...DEFAULT_EXPENSE_CATEGORIES.filter((name) => name !== PIX_CATEGORY), "Outros"];

const useFieldStyles = makeStyles(({ colors }) => ({
  input: { backgroundColor: colors.surfaceAlt, color: colors.textPrimary, padding: 16, borderRadius: 12 },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6 },
  field: { marginBottom: 16 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
    minHeight: 44,
    justifyContent: "center",
  },
  chipSelected: { borderColor: colors.accent, backgroundColor: `${colors.accent}26` },
  chipText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  error: { color: colors.expense, fontSize: 13, marginBottom: 12 },
  saveButton: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveText: { color: colors.textPrimary, fontWeight: "bold", fontSize: 16 },
}));

const toNumber = (text: string) => (text.trim() === "" ? NaN : Number(text));

/** Formulário da assinatura: nome, valor, mensal ou anual, dia da cobrança (e mês, se anual), categoria e como aparece na cobrança. */
export function SubscriptionFormModal({ visible, subscription = null, onClose, onSave, errorMessage = null }: SubscriptionFormModalProps) {
  const { colors } = useTheme();
  const styles = useFieldStyles();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [billingDay, setBillingDay] = useState("");
  const [billingMonth, setBillingMonth] = useState("");
  const [category, setCategory] = useState("Lazer");
  const [matchText, setMatchText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isEditing = subscription !== null;

  // Prepara o formulário quando abre (durante a renderização, sem setState no effect).
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(subscription?.name ?? "");
      setAmount(subscription ? formatCurrencyInput(String(Math.round(subscription.amount * 100))) : "");
      setCycle(subscription?.cycle ?? "monthly");
      setBillingDay(subscription ? String(subscription.billing_day) : "");
      setBillingMonth(subscription?.billing_month ? String(subscription.billing_month) : "");
      setCategory(subscription?.category ?? "Lazer");
      setMatchText(subscription?.match_text ?? "");
      setError(null);
    }
  }

  const handleSave = () => {
    const input: SubscriptionInput = {
      name: name.trim(),
      amount: parseCurrencyInput(amount),
      cycle,
      billingDay: toNumber(billingDay),
      billingMonth: cycle === "yearly" ? toNumber(billingMonth) : null,
      category,
      matchText,
    };
    const problem = validateSubscription(input);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onSave(input);
  };

  const shownError = error ?? errorMessage;

  return (
    <TopFormSheet visible={visible} onClose={onClose} title={isEditing ? "Editar assinatura" : "Nova assinatura"}>
      <View style={styles.field}>
        <Text style={styles.label}>Nome</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          accessibilityLabel="Nome da assinatura"
          placeholder="Ex: Netflix, Spotify, Academia"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Valor (R$)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={amount}
          onChangeText={(text) => setAmount(formatCurrencyInput(text))}
          accessibilityLabel="Valor da assinatura"
          placeholder="R$ 0,00"
          placeholderTextColor={colors.textPlaceholder}
        />
        {isEditing ? <Text style={styles.hint}>Mudar o valor registra um reajuste no histórico da assinatura.</Text> : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Cobrança</Text>
        <View style={styles.chipRow}>
          {(["monthly", "yearly"] as const).map((option) => {
            const selected = cycle === option;
            return (
              <TouchableOpacity
                key={option}
                onPress={() => setCycle(option)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Cobrança ${CYCLE_LABELS[option].toLowerCase()}`}
              >
                <Text style={styles.chipText}>{CYCLE_LABELS[option]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.row, styles.field]}>
        <View style={styles.half}>
          <Text style={styles.label}>Dia da cobrança</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            maxLength={2}
            value={billingDay}
            onChangeText={(text) => setBillingDay(text.replace(/\D/g, ""))}
            accessibilityLabel="Dia da cobrança"
            placeholder="Ex: 5"
            placeholderTextColor={colors.textPlaceholder}
          />
        </View>
        {cycle === "yearly" ? (
          <View style={styles.half}>
            <Text style={styles.label}>Mês (1 a 12)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              maxLength={2}
              value={billingMonth}
              onChangeText={(text) => setBillingMonth(text.replace(/\D/g, ""))}
              accessibilityLabel="Mês da cobrança"
              placeholder="Ex: 8"
              placeholderTextColor={colors.textPlaceholder}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Categoria</Text>
        <CategoryChips options={CATEGORY_OPTIONS} selected={category} onSelect={setCategory} accentColor={colors.accent} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Como aparece na cobrança (opcional)</Text>
        <TextInput
          style={styles.input}
          value={matchText}
          onChangeText={setMatchText}
          accessibilityLabel="Texto da cobrança"
          placeholder="Ex: NETFLIX.COM"
          placeholderTextColor={colors.textPlaceholder}
        />
        <Text style={styles.hint}>
          O app compara o valor com as suas despesas que tenham esse texto (ou o nome) para avisar de reajuste.
        </Text>
      </View>

      {shownError ? <Text style={styles.error}>{shownError}</Text> : null}

      <TouchableOpacity onPress={handleSave} style={styles.saveButton} accessibilityRole="button">
        <Text style={styles.saveText}>{isEditing ? "Salvar alterações" : "Criar assinatura"}</Text>
      </TouchableOpacity>
    </TopFormSheet>
  );
}
