import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";

import type { PurchaseFormData } from "../../hooks/useCreditCards";
import { Text, TextInput, makeStyles, useTheme } from "../../theme";
import type { CardPurchaseRow, CreditCardRow } from "../../types";
import { invoiceDates, invoiceRefFor, formatRef, MAX_INSTALLMENTS, validatePurchase } from "../../utils/creditCards";
import { formatCurrency, formatCurrencyInput, parseCurrencyInput, splitAmountIntoInstallments } from "../../utils/currency";
import { formatDateToString, parseDateString } from "../../utils/dates";
import { CalendarPicker } from "../forms/CalendarPicker";
import { CategoryChips } from "../forms/CategoryChips";
import { TopFormSheet } from "../forms/TopFormSheet";

interface PurchaseFormModalProps {
  visible: boolean;
  card: CreditCardRow | null;
  /** Compra a editar (uma parcela é uma compra). Sem ela, é o formulário de lançar uma compra nova. */
  purchase?: CardPurchaseRow | null;
  categoryOptions: string[];
  onClose: () => void;
  onSave: (form: PurchaseFormData) => void;
  /** Erro vindo de fora (ex.: fatura já paga), mostrado abaixo dos campos. */
  errorMessage?: string | null;
}

const useFieldStyles = makeStyles(({ colors }) => ({
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    padding: 16,
    borderRadius: 12,
  },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  field: { marginBottom: 16 },
  dateButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  preview: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  previewText: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
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

const toInstallments = (text: string) => (text.trim() === "" ? 1 : Number(text));

/** Formulário de compra no cartão: descrição, valor, data, categoria e parcelas, com a fatura em que vai cair. */
export function PurchaseFormModal({
  visible,
  card,
  purchase = null,
  categoryOptions,
  onClose,
  onSave,
  errorMessage = null,
}: PurchaseFormModalProps) {
  const { colors } = useTheme();
  const styles = useFieldStyles();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date());
  const [category, setCategory] = useState("Outros");
  const [installments, setInstallments] = useState("1");
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = purchase !== null;
  const isInstallment = purchase?.installment_group_id != null;

  // Prepara o formulário quando abre (durante a renderização, sem setState no effect).
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDescription(purchase?.description ?? "");
      setAmount(purchase ? formatCurrencyInput(String(Math.round(purchase.amount * 100))) : "");
      setDate(purchase ? parseDateString(purchase.date) : new Date());
      setCategory(purchase?.category ?? (categoryOptions.includes("Outros") ? "Outros" : (categoryOptions[0] ?? "Outros")));
      setInstallments("1");
      setError(null);
    }
  }

  const amountValue = parseCurrencyInput(amount);
  const count = toInstallments(installments);

  const handleSave = () => {
    const problem = validatePurchase({ description, amount: amountValue, installments: isEditing ? 1 : count });
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onSave({ description: description.trim(), amount: amountValue, date, category, installments: isEditing ? 1 : count });
  };

  // Onde a compra vai cair: só faz sentido com o cartão e (na edição de parcela) a data fixa.
  let preview: string | null = null;
  if (card && !isInstallment) {
    const ref = invoiceRefFor(date, card);
    const dueDate = formatDateToString(invoiceDates(ref, card).due);
    preview = `Entra na fatura de ${formatRef(ref)} (vence em ${dueDate}).`;
    if (!isEditing && amountValue !== null && amountValue > 0 && Number.isInteger(count) && count > 1 && count <= MAX_INSTALLMENTS) {
      const [first] = splitAmountIntoInstallments(amountValue, count);
      preview += ` ${count}x de ${formatCurrency(first)}, uma em cada fatura.`;
    }
  } else if (isInstallment && purchase) {
    preview = `Parcela ${purchase.installment_number}/${purchase.installment_total}: fica na fatura de ${formatRef(purchase.invoice_ref)}. Só descrição, valor e categoria mudam.`;
  }

  const shownError = error ?? errorMessage;
  const title = isEditing ? "Editar compra" : `Nova compra${card ? ` no ${card.name}` : ""}`;

  return (
    <TopFormSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.field}>
        <Text style={styles.label}>Descrição</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          accessibilityLabel="Descrição da compra"
          placeholder="Ex: Mercado, Notebook"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{isEditing || count <= 1 ? "Valor (R$)" : "Valor total (R$)"}</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={amount}
          onChangeText={(text) => setAmount(formatCurrencyInput(text))}
          accessibilityLabel="Valor da compra"
          placeholder="R$ 0,00"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      {!isInstallment ? (
        <View style={styles.field}>
          <Text style={styles.label}>Data da compra</Text>
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Data da compra: ${formatDateToString(date)}`}
            style={[styles.input, styles.dateButton]}
          >
            <Text style={{ color: colors.textPrimary }}>{formatDateToString(date)}</Text>
            <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <CalendarPicker
            visible={showPicker}
            value={date}
            accentColor={colors.accent}
            onClose={() => setShowPicker(false)}
            onSelect={(selected) => {
              setShowPicker(false);
              setDate(selected);
            }}
          />
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>Categoria</Text>
        <CategoryChips options={categoryOptions} selected={category} onSelect={setCategory} accentColor={colors.accent} />
      </View>

      {!isEditing ? (
        <View style={styles.field}>
          <Text style={styles.label}>Parcelas (1 = à vista)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            maxLength={2}
            value={installments}
            onChangeText={(text) => setInstallments(text.replace(/\D/g, ""))}
            accessibilityLabel="Número de parcelas"
            placeholder="1"
            placeholderTextColor={colors.textPlaceholder}
          />
        </View>
      ) : null}

      {preview ? (
        <View style={styles.preview}>
          <Text style={styles.previewText}>{preview}</Text>
        </View>
      ) : null}

      {shownError ? <Text style={styles.error}>{shownError}</Text> : null}

      <TouchableOpacity onPress={handleSave} style={styles.saveButton} accessibilityRole="button">
        <Text style={styles.saveText}>{isEditing ? "Salvar alterações" : "Lançar compra"}</Text>
      </TouchableOpacity>
    </TopFormSheet>
  );
}
