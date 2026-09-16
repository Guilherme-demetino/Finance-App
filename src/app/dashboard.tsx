import { Ionicons } from "@expo/vector-icons";
import * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { styles } from "./styles/dashboardStyles";

export default function DashboardScreen() {
  const [userName, setUserName] = useState("Carregando...");
  const [isPieView, setIsPieView] = useState(false);

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
        const db = await SQLite.openDatabaseAsync("meufinanceiro.db");
        const result: any = await db.getAllAsync(
          "SELECT name FROM users LIMIT 1",
        );

        if (result && result.length > 0) {
          setUserName(result[0].name);
        } else {
          setUserName("Meu Finanças");
        }
      } catch (error) {
        console.log("Erro ao buscar usuário:", error);
        setUserName("Meu Finanças");
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
            <Text style={styles.userName}>{userName}</Text>
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

          {/* Gráfico de Pizza (Visão Circular) */}
          <View
            style={[
              styles.viewContainer,
              { display: isPieView ? "flex" : "none" },
            ]}
          >
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
          </View>

          {/* Gráfico de Barras Proporcionais (Visão de Barras) */}
          <View
            style={[
              styles.viewContainer,
              { display: !isPieView ? "flex" : "none" },
            ]}
          >
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
          </View>

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
