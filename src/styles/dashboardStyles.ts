import { StyleSheet } from "react-native";
import { colors } from "../constants/colors";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.textSecondary,
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  profileButton: {
    padding: 4,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  summaryValueIncome: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.income,
  },
  summaryValueExpense: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.expense,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
  },
  chartSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  toggleButton: {
    backgroundColor: colors.surfaceAlt, // Fundo escuro igual aos botões de login/PIN
    borderWidth: 1,
    borderColor: colors.textPrimary, // Borda branca
    borderRadius: 12, // Cantos arredondados padronizados
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  viewContainer: {
    width: "100%",
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
    backgroundColor: colors.border,
    width: "100%",
  },
  progressIncome: {
    height: "100%",
    backgroundColor: colors.income,
  },
  progressExpense: {
    height: "100%",
    backgroundColor: colors.expense,
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
    borderColor: colors.income,
    borderTopColor: colors.expense,
    justifyContent: "center",
    alignItems: "center",
  },
  donutInnerCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  donutCenterText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  donutCenterSub: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  pieInfoSide: {
    flex: 1,
    marginLeft: 20,
  },
  pieInfoTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  pieInfoDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
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
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 16,
  },
  transactionsList: {
    gap: 12,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
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
    color: colors.textPrimary,
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 24,
    backgroundColor: colors.surfaceAlt, // Fundo escuro igual aos outros botões
    borderWidth: 1,
    borderColor: colors.textPrimary, // Borda branca
    width: 56,
    height: 56,
    borderRadius: 16, // Cantos arredondados padronizados
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
