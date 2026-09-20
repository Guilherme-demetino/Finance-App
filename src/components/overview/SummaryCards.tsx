import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useDashboardStyles } from "../../styles/dashboardStyles";
import { formatCurrency } from "../../utils/currency";
import { Text, useTheme } from "../../theme";

interface SummaryCardsProps {
  totalIncome: number;
  totalExpense: number;
}

export function SummaryCards({ totalIncome, totalExpense }: SummaryCardsProps) {
  const { colors } = useTheme();
  const styles = useDashboardStyles();
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
