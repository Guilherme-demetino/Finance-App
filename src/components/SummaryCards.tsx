import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { styles } from "../app/../styles/dashboardStyles";

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
          + R$ {totalIncome.toFixed(2).replace(".", ",")}
        </Text>
      </View>

      <View style={[styles.summaryCard, { marginLeft: 8 }]}>
        <View style={styles.summaryHeader}>
          <Ionicons name="arrow-down-circle" size={24} color="#EF4444" />
          <Text style={styles.summaryLabel}>Despesas</Text>
        </View>
        <Text style={styles.summaryValueExpense}>
          - R$ {totalExpense.toFixed(2).replace(".", ",")}
        </Text>
      </View>
    </View>
  );
}
