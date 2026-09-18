import { Text, View } from "react-native";
import { colors } from "../constants/colors";
import { styles } from "../styles/dashboardStyles";
import { formatCurrency } from "../utils/currency";
import type { MonthProjection } from "../utils/monthProjection";

interface MonthProjectionCardProps {
  projection: MonthProjection;
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ color, fontSize: 14, fontWeight: "bold" }}>{value}</Text>
    </View>
  );
}

export function MonthProjectionCard({ projection }: MonthProjectionCardProps) {
  const {
    currentBalance,
    upcomingIncome,
    upcomingExpense,
    upcomingCount,
    projectedBalance,
  } = projection;

  const projectedColor =
    projectedBalance >= 0 ? colors.income : colors.expense;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>Previsão do Mês</Text>
          <Text style={styles.chartSubtitle}>
            Saldo de hoje mais o que ainda vai cair até o fim do mês
          </Text>
        </View>
      </View>

      <View style={{ alignItems: "center", marginTop: 8, marginBottom: 20 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>
          Saldo previsto para o fim do mês
        </Text>
        <Text style={{ color: projectedColor, fontSize: 30, fontWeight: "bold" }}>
          {formatCurrency(projectedBalance)}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderTopColor: colors.surfaceAlt,
          paddingTop: 16,
        }}
      >
        <Stat
          label="Saldo hoje"
          value={formatCurrency(currentBalance)}
          color={currentBalance >= 0 ? colors.textPrimary : colors.expense}
        />
        <Stat
          label="A entrar"
          value={formatCurrency(upcomingIncome, { forceSign: "+" })}
          color={colors.income}
        />
        <Stat
          label="A sair"
          value={formatCurrency(upcomingExpense, { forceSign: "-" })}
          color={colors.expense}
        />
      </View>

      <Text
        style={{
          color: colors.textMuted,
          fontSize: 12,
          textAlign: "center",
          marginTop: 16,
        }}
      >
        {upcomingCount === 0
          ? "Nada mais previsto para o resto do mês."
          : `${upcomingCount} ${upcomingCount === 1 ? "lançamento" : "lançamentos"} ainda por vir (fixas, parcelas e datas futuras).`}
      </Text>
    </View>
  );
}
