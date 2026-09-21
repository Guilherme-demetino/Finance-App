import { useState } from "react";
import { TouchableOpacity, View } from "react-native";

import type { CreditCardInput } from "../../database/creditCards";
import { Text, TextInput, makeStyles, useTheme } from "../../theme";
import type { CreditCardRow } from "../../types";
import { formatCurrencyInput, parseCurrencyInput } from "../../utils/currency";
import { validateCard } from "../../utils/creditCards";
import { TopFormSheet } from "../forms/TopFormSheet";

interface CardFormModalProps {
  visible: boolean;
  /** Cartão a editar: o formulário abre preenchido com ele. Sem cartão, é o de criar. */
  card?: CreditCardRow | null;
  onClose: () => void;
  onSave: (input: CreditCardInput) => void;
  /** Erro vindo de fora (ex.: falha ao gravar), mostrado abaixo dos campos. */
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
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 16 },
  error: { color: colors.expense, fontSize: 13, marginBottom: 12 },
  row: { flexDirection: "row", gap: 12, marginBottom: 8 },
  half: { flex: 1 },
  field: { marginBottom: 16 },
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

const toDayNumber = (text: string) => (text.trim() === "" ? NaN : Number(text));

/** Formulário do cartão: nome, dia de fechamento, dia de vencimento e limite (opcional). */
export function CardFormModal({ visible, card = null, onClose, onSave, errorMessage = null }: CardFormModalProps) {
  const { colors } = useTheme();
  const styles = useFieldStyles();
  const [name, setName] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isEditing = card !== null;

  // Prepara o formulário quando abre (durante a renderização, sem setState no effect).
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(card?.name ?? "");
      setClosingDay(card ? String(card.closing_day) : "");
      setDueDay(card ? String(card.due_day) : "");
      setLimit(card?.credit_limit != null ? formatCurrencyInput(String(Math.round(card.credit_limit * 100))) : "");
      setError(null);
    }
  }

  const handleSave = () => {
    const input: CreditCardInput = {
      name: name.trim(),
      closingDay: toDayNumber(closingDay),
      dueDay: toDayNumber(dueDay),
      limit: parseCurrencyInput(limit),
    };
    const problem = validateCard(input);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onSave(input);
  };

  const shownError = error ?? errorMessage;

  return (
    <TopFormSheet visible={visible} onClose={onClose} title={isEditing ? "Editar cartão" : "Novo cartão"}>
      <View style={styles.field}>
        <Text style={styles.label}>Nome do cartão</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          accessibilityLabel="Nome do cartão"
          placeholder="Ex: Nubank, Inter"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Dia do fechamento</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            maxLength={2}
            value={closingDay}
            onChangeText={(text) => setClosingDay(text.replace(/\D/g, ""))}
            accessibilityLabel="Dia do fechamento"
            placeholder="Ex: 28"
            placeholderTextColor={colors.textPlaceholder}
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Dia do vencimento</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            maxLength={2}
            value={dueDay}
            onChangeText={(text) => setDueDay(text.replace(/\D/g, ""))}
            accessibilityLabel="Dia do vencimento"
            placeholder="Ex: 5"
            placeholderTextColor={colors.textPlaceholder}
          />
        </View>
      </View>
      <Text style={styles.hint}>
        Compras feitas até o dia do fechamento entram na fatura que fecha naquele mês; as seguintes, na fatura do mês
        seguinte.
        {isEditing ? " Mudar os dias vale só para compras novas: as já lançadas ficam nas faturas em que estão." : ""}
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Limite (opcional)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={limit}
          onChangeText={(text) => setLimit(formatCurrencyInput(text))}
          accessibilityLabel="Limite do cartão"
          placeholder="R$ 0,00"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      {shownError ? <Text style={styles.error}>{shownError}</Text> : null}

      <TouchableOpacity onPress={handleSave} style={styles.saveButton} accessibilityRole="button">
        <Text style={styles.saveText}>{isEditing ? "Salvar alterações" : "Criar cartão"}</Text>
      </TouchableOpacity>
    </TopFormSheet>
  );
}
