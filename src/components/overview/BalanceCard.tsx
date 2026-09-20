import { View } from "react-native";
import { formatCurrency } from "../../utils/currency";
import { Text, useTheme } from "../../theme";

interface BalanceCardProps {
  totalBalance: number;
  selectedMonth: string;
  selectedYear: string;
}

export function BalanceCard({
  totalBalance,
  selectedMonth,
  selectedYear,
}: BalanceCardProps) {
  const { colors } = useTheme();
  const balanceColor = totalBalance >= 0 ? colors.income : colors.expense;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16, // Bordas arredondadas restauradas
        width: "100%", // Mantém o cartão esticado acompanhando os outros
        paddingVertical: 24,
        paddingHorizontal: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.surfaceAlt,
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
        Saldo Atual ({selectedMonth} / {selectedYear})
      </Text>

      <Text
        style={{
          color: balanceColor,
          fontSize: 32,
          fontWeight: "bold",
        }}
      >
        {formatCurrency(totalBalance)}
      </Text>
    </View>
  );
}
