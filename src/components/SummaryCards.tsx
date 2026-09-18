import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { styles } from "../styles/dashboardStyles";
import { formatCurrency } from "../utils/currency";
import { colors } from "../constants/colors";

interface SummaryCardsProps {
  totalIncome: number;
  totalExpense: number;
}

export function SummaryCards({ totalIncome, totalExpense }: SummaryCardsProps) {
  return (
    <View style={styles.summaryContainer}>
      <View style={[styles.summaryCard, { marginRight: 8 }]}>
        <View style={styles.summaryHeader}>
          <Ionicons name="arrow-up-circle" size={24} color={colors.income} />
          <Text style={styles.summaryLabel}>Receitas</Text>
        </View>
        <Text style={styles.summaryValueIncome}>
          {formatCurrency(totalIncome, { forceSign: "+" })}
        </Text>
      </View>

      <View style={[styles.summaryCard, { marginLeft: 8 }]}>
        <View style={styles.summaryHeader}>
          <Ionicons name="arrow-down-circle" size={24} color={colors.expense} />
          <Text style={styles.summaryLabel}>Despesas</Text>
        </View>
        <Text style={styles.summaryValueExpense}>
          {formatCurrency(totalExpense, { forceSign: "-" })}
        </Text>
      </View>
    </View>
  );
}
