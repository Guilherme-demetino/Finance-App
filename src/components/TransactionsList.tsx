import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { styles } from "../app/../styles/dashboardStyles";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  icon: string;
}

interface TransactionsListProps {
  transactions: Transaction[];
}

export function TransactionsList({ transactions }: TransactionsListProps) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Transações Recentes</Text>
      <View style={styles.transactionsList}>
        {transactions.map((item) => (
          <View key={item.id} style={styles.transactionItem}>
            <View style={styles.transactionIcon}>
              <Ionicons name={item.icon as any} size={24} color="#FFFFFF" />
            </View>

            <View style={styles.transactionDetails}>
              <Text style={styles.transactionDescription}>
                {item.description}
              </Text>
              <Text style={styles.transactionDate}>{item.date}</Text>
            </View>

            <Text
              style={[
                styles.transactionAmount,
                { color: item.type === "income" ? "#10B981" : "#EF4444" },
              ]}
            >
              {item.type === "income" ? "+" : "-"} R${" "}
              {item.amount.toFixed(2).replace(".", ",")}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
