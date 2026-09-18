import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { colors } from "../constants/colors";
import type { MonthComparisonResult } from "../hooks/useMonthComparison";
import { styles } from "../styles/dashboardStyles";
import { formatCurrency } from "../utils/currency";

interface MonthComparisonCardProps {
  comparison: MonthComparisonResult | null;
  isLoading: boolean;
  selectedMonth: string;
}

const MAX_CATEGORIES_SHOWN = 5;

export function MonthComparisonCard({
  comparison,
  isLoading,
  selectedMonth,
}: MonthComparisonCardProps) {
  if (isLoading || !comparison) return null;

  const { currentTotal, previousTotal, changePercent, previousMonthLabel, categories, hasPreviousData } =
    comparison;

  if (!hasPreviousData) {
    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Comparativo Mensal</Text>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 13,
            textAlign: "center",
            paddingVertical: 20,
          }}
        >
          Sem gastos registrados em {previousMonthLabel} para comparar com{" "}
          {selectedMonth}.
        </Text>
      </View>
    );
  }

  const isIncrease = changePercent !== null && changePercent > 0;
  const isDecrease = changePercent !== null && changePercent < 0;
  const highlightColor = isIncrease
    ? colors.expense
    : isDecrease
      ? colors.income
      : colors.textSecondary;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>Comparativo Mensal</Text>
          <Text style={styles.chartSubtitle}>
            {selectedMonth} vs {previousMonthLabel}
          </Text>
        </View>
      </View>

      <View style={{ alignItems: "center", marginTop: 12, marginBottom: 20 }}>
        {changePercent !== null ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons
                name={isIncrease ? "trending-up" : isDecrease ? "trending-down" : "remove"}
                size={20}
                color={highlightColor}
              />
              <Text style={{ color: highlightColor, fontSize: 20, fontWeight: "bold" }}>
                {Math.abs(changePercent).toFixed(0)}%{" "}
                {isIncrease ? "a mais" : isDecrease ? "a menos" : ""}
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
              que em {previousMonthLabel}
            </Text>
          </>
        ) : (
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
            Você teve gastos novos este mês
          </Text>
        )}

        <View
          style={{
            flexDirection: "row",
            gap: 24,
            marginTop: 16,
          }}
        >
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
              {selectedMonth}
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "bold" }}>
              {formatCurrency(currentTotal)}
            </Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
              {previousMonthLabel}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: "bold" }}>
              {formatCurrency(previousTotal)}
            </Text>
          </View>
        </View>
      </View>

      {categories.length > 0 && (
        <View style={{ gap: 12 }}>
          {categories.slice(0, MAX_CATEGORIES_SHOWN).map((item) => {
            const isNew = item.previous === 0 && item.current > 0;
            const isZeroed = item.current === 0 && item.previous > 0;
            const rowIsIncrease = item.changePercent !== null && item.changePercent > 0;
            const rowIsDecrease = item.changePercent !== null && item.changePercent < 0;
            const rowColor =
              isNew || rowIsIncrease
                ? colors.expense
                : isZeroed || rowIsDecrease
                  ? colors.income
                  : colors.textSecondary;

            return (
              <View
                key={item.category}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    flex: 1,
                  }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: item.color,
                    }}
                  />
                  <Text
                    style={{ color: colors.textPrimary, fontSize: 13, flex: 1 }}
                    numberOfLines={1}
                  >
                    {item.category}
                  </Text>
                </View>

                <Text style={{ color: rowColor, fontSize: 12, fontWeight: "bold" }}>
                  {isNew
                    ? "Novo gasto"
                    : isZeroed
                      ? "Zerou"
                      : item.changePercent !== null
                        ? `${item.changePercent > 0 ? "▲" : "▼"} ${Math.abs(item.changePercent).toFixed(0)}%`
                        : "—"}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
