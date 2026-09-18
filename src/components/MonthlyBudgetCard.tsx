import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { styles } from "../styles/dashboardStyles";
import { formatCurrency as formatCurrencyDisplay } from "../utils/currency";
import { colors } from "../constants/colors";

interface MonthlyBudgetCardProps {
  monthlyBudget: string;
  setMonthlyBudget: (val: string) => void;
  isEditingBudget: boolean;
  setIsEditingBudget: (val: boolean) => void;
  formatCurrency: (val: string) => string;
}

export function MonthlyBudgetCard({
  monthlyBudget,
  setMonthlyBudget,
  isEditingBudget,
  setIsEditingBudget,
  formatCurrency,
}: MonthlyBudgetCardProps) {
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>Orçamento Mensal</Text>
          <Text style={styles.chartSubtitle}>
            Definido automaticamente pelas receitas
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
            name={isEditingBudget ? "checkmark-outline" : "create-outline"}
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
              value={monthlyBudget}
              onChangeText={(text) => setMonthlyBudget(formatCurrency(text))}
              placeholder="R$ 0,00"
              placeholderTextColor={colors.textPlaceholder}
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
              onPress={() => setIsEditingBudget(false)}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "bold" }}>
                Salvar
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{ fontSize: 22, fontWeight: "bold", color: colors.income }}
            >
              {(() => {
                const parsed = Number(
                  monthlyBudget.toString().replace(/\./g, "").replace(",", "."),
                );
                return isNaN(parsed)
                  ? `R$ ${monthlyBudget}`
                  : formatCurrencyDisplay(parsed);
              })()}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Toque no ícone para editar
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
