import { Ionicons } from "@expo/vector-icons";
import * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function DashboardScreen() {
  const [userName, setUserName] = useState("");

  // Estado para alternar o modo de visão do painel
  const [isPieView, setIsPieView] = useState(false);

  // Valores simulados para cálculo
  const totalIncome = 4500.0;
  const totalExpense = 189.9;
  const totalBalance = totalIncome - totalExpense;

  const totalMoney = totalIncome + totalExpense;
  const incomePercentage =
    totalMoney > 0 ? (totalIncome / totalMoney) * 100 : 50;
  const expensePercentage =
    totalMoney > 0 ? (totalExpense / totalMoney) * 100 : 50;

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const db = await SQLite.openDatabaseAsync("appfinanceiro.db");
        const user: any = await db.getFirstAsync(
          "SELECT name FROM users LIMIT 1",
        );
        if (user) {
          setUserName(user.name);
        }
      } catch (error) {
        console.log("Erro ao buscar usuário:", error);
      }
    };
    fetchUser();
  }, []);

  const mockTransactions = [
    {
      id: "1",
      description: "Mercado",
      amount: 150.0,
      type: "expense",
      date: "Hoje",
      icon: "cart-outline",
    },
    {
      id: "2",
      description: "Salário",
      amount: 4500.0,
      type: "income",
      date: "Ontem",
      icon: "cash-outline",
    },
    {
      id: "3",
      description: "Netflix",
      amount: 39.9,
      type: "expense",
      date: "14 Set",
      icon: "tv-outline",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá,</Text>
            <Text style={styles.userName}>{userName || "Usuário"}</Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <Ionicons name="person-circle-outline" size={40} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {/* Card de Saldo */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo Atual</Text>
          <Text style={styles.balanceAmount}>
            R$ {totalBalance.toFixed(2).replace(".", ",")}
          </Text>
        </View>

        {/* Resumo de Receitas e Despesas */}
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

        {/* PAINEL INTERATIVO */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Balanço Geral</Text>
              <Text style={styles.chartSubtitle}>
                Toque no ícone para alternar a visão
              </Text>
            </View>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setIsPieView(!isPieView)}
            >
              <Ionicons
                name={isPieView ? "bar-chart-outline" : "pie-chart"}
                size={22}
                color="#3B82F6"
              />
            </TouchableOpacity>
          </View>

          {isPieView ? (
            /* VISÃO EM GRÁFICO DE PIZZA / ROSCA */
            <View style={styles.pieContainer}>
              <View style={styles.donutOuterRing}>
                <View style={styles.donutInnerCircle}>
                  <Text style={styles.donutCenterText}>
                    {incomePercentage.toFixed(0)}%
                  </Text>
                  <Text style={styles.donutCenterSub}>Entradas</Text>
                </View>
              </View>

              <View style={styles.pieInfoSide}>
                <Text style={styles.pieInfoTitle}>Proporção de Fluxo</Text>
                <Text style={styles.pieInfoDesc}>
                  O gráfico demonstra o peso das saídas em relação às suas
                  entradas totais.
                </Text>
              </View>
            </View>
          ) : (
            /* VISÃO EM BARRA PROPORCIONAL CORRIGIDA */
            <View style={styles.progressBarWrapper}>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressIncome,
                    { width: `${incomePercentage}%` },
                  ]}
                />
                <View
                  style={[
                    styles.progressExpense,
                    { width: `${expensePercentage}%` },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Legendas Dinâmicas */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#10B981" }]}
              />
              <Text style={styles.legendText}>
                Entradas ({incomePercentage.toFixed(0)}%)
              </Text>
            </View>

            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#EF4444" }]}
              />
              <Text style={styles.legendText}>
                Saídas ({expensePercentage.toFixed(0)}%)
              </Text>
            </View>
          </View>
        </View>

        {/* Transações Recentes */}
        <Text style={styles.sectionTitle}>Transações Recentes</Text>
        <View style={styles.transactionsList}>
          {mockTransactions.map((item) => (
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
      </ScrollView>

      {/* Botão Flutuante (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => console.log("Ir para tela de adicionar")}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    marginTop: 20,
  },
  greeting: {
    fontSize: 16,
    color: "#A1A1AA",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  profileButton: {
    padding: 4,
  },
  balanceCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#333333",
  },
  balanceLabel: {
    fontSize: 16,
    color: "#A1A1AA",
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#333333",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#A1A1AA",
    marginLeft: 8,
  },
  summaryValueIncome: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#10B981",
  },
  summaryValueExpense: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#EF4444",
  },
  chartCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#333333",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  chartSubtitle: {
    fontSize: 12,
    color: "#A1A1AA",
    marginTop: 2,
  },
  toggleButton: {
    backgroundColor: "#2A2A2A",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#444444",
  },
  progressBarWrapper: {
    marginVertical: 10,
    marginBottom: 16,
  },
  progressBarContainer: {
    flexDirection: "row",
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: "#333333",
    width: "100%",
  },
  progressIncome: {
    height: "100%",
    backgroundColor: "#10B981",
  },
  progressExpense: {
    height: "100%",
    backgroundColor: "#EF4444",
  },
  pieContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
    marginBottom: 16,
  },
  donutOuterRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 10,
    borderColor: "#10B981",
    borderTopColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  donutInnerCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
  },
  donutCenterText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  donutCenterSub: {
    fontSize: 10,
    color: "#A1A1AA",
  },
  pieInfoSide: {
    flex: 1,
    marginLeft: 20,
  },
  pieInfoTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  pieInfoDesc: {
    fontSize: 12,
    color: "#A1A1AA",
    lineHeight: 16,
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
    paddingTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: "#A1A1AA",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  transactionsList: {
    gap: 12,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    padding: 16,
    borderRadius: 12,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#333333",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 14,
    color: "#A1A1AA",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    backgroundColor: "#3B82F6",
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
