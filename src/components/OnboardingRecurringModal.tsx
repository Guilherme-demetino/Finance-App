import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "../constants/categories";
import type { RecurringDraft, TransactionType } from "../types";
import { CategoryChips } from "./CategoryChips";
import { TopFormSheet } from "./TopFormSheet";
import { Text, TextInput, makeStyles, useTheme } from "../theme";

interface OnboardingRecurringModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: Omit<RecurringDraft, "id">) => void;
  formatCurrency: (val: string) => string;
  months: number;
}

const useFieldStyles = makeStyles(({ colors }) => ({
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    padding: 16,
    borderRadius: 12,
  },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
}));

export function OnboardingRecurringModal({
  visible,
  onClose,
  onSave,
  formatCurrency,
  months,
}: OnboardingRecurringModalProps) {
  const { colors } = useTheme();
  const { input: inputStyle, label: labelStyle } = useFieldStyles();
  const [type, setType] = useState<TransactionType>("income");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [category, setCategory] = useState(DEFAULT_INCOME_CATEGORIES[0]);
  const [error, setError] = useState<string | null>(null);

  // Reseta o formulário quando o modal abre (durante a renderização, sem setState no effect).
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setType("income");
      setTitle("");
      setAmount("");
      setDay("");
      setCategory(DEFAULT_INCOME_CATEGORIES[0]);
      setError(null);
    }
  }

  const handleTypeChange = (next: TransactionType) => {
    setType(next);
    setCategory(
      next === "income"
        ? DEFAULT_INCOME_CATEGORIES[0]
        : DEFAULT_EXPENSE_CATEGORIES[0],
    );
  };

  const handleSave = () => {
    const numericAmount = Number(amount.replace(/\./g, "").replace(",", "."));
    const numericDay = Number(day);
    if (
      !title.trim() ||
      isNaN(numericAmount) ||
      numericAmount <= 0 ||
      !Number.isInteger(numericDay) ||
      numericDay < 1 ||
      numericDay > 31
    ) {
      setError("Preencha o título, o valor e um dia do mês entre 1 e 31.");
      return;
    }

    onSave({
      type,
      title: title.trim(),
      amount: numericAmount,
      day: numericDay,
      category,
    });
  };

  const accentColor = type === "income" ? colors.income : colors.expense;
  const categories =
    type === "income" ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;

  return (
    <TopFormSheet visible={visible} onClose={onClose} title="Receita/Despesa fixa">
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor:
              type === "income" ? `${colors.income}26` : colors.surfaceAlt,
            borderWidth: 1,
            borderColor: type === "income" ? colors.income : colors.surfaceAlt,
          }}
          onPress={() => handleTypeChange("income")}
        >
          <Text
            style={{
              color: type === "income" ? colors.income : colors.textMuted,
              fontWeight: "bold",
            }}
          >
            Receita
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor:
              type === "expense" ? `${colors.expense}26` : colors.surfaceAlt,
            borderWidth: 1,
            borderColor: type === "expense" ? colors.expense : colors.surfaceAlt,
          }}
          onPress={() => handleTypeChange("expense")}
        >
          <Text
            style={{
              color: type === "expense" ? colors.expense : colors.textMuted,
              fontWeight: "bold",
            }}
          >
            Despesa
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={labelStyle}>Título</Text>
        <TextInput
          style={inputStyle}
          value={title}
          onChangeText={setTitle}
          placeholder={type === "income" ? "Ex: Salário" : "Ex: Aluguel"}
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 2 }}>
          <Text style={labelStyle}>Valor (R$)</Text>
          <TextInput
            style={inputStyle}
            keyboardType="numeric"
            value={amount}
            onChangeText={(text) => setAmount(formatCurrency(text))}
            placeholder="R$ 0,00"
            placeholderTextColor={colors.textPlaceholder}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={labelStyle}>Todo dia</Text>
          <TextInput
            style={inputStyle}
            keyboardType="number-pad"
            maxLength={2}
            value={day}
            onChangeText={(text) => setDay(text.replace(/\D/g, ""))}
            placeholder="5"
            placeholderTextColor={colors.textPlaceholder}
          />
        </View>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={labelStyle}>Categoria</Text>
        <CategoryChips
          options={categories}
          selected={category}
          onSelect={setCategory}
          accentColor={accentColor}
        />
      </View>

      <Text
        style={{
          color: colors.textMuted,
          fontSize: 12,
          lineHeight: 18,
          marginBottom: 20,
        }}
      >
        Repete todo mês, pelos próximos {months} meses, a partir deste
        mês.
      </Text>

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
