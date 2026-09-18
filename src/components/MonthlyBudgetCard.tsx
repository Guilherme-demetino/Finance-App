import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/colors";
import { styles } from "../styles/dashboardStyles";
import { formatCurrency as formatCurrencyDisplay } from "../utils/currency";

interface MonthlyBudgetCardProps {
  budget: number | null;
  totalExpense: number;
  isEditingBudget: boolean;
  setIsEditingBudget: (val: boolean) => void;
  onSaveBudget: (amount: number) => void;
  formatCurrency: (val: string) => string;
}

export function MonthlyBudgetCard({
  budget,
  totalExpense,
  isEditingBudget,
  setIsEditingBudget,
  onSaveBudget,
  formatCurrency,
}: MonthlyBudgetCardProps) {
  const [draftAmount, setDraftAmount] = useState("");

  useEffect(() => {
    if (isEditingBudget) {
      const cents = budget ? Math.round(budget * 100).toString() : "";
      setDraftAmount(cents ? formatCurrency(cents) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só precisa rodar quando entra/sai do modo de edição
  }, [isEditingBudget]);

  const handleSave = () => {
    const numericValue = Number(
      draftAmount.replace(/\./g, "").replace(",", "."),
    );
    if (!isNaN(numericValue) && numericValue > 0) {
      onSaveBudget(numericValue);
    }
    setIsEditingBudget(false);
  };

  const hasBudget = budget !== null && budget > 0;
  const percent = hasBudget ? totalExpense / budget : 0;
  const remaining = hasBudget ? budget - totalExpense : 0;
  const isOverBudget = remaining < 0;
  const barColor =
    percent < 0.8
      ? colors.income
      : percent < 1
        ? colors.categoryAmber
        : colors.expense;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>Orçamento Mensal</Text>
          <Text style={styles.chartSubtitle}>
            {hasBudget
              ? "Quanto você já gastou neste mês"
              : "Defina uma meta de gastos para este mês"}
          </Text>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.textPrimary,
            borderRadius: 12,
            width: 40,
            height: 40,
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={() => setIsEditingBudget(!isEditingBudget)}
        >
          <Ionicons
            name={isEditingBudget ? "close-outline" : "create-outline"}
            size={20}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 12 }}>
        {isEditingBudget ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.textPrimary,
                borderRadius: 12,
                padding: 12,
                color: colors.textPrimary,
                fontSize: 16,
              }}
              keyboardType="numeric"
              value={draftAmount}
              onChangeText={(text) => setDraftAmount(formatCurrency(text))}
              placeholder="R$ 0,00"
              placeholderTextColor={colors.textPlaceholder}
              autoFocus
            />
            <TouchableOpacity
              style={{
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.textPrimary,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
              }}
              onPress={handleSave}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "bold" }}>
                Salvar
              </Text>
            </TouchableOpacity>
          </View>
        ) : hasBudget ? (
          <View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: "bold", color: barColor }}>
                {formatCurrencyDisplay(totalExpense)}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                de {formatCurrencyDisplay(budget)}
              </Text>
            </View>

            <View
              style={{
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.surfaceAlt,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${Math.min(percent * 100, 100)}%`,
                  backgroundColor: barColor,
                  borderRadius: 5,
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                {Math.round(percent * 100)}% usado
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "bold",
                  color: isOverBudget ? colors.expense : colors.income,
                }}
              >
                {isOverBudget
                  ? `${formatCurrencyDisplay(Math.abs(remaining))} acima do orçamento`
                  : `${formatCurrencyDisplay(remaining)} restantes`}
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setIsEditingBudget(true)}
            style={{
              alignItems: "center",
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: colors.surfaceAlt,
              borderStyle: "dashed",
              borderRadius: 12,
            }}
          >
            <Ionicons name="wallet-outline" size={24} color={colors.textMuted} />
            <Text
              style={{
                color: colors.textPrimary,
                fontWeight: "bold",
                fontSize: 14,
                marginTop: 8,
              }}
            >
              Nenhum orçamento definido
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              Toque para definir quanto pretende gastar
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
