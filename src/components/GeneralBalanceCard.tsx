import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { formatCurrency } from "../utils/currency";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category?: string;
  color?: string; // <-- Adicionado para ler a cor que vem do banco
}

interface GeneralBalanceCardProps {
  totalIncome: number;
  totalExpense: number;
  transactions: Transaction[];
}

const categoryColors: Record<string, string> = {
  "Saldo Livre": "#10B981",
  Moradia: "#3B82F6",
  Alimentação: "#F59E0B",
  Transporte: "#8B5CF6",
  Lazer: "#EC4899",
  Outros: "#A1A1AA",
};

export function GeneralBalanceCard({
  totalIncome,
  totalExpense,
  transactions,
}: GeneralBalanceCardProps) {
  const saldoLivre = Math.max(0, totalIncome - totalExpense);
  const comprometidoPercent =
    totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

  // Agrupar despesas por categoria somando valores e guardando a cor
  const expensesByCategory = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc: Record<string, { amount: number; color: string }>, t) => {
      const cat = t.category || "Outros";
      if (!acc[cat]) {
        acc[cat] = {
          amount: 0,
          // Pega a cor do banco (t.color), ou do dicionário fixo, ou uma cor padrão
          color: t.color || categoryColors[cat] || "#A1A1AA",
        };
      }
      acc[cat].amount += t.amount;
      return acc;
    }, {});

  // Criar array ordenado para legendas e barras
  const expenseData = Object.keys(expensesByCategory)
    .map((key) => ({
      name: key.toUpperCase(),
      originalName: key,
      amount: expensesByCategory[key].amount,
      color: expensesByCategory[key].color,
      percent:
        totalIncome > 0
          ? (expensesByCategory[key].amount / totalIncome) * 100
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Dados para o Gráfico de Rosca (Donut Chart)
  const pieData = [
    { value: saldoLivre, color: categoryColors["Saldo Livre"] },
    ...expenseData.map((item) => ({ value: item.amount, color: item.color })),
  ].filter((item) => item.value > 0);

  // Configurações do SVG
  const size = 120;
  const strokeWidth = 14;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>ANÁLISE DE GASTOS</Text>
          <Text style={styles.subtitle}>
            Distribuição de despesas e saldo livre
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.comprometidoLabel}>COMPROMETIDO</Text>
          <Text style={styles.comprometidoValue}>
            {comprometidoPercent.toFixed(1)}%
          </Text>
        </View>
      </View>

      <View style={styles.chartContainer}>
        {/* Gráfico de Rosca (SVG) */}
        <View style={styles.donutWrapper}>
          <Svg width={size} height={size}>
            <G rotation="-90" origin={`${center}, ${center}`}>
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke="#2A2A2A"
                strokeWidth={strokeWidth}
                fill="none"
              />
              {totalIncome > 0 &&
                pieData.map((slice, index) => {
                  const slicePercent = slice.value / totalIncome;
                  const strokeDasharray = `${circumference * slicePercent} ${circumference}`;
                  const strokeDashoffset = -currentOffset;
                  currentOffset += circumference * slicePercent;

                  return (
                    <Circle
                      key={index}
                      cx={center}
                      cy={center}
                      r={radius}
                      stroke={slice.color}
                      strokeWidth={strokeWidth}
                      fill="none"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="butt"
                    />
                  );
                })}
            </G>
          </Svg>

          <View style={styles.donutCenterText}>
            <Text style={styles.donutLabel}>SALDO LIVRE</Text>
            <Text
              style={[
                styles.donutValue,
                totalIncome === 0 && styles.donutValueEmpty,
              ]}
            >
              {totalIncome > 0
                ? `R$ ${(saldoLivre / 1000).toFixed(1)}k`
                : "Sem dados"}
            </Text>
          </View>
        </View>

        {/* Legendas (Direita) */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: categoryColors["Saldo Livre"] },
              ]}
            />
            <View>
              <Text
                style={[
                  styles.legendName,
                  { color: categoryColors["Saldo Livre"] },
                ]}
              >
                SALDO LIVRE
              </Text>
            </View>
            <View style={styles.legendPercentContainer}>
              <Text style={styles.legendPercent}>
                {(totalIncome > 0
                  ? (saldoLivre / totalIncome) * 100
                  : 0
                ).toFixed(1)}
                %
              </Text>
              <Text style={styles.legendDesc}>da receita</Text>
            </View>
          </View>

          {expenseData.slice(0, 3).map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: item.color }]}
              />
              <Text style={styles.legendName}>{item.originalName}</Text>
              <View style={styles.legendPercentContainer}>
                <Text style={styles.legendPercent}>
                  {item.percent.toFixed(1)}%
                </Text>
                <Text style={styles.legendDesc}>da receita</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Barras de Progresso */}
      <View style={styles.barsContainer}>
        <View style={styles.barBlock}>
          <View style={styles.barHeader}>
            <View style={styles.barTitleGroup}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: categoryColors["Saldo Livre"] },
                ]}
              />
              <Text
                style={[
                  styles.barTitle,
                  { color: categoryColors["Saldo Livre"] },
                ]}
              >
                SALDO LIVRE RESTANTE
              </Text>
            </View>
            <Text
              style={[
                styles.barAmount,
                { color: categoryColors["Saldo Livre"] },
              ]}
            >
              {formatCurrency(saldoLivre)}{" "}
              <Text style={styles.barPercent}>
                (
                {(totalIncome > 0
                  ? (saldoLivre / totalIncome) * 100
                  : 0
                ).toFixed(1)}
                % DA RECEITA)
              </Text>
            </Text>
          </View>
          <View style={styles.barBackground}>
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: categoryColors["Saldo Livre"],
                  width: `${totalIncome > 0 ? (saldoLivre / totalIncome) * 100 : 0}%`,
                },
              ]}
            />
          </View>
        </View>

        {expenseData.map((item, index) => (
          <View key={index} style={styles.barBlock}>
            <View style={styles.barHeader}>
              <View style={styles.barTitleGroup}>
                <View
                  style={[styles.legendDot, { backgroundColor: item.color }]}
                />
                <Text style={styles.barTitle}>{item.name}</Text>
              </View>
              <Text style={styles.barAmount}>
                {formatCurrency(item.amount)}{" "}
                <Text style={styles.barPercent}>
                  ({item.percent.toFixed(1)}% DA RECEITA)
                </Text>
              </Text>
            </View>
            <View style={styles.barBackground}>
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: item.color,
                    width: `${Math.min(item.percent, 100)}%`,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 11,
    marginTop: 4,
  },
  comprometidoLabel: {
    color: "#A1A1AA",
    fontSize: 10,
    fontWeight: "bold",
  },
  comprometidoValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 2,
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  donutWrapper: {
    width: 120,
    height: 120,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  donutCenterText: {
    position: "absolute",
    alignItems: "center",
  },
  donutLabel: {
    color: "#A1A1AA",
    fontSize: 9,
    fontWeight: "bold",
  },
  donutValue: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "bold",
  },
  donutValueEmpty: {
    color: "#A1A1AA",
    fontSize: 11,
  },
  legendContainer: {
    flex: 1,
    marginLeft: 20,
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
    flex: 1,
  },
  legendPercentContainer: {
    alignItems: "flex-end",
  },
  legendPercent: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  legendDesc: {
    color: "#666666",
    fontSize: 9,
  },
  barsContainer: {
    gap: 20,
  },
  barBlock: {},
  barHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  barTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  barTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  barAmount: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  barPercent: {
    color: "#666666",
    fontWeight: "normal",
  },
  barBackground: {
    width: "100%",
    height: 6,
    backgroundColor: "#121212",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
});
