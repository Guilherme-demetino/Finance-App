import { Text, View } from "react-native";
import { styles } from "../app/../styles/dashboardStyles";

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
  return (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>
        Saldo Atual ({selectedMonth} / {selectedYear})
      </Text>
      <Text style={styles.balanceAmount}>
        R$ {totalBalance.toFixed(2).replace(".", ",")}
      </Text>
    </View>
  );
}
