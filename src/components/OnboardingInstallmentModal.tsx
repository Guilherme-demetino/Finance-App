import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { DEFAULT_EXPENSE_CATEGORIES } from "../constants/categories";
import { colors } from "../constants/colors";
import type { InstallmentDraft } from "../types";
import { formatDateToString, parseDateString } from "../utils/dates";
import { CalendarPicker } from "./CalendarPicker";
import { CategoryChips } from "./CategoryChips";
import { TopFormSheet } from "./TopFormSheet";

interface OnboardingInstallmentModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: Omit<InstallmentDraft, "id">) => void;
  formatCurrency: (val: string) => string;
}

const MAX_INSTALLMENTS = 60;

const inputStyle = {
  backgroundColor: colors.surfaceAlt,
  color: colors.textPrimary,
  padding: 16,
  borderRadius: 12,
};

const labelStyle = { color: colors.textMuted, fontSize: 13, marginBottom: 8 };

export function OnboardingInstallmentModal({
  visible,
  onClose,
  onSave,
  formatCurrency,
}: OnboardingInstallmentModalProps) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [current, setCurrent] = useState("");
  const [total, setTotal] = useState("");
  const [firstDate, setFirstDate] = useState("");
  const [category, setCategory] = useState(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setAmount("");
      setCurrent("");
      setTotal("");
      setFirstDate(formatDateToString(new Date()));
      setCategory(DEFAULT_EXPENSE_CATEGORIES[0]);
      setError(null);
    }
  }, [visible]);

  const numericCurrent = Number(current);
  const numericTotal = Number(total);
  const hasValidCounts =
    Number.isInteger(numericCurrent) &&
    Number.isInteger(numericTotal) &&
    numericTotal >= 2 &&
    numericTotal <= MAX_INSTALLMENTS &&
    numericCurrent >= 1 &&
    numericCurrent <= numericTotal;
  const remaining = hasValidCounts ? numericTotal - numericCurrent + 1 : 0;

  const handleSave = () => {
    const numericAmount = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!title.trim() || isNaN(numericAmount) || numericAmount <= 0) {
      setError("Preencha o título e o valor de cada parcela.");
      return;
    }
    if (!hasValidCounts) {
      setError(
        `Informe a próxima parcela e o total (de 2 a ${MAX_INSTALLMENTS}), com a próxima parcela não maior que o total.`,
      );
      return;
    }

    onSave({
      title: title.trim(),
      installmentAmount: numericAmount,
      startNumber: numericCurrent,
      total: numericTotal,
      firstDate,
      category,
    });
  };

  return (
    <TopFormSheet visible={visible} onClose={onClose} title="Compra parcelada">
      <View style={{ marginBottom: 16 }}>
        <Text style={labelStyle}>Título</Text>
        <TextInput
          style={inputStyle}
          value={title}
          onChangeText={setTitle}
          placeholder="Ex: Celular"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={labelStyle}>Valor de cada parcela (R$)</Text>
        <TextInput
          style={inputStyle}
          keyboardType="numeric"
          value={amount}
          onChangeText={(text) => setAmount(formatCurrency(text))}
          placeholder="R$ 0,00"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={labelStyle}>Próxima parcela</Text>
          <TextInput
            style={inputStyle}
            keyboardType="number-pad"
            maxLength={2}
            value={current}
            onChangeText={(text) => setCurrent(text.replace(/\D/g, ""))}
            placeholder="Ex: 3"
            placeholderTextColor={colors.textPlaceholder}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={labelStyle}>Total de parcelas</Text>
          <TextInput
            style={inputStyle}
            keyboardType="number-pad"
            maxLength={2}
            value={total}
            onChangeText={(text) => setTotal(text.replace(/\D/g, ""))}
            placeholder="Ex: 10"
            placeholderTextColor={colors.textPlaceholder}
          />
        </View>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={labelStyle}>Data da próxima parcela</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={{
            ...inputStyle,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: colors.textPrimary }}>
            {firstDate || "DD/MM/AAAA"}
          </Text>
          <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
        <CalendarPicker
          visible={showDatePicker}
          value={parseDateString(firstDate)}
          accentColor={colors.expense}
          onClose={() => setShowDatePicker(false)}
          onSelect={(selectedDate) => {
            setShowDatePicker(false);
            setFirstDate(formatDateToString(selectedDate));
          }}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={labelStyle}>Categoria</Text>
        <CategoryChips
          options={DEFAULT_EXPENSE_CATEGORIES}
          selected={category}
          onSelect={setCategory}
          accentColor={colors.expense}
        />
      </View>

      {hasValidCounts ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            lineHeight: 18,
            marginBottom: 20,
          }}
        >
          Vamos lançar {remaining} {remaining === 1 ? "parcela" : "parcelas"}
          : da {numericCurrent}/{numericTotal} até a {numericTotal}/
          {numericTotal}.
        </Text>
      ) : (
        <View style={{ height: 4 }} />
      )}

      {error ? (
        <Text style={{ color: colors.expense, fontSize: 13, marginBottom: 12 }}>
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={handleSave}
        style={{
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1,
          borderColor: colors.textPrimary,
          padding: 16,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text
          style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 16 }}
        >
          Adicionar
        </Text>
      </TouchableOpacity>
    </TopFormSheet>
  );
}
