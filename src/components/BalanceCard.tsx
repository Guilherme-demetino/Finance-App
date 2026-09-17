import { Text, View } from "react-native";

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
  const isPositive = totalBalance >= 0;
  const balanceColor = isPositive ? "#10B981" : "#EF4444";

  return (
    <View
      style={{
        backgroundColor: "#1E1E1E",
        borderRadius: 16, // Bordas arredondadas restauradas
        width: "100%", // Mantém o cartão esticado acompanhando os outros
        paddingVertical: 24,
        paddingHorizontal: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#2A2A2A",
      }}
    >
      <Text style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>
        Saldo Atual ({selectedMonth} / {selectedYear})
      </Text>

      <Text
        style={{
          color: balanceColor,
          fontSize: 32,
          fontWeight: "bold",
        }}
      >
        {isPositive ? "" : "- "}R${" "}
        {Math.abs(totalBalance).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </Text>
    </View>
  );
}
