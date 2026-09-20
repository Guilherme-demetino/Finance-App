import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, ScrollView, TouchableOpacity, View } from "react-native";
import { formatCurrency } from "../../utils/currency";
import { Text, makeStyles, useTheme } from "../../theme";

interface MonthData {
  label: string;
  income: number;
  expense: number;
}

interface LandscapePanoramaModalProps {
  visible: boolean;
  selectedYear: string;
  monthsData: MonthData[];
  onClose: () => void;
}

export function LandscapePanoramaModal({
  visible,
  selectedYear,
  monthsData,
  onClose,
}: LandscapePanoramaModalProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  // Estado para armazenar qual valor e tipo (receita ou despesa) foi tocado no momento
  const [selectedTooltip, setSelectedTooltip] = useState<{
    month: string;
    type: "Receita" | "Despesa";
    amount: number;
  } | null>(null);

  // Encontra o maior valor entre todas as receitas e despesas do ano para dimensionar proporcionalmente as barras
  const maxAmount = Math.max(
    ...monthsData.map((m) => Math.max(m.income, m.expense)),
    100, // Valor mínimo para evitar divisão por zero
  );

  const chartHeight = 140; // Altura máxima útil em pixels para as barras

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={styles.container}>
        {/* Cabeçalho do Panorama */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>PANORAMA ANUAL — {selectedYear}</Text>
            <Text style={styles.subtitle}>
              Toque em qualquer barra para ver o valor exato
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Tooltip flutuante de Valor Selecionado */}
        <View style={styles.tooltipContainer}>
          {selectedTooltip ? (
            <View style={styles.tooltipBox}>
              <Text style={styles.tooltipTitle}>
                {selectedTooltip.month} ({selectedTooltip.type})
              </Text>
              <Text
                style={[
                  styles.tooltipAmount,
                  {
                    color:
                      selectedTooltip.type === "Receita"
                        ? colors.income
                        : colors.expense,
                  },
                ]}
              >
                {formatCurrency(selectedTooltip.amount)}
              </Text>
            </View>
          ) : (
            <Text style={styles.tooltipPlaceholder}>
              Toque em uma barra do gráfico abaixo
            </Text>
          )}
        </View>

        {/* Gráfico de Barras dos 12 Meses */}
        <ScrollView
          horizontal
          contentContainerStyle={styles.chartScrollContent}
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles.chartArea}>
            {monthsData.map((item, index) => {
              // Calcula a altura proporcional da barra (limitada à altura máxima)
              const incomeHeight = (item.income / maxAmount) * chartHeight;
              const expenseHeight = (item.expense / maxAmount) * chartHeight;

              return (
                <View key={index} style={styles.monthColumn}>
                  {/* Container das Barras */}
                  <View style={styles.barsWrapper}>
                    {/* Barra de Receita */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.bar,
                        {
                          height: Math.max(incomeHeight, 4), // Mínimo de 4px para aparecer mesmo se for 0
                          backgroundColor: colors.income,
                        },
                      ]}
                      onPress={() =>
                        setSelectedTooltip({
                          month: item.label,
                          type: "Receita",
                          amount: item.income,
                        })
                      }
                    />

                    {/* Barra de Despesa */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.bar,
                        {
                          height: Math.max(expenseHeight, 4),
                          backgroundColor: colors.expense,
                        },
                      ]}
                      onPress={() =>
                        setSelectedTooltip({
                          month: item.label,
                          type: "Despesa",
                          amount: item.expense,
                        })
                      }
                    />
                  </View>

                  {/* Rótulo do Mês */}
                  <Text style={styles.monthLabel}>{item.label}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Legenda Explicativa */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
            <Text style={styles.legendText}>Receitas</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
            <Text style={styles.legendText}>Despesas</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  closeButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 6,
  },
  tooltipContainer: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
  },
  tooltipBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tooltipTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "bold",
  },
  tooltipAmount: {
    fontSize: 13,
    fontWeight: "bold",
  },
  tooltipPlaceholder: {
    color: colors.textPlaceholder,
    fontSize: 11,
    fontStyle: "italic",
  },
  chartScrollContent: {
    paddingHorizontal: 10,
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 180,
    gap: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthColumn: {
    alignItems: "center",
    width: 45,
    justifyContent: "flex-end",
    height: "100%",
  },
  barsWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 140,
    justifyContent: "center",
  },
  bar: {
    width: 14,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  monthLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 8,
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
}));
