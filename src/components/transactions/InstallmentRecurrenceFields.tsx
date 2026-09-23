import { Ionicons } from "@expo/vector-icons";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { formatCurrency as formatCurrencyDisplay } from "../../utils/currency";
import { Text, useTheme } from "../../theme";

const INSTALLMENT_OPTIONS = [2, 3, 4, 6, 10, 12];
const RECURRING_MONTHS_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface InstallmentRecurrenceFieldsProps {
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  recurringMonths: number;
  setRecurringMonths: (value: number) => void;
  installmentCount: number;
  setInstallmentCount: (value: number) => void;
  numericAmount: number;
  hasValidAmount: boolean;
}

/** Bloco "Repetição" do formulário de transação: alterna entre recorrente (todo mês) e parcelado (N vezes). */
export function InstallmentRecurrenceFields({
  isRecurring,
  setIsRecurring,
  recurringMonths,
  setRecurringMonths,
  installmentCount,
  setInstallmentCount,
  numericAmount,
  hasValidAmount,
}: InstallmentRecurrenceFieldsProps) {
  const { colors } = useTheme();

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 10 }}>
        Repetição
      </Text>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          onPress={() => {
            const next = !isRecurring;
            setIsRecurring(next);
            if (next) setInstallmentCount(1);
          }}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            backgroundColor: isRecurring ? `${colors.income}26` : colors.surfaceAlt,
            borderWidth: 1,
            borderColor: isRecurring ? colors.income : colors.surfaceAlt,
            borderRadius: 12,
            paddingVertical: 12,
          }}
        >
          <Ionicons
            name="repeat"
            size={16}
            color={isRecurring ? colors.income : colors.textMuted}
          />
          <Text
            style={{
              color: isRecurring ? colors.income : colors.textMuted,
              fontWeight: "bold",
              fontSize: 13,
            }}
          >
            Recorrente
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (installmentCount > 1) {
              setInstallmentCount(1);
            } else {
              setInstallmentCount(2);
              setIsRecurring(false);
            }
          }}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            backgroundColor:
              installmentCount > 1 ? `${colors.income}26` : colors.surfaceAlt,
            borderWidth: 1,
            borderColor:
              installmentCount > 1 ? colors.income : colors.surfaceAlt,
            borderRadius: 12,
            paddingVertical: 12,
          }}
        >
          <Ionicons
            name="card-outline"
            size={16}
            color={installmentCount > 1 ? colors.income : colors.textMuted}
          />
          <Text
            style={{
              color: installmentCount > 1 ? colors.income : colors.textMuted,
              fontWeight: "bold",
              fontSize: 13,
            }}
          >
            Parcelar
          </Text>
        </TouchableOpacity>
      </View>

      {isRecurring && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            {RECURRING_MONTHS_OPTIONS.map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setRecurringMonths(n)}
                style={{
                  backgroundColor:
                    recurringMonths === n ? colors.income : colors.surfaceAlt,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    color:
                      recurringMonths === n ? colors.surface : colors.textPrimary,
                    fontWeight: "bold",
                    fontSize: 12,
                  }}
                >
                  {n} meses
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {installmentCount > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            {INSTALLMENT_OPTIONS.map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setInstallmentCount(n)}
                style={{
                  backgroundColor:
                    installmentCount === n ? colors.income : colors.surfaceAlt,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    color:
                      installmentCount === n ? colors.surface : colors.textPrimary,
                    fontWeight: "bold",
                    fontSize: 12,
                  }}
                >
                  {n}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {isRecurring && (
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 10 }}>
          Essa transação vai se repetir automaticamente todo mês,
          pelos próximos {recurringMonths} meses.
        </Text>
      )}

      {installmentCount > 1 && hasValidAmount && (
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 10 }}>
          {installmentCount}x de{" "}
          {formatCurrencyDisplay(numericAmount / installmentCount)}{" "}
          — valor total: {formatCurrencyDisplay(numericAmount)}
        </Text>
      )}
    </View>
  );
}
