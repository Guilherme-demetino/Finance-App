import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import { styles } from "../app/../styles/dashboardStyles";

interface GeneralBalanceCardProps {
  isPieView: boolean;
  setIsPieView: (val: boolean) => void;
  incomePercentage: number;
  expensePercentage: number;
}

export function GeneralBalanceCard({
  isPieView,
  setIsPieView,
  incomePercentage,
  expensePercentage,
}: GeneralBalanceCardProps) {
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>Balanço Geral</Text>
          <Text style={styles.chartSubtitle}>
            Toque no ícone para alternar a visão
          </Text>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: "#2A2A2A",
            borderWidth: 1,
            borderColor: "#FFFFFF",
            borderRadius: 12,
            width: 40,
            height: 40,
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={() => setIsPieView(!isPieView)}
        >
          <Ionicons
            name={isPieView ? "bar-chart-outline" : "pie-chart"}
            size={20}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      <View
        style={[styles.viewContainer, { display: isPieView ? "flex" : "none" }]}
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
              O gráfico demonstra o peso das saídas em relação às suas entradas
              totais.
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.viewContainer,
          { display: !isPieView ? "flex" : "none" },
        ]}
      >
        <View style={styles.progressBarWrapper}>
          <View style={styles.progressBarContainer}>
            <View
              style={[styles.progressIncome, { width: `${incomePercentage}%` }]}
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

      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
          <Text style={styles.legendText}>
            Entradas ({incomePercentage.toFixed(0)}%)
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
          <Text style={styles.legendText}>
            Saídas ({expensePercentage.toFixed(0)}%)
          </Text>
        </View>
      </View>
    </View>
  );
}
