import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { styles } from "../app/../styles/dashboardStyles";
import { formatCurrency } from "../utils/currency";

interface SummaryCardsProps {
  totalIncome: number;
  totalExpense: number;
}

export function SummaryCards({ totalIncome, totalExpense }: SummaryCardsProps) {
  return (
    <View style={styles.summaryContainer}>
      <View style={[styles.summaryCard, { marginRight: 8 }]}>
        <View style={styles.summaryHeader}>
          <Ionicons name="arrow-up-circle" size={24} color="#10B981" />
          <Text style={styles.summaryLabel}>Receitas</Text>
        </View>
        <Text style={styles.summaryValueIncome}>
          {formatCurrency(totalIncome, { forceSign: "+" })}
        </Text>
      </View>

      <View style={[styles.summaryCard, { marginLeft: 8 }]}>
        <View style={styles.summaryHeader}>
          <Ionicons name="arrow-down-circle" size={24} color="#EF4444" />
          <Text style={styles.summaryLabel}>Despesas</Text>
        </View>
        <Text style={styles.summaryValueExpense}>
          {formatCurrency(totalExpense, { forceSign: "-" })}
        </Text>
      </View>
    </View>
  );
}
