import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { groupByCategory } from "../../utils/categoryBreakdown";
import { formatCurrency } from "../../utils/currency";
import { Text, makeStyles, useTheme } from "../../theme";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category?: string;
  color?: string; // <-- Adicionado para ler a cor que vem do banco
  transferGroupId?: string | null;
}

interface GeneralBalanceCardProps {
  totalIncome: number;
  totalExpense: number;
  transactions: Transaction[];
}

// "Saldo Livre" não é uma categoria de transação — é o saldo restante
// depois das despesas, sempre na cor de receita.

type ViewMode = "expense" | "income";

export function GeneralBalanceCard({
  totalIncome,
  totalExpense,
  transactions,
}: GeneralBalanceCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [viewMode, setViewMode] = useState<ViewMode>("expense");

  const saldoLivre = Math.max(0, totalIncome - totalExpense);
  const comprometidoPercent =
    totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

  // Transferência entre contas não é receita nem despesa de verdade: fora da análise por categoria.
  const realTransactions = transactions.filter((t) => !t.transferGroupId);
  const expenseData = groupByCategory(
    realTransactions.filter((t) => t.type === "expense"),
    totalIncome,
    colors.textSecondary,
  );
  const incomeData = groupByCategory(
    realTransactions.filter((t) => t.type === "income"),
    totalIncome,
    colors.textSecondary,
  );

  const isExpenseView = viewMode === "expense";
  const categoryData = isExpenseView ? expenseData : incomeData;

  // Na visão de despesas, a rosca também tem a fatia de "Saldo Livre".
  // Na visão de receitas, as categorias já somam 100% da receita.
  const pieData = isExpenseView
    ? [
        { value: saldoLivre, color: colors.income },
        ...expenseData.map((item) => ({ value: item.amount, color: item.color })),
      ].filter((item) => item.value > 0)
    : incomeData
        .map((item) => ({ value: item.amount, color: item.color }))
        .filter((item) => item.value > 0);

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
          <Text style={styles.title}>
            {isExpenseView ? "ANÁLISE DE GASTOS" : "ANÁLISE DE RECEITAS"}
          </Text>
          <Text style={styles.subtitle}>
            {isExpenseView
              ? "Distribuição de despesas e saldo livre"
              : "Distribuição das receitas por categoria"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.comprometidoLabel}>COMPROMETIDO</Text>
          <Text style={styles.comprometidoValue}>
            {comprometidoPercent.toFixed(1)}%
          </Text>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, isExpenseView && styles.toggleButtonActive]}
          onPress={() => setViewMode("expense")}
        >
          <Text
            style={[
              styles.toggleButtonText,
              isExpenseView && styles.toggleButtonTextActive,
            ]}
          >
            Despesas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, !isExpenseView && styles.toggleButtonActive]}
          onPress={() => setViewMode("income")}
        >
          <Text
            style={[
              styles.toggleButtonText,
              !isExpenseView && styles.toggleButtonTextActive,
            ]}
          >
            Receitas
          </Text>
        </TouchableOpacity>
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
                stroke={colors.surfaceAlt}
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
            <Text style={styles.donutLabel}>
              {isExpenseView ? "SALDO LIVRE" : "TOTAL RECEITAS"}
            </Text>
            <Text
              style={[
                styles.donutValue,
                totalIncome === 0 && styles.donutValueEmpty,
              ]}
            >
              {totalIncome > 0
                ? `R$ ${((isExpenseView ? saldoLivre : totalIncome) / 1000).toFixed(1)}k`
                : "Sem dados"}
            </Text>
          </View>
        </View>

        {/* Legendas (Direita) */}
        <View style={styles.legendContainer}>
          {isExpenseView && (
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: colors.income }]}
              />
              <View>
                <Text style={[styles.legendName, { color: colors.income }]}>
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
          )}

          {categoryData.length === 0 ? (
            <Text style={styles.emptyText}>
              {isExpenseView
                ? "Nenhuma despesa neste período"
                : "Nenhuma receita neste período"}
            </Text>
          ) : (
            categoryData.slice(0, 3).map((item, index) => (
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
            ))
          )}
        </View>
      </View>

      {/* Barras de Progresso */}
      <View style={styles.barsContainer}>
        {isExpenseView && (
          <View style={styles.barBlock}>
            <View style={styles.barHeader}>
              <View style={styles.barTitleGroup}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.income },
                  ]}
                />
                <Text style={[styles.barTitle, { color: colors.income }]}>
                  SALDO LIVRE RESTANTE
                </Text>
              </View>
              <Text style={[styles.barAmount, { color: colors.income }]}>
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
                    backgroundColor: colors.income,
                    width: `${totalIncome > 0 ? (saldoLivre / totalIncome) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {categoryData.map((item, index) => (
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

const useStyles = makeStyles(({ colors }) => ({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  comprometidoLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "bold",
  },
  comprometidoValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
  },
  toggleButtonActive: {
    borderColor: colors.textPrimary,
  },
  toggleButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "bold",
  },
  toggleButtonTextActive: {
    color: colors.textPrimary,
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
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "bold",
  },
  donutValue: {
    color: colors.income,
    fontSize: 14,
    fontWeight: "bold",
  },
  donutValueEmpty: {
    color: colors.textSecondary,
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
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "bold",
    flex: 1,
  },
  legendPercentContainer: {
    alignItems: "flex-end",
  },
  legendPercent: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "bold",
  },
  legendDesc: {
    color: colors.textPlaceholder,
    fontSize: 9,
  },
  emptyText: {
    color: colors.textPlaceholder,
    fontSize: 11,
    fontStyle: "italic",
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
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "bold",
  },
  barAmount: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "bold",
  },
  barPercent: {
    color: colors.textPlaceholder,
    fontWeight: "normal",
  },
  barBackground: {
    width: "100%",
    height: 6,
    backgroundColor: colors.background,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
}));
