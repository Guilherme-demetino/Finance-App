import { View } from "react-native";
import { CATEGORY_COLORS } from "../../constants/colors";
import { useAccounts } from "../../hooks/useAccounts";
import { Text, makeStyles, useTheme } from "../../theme";
import type { EnrichedTransaction } from "../../types";
import { groupBalancesByAccount } from "../../utils/accountBalances";
import { formatCurrency } from "../../utils/currency";

interface AccountBalancesCardProps {
  transactions: EnrichedTransaction[];
}

/** Saldo do mês por conta — só aparece quando há mais de uma conta em uso (com uma só, o "Saldo Atual" já basta). */
export function AccountBalancesCard({ transactions }: AccountBalancesCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { options } = useAccounts();
  const balances = groupBalancesByAccount(transactions);

  if (balances.length < 2) return null;

  const colorFor = (name: string) => options.find((option) => option.name === name)?.color ?? CATEGORY_COLORS.categoryNeutral;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Saldo por conta</Text>
      {balances.map((item) => (
        <View key={item.account} style={styles.row}>
          <View style={styles.nameGroup}>
            <View style={[styles.dot, { backgroundColor: colorFor(item.account) }]} />
            <Text style={styles.name} numberOfLines={1}>
              {item.account}
            </Text>
          </View>
          <Text style={[styles.amount, { color: item.balance >= 0 ? colors.income : colors.expense }]}>
            {formatCurrency(item.balance)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: "100%",
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
  },
  title: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  nameGroup: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, marginRight: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { color: colors.textPrimary, fontSize: 14, fontWeight: "600", flexShrink: 1 },
  amount: { fontSize: 14, fontWeight: "bold" },
}));
