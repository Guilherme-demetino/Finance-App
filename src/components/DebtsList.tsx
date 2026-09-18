import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/colors";
import type { DebtRow } from "../types";
import { styles } from "../styles/dashboardStyles";
import { formatCurrency as formatCurrencyDisplay } from "../utils/currency";
import { parseDateString } from "../utils/dates";
import { ConfirmModal } from "./ConfirmModal";

function isOverdue(dueDate: string, today: string): boolean {
  return parseDateString(dueDate).getTime() < parseDateString(today).getTime();
}

interface DebtsListProps {
  pendingDebts: DebtRow[];
  settledDebts: DebtRow[];
  totalToReceive: number;
  totalToPay: number;
  isLoading: boolean;
  onOpenAddDebt: () => void;
  onSettleDebt: (debt: DebtRow) => void;
  onDeleteDebt: (id: number) => void;
  today: string;
}

export function DebtsList({
  pendingDebts,
  settledDebts,
  totalToReceive,
  totalToPay,
  isLoading,
  onOpenAddDebt,
  onSettleDebt,
  onDeleteDebt,
  today,
}: DebtsListProps) {
  const [debtToDelete, setDebtToDelete] = useState<DebtRow | null>(null);

  return (
    <View>
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartTitle}>Dívidas e Empréstimos</Text>
            <Text style={styles.chartSubtitle}>
              Fora do seu saldo até serem quitadas
            </Text>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.textPrimary,
              borderRadius: 12,
              width: 40,
              height: 40,
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={onOpenAddDebt}
          >
            <Ionicons name="add" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: `${colors.income}1A`,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.income,
            }}
          >
            <Text style={{ color: colors.income, fontSize: 11, fontWeight: "bold" }}>
              A RECEBER
            </Text>
            <Text
              style={{
                color: colors.income,
                fontSize: 18,
                fontWeight: "bold",
                marginTop: 4,
              }}
            >
              {formatCurrencyDisplay(totalToReceive)}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: `${colors.expense}1A`,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.expense,
            }}
          >
            <Text style={{ color: colors.expense, fontSize: 11, fontWeight: "bold" }}>
              A PAGAR
            </Text>
            <Text
              style={{
                color: colors.expense,
                fontSize: 18,
                fontWeight: "bold",
                marginTop: 4,
              }}
            >
              {formatCurrencyDisplay(totalToPay)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "bold", marginBottom: 12 }}>
          Pendentes
        </Text>

        {isLoading ? null : pendingDebts.length === 0 ? (
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 13,
              textAlign: "center",
              paddingVertical: 12,
            }}
          >
            Nenhuma dívida ou empréstimo pendente.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {pendingDebts.map((debt) => {
              const isLent = debt.type === "lent";
              const color = isLent ? colors.income : colors.expense;
              return (
                <View
                  key={debt.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.surfaceAlt,
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: `${color}26`,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name={isLent ? "arrow-down-outline" : "arrow-up-outline"}
                        size={20}
                        color={color}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}
                        numberOfLines={1}
                      >
                        {debt.person}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        {debt.date}
                        {debt.description ? ` • ${debt.description}` : ""}
                      </Text>
                      {debt.due_date ? (
                        <Text
                          style={{
                            fontSize: 12,
                            marginTop: 2,
                            fontWeight: "600",
                            color: isOverdue(debt.due_date, today)
                              ? colors.expense
                              : colors.textSecondary,
                          }}
                        >
                          {isOverdue(debt.due_date, today)
                            ? `Venceu em ${debt.due_date}`
                            : `${isLent ? "Receber" : "Pagar"} até ${debt.due_date}`}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={{ color, fontSize: 15, fontWeight: "bold" }}>
                      {formatCurrencyDisplay(debt.amount)}
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "flex-end",
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setDebtToDelete(debt)}
                      style={{
                        backgroundColor: colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: colors.textPrimary,
                        borderRadius: 8,
                        width: 34,
                        height: 34,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.expense} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => onSettleDebt(debt)}
                      style={{
                        backgroundColor: `${colors.income}26`,
                        borderWidth: 1,
                        borderColor: colors.income,
                        borderRadius: 8,
                        paddingHorizontal: 14,
                        height: 34,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 6,
                      }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color={colors.income} />
                      <Text style={{ color: colors.income, fontSize: 13, fontWeight: "bold" }}>
                        Quitar
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {settledDebts.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "bold", marginBottom: 12 }}>
            Quitadas
          </Text>

          <View style={{ gap: 10 }}>
            {settledDebts.map((debt) => (
              <View
                key={debt.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.surfaceAlt,
                  borderRadius: 12,
                  padding: 14,
                  opacity: 0.6,
                }}
              >
                <Ionicons name="checkmark-circle" size={22} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}
                    numberOfLines={1}
                  >
                    {debt.person}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    Quitado em {debt.settled_date}
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: "bold" }}>
                  {formatCurrencyDisplay(debt.amount)}
                </Text>
                <TouchableOpacity
                  onPress={() => setDebtToDelete(debt)}
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.textPrimary,
                    borderRadius: 8,
                    width: 30,
                    height: 30,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="trash-outline" size={14} color={colors.expense} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      <ConfirmModal
        visible={!!debtToDelete}
        title="Excluir registro"
        message={
          debtToDelete
            ? `Excluir o registro de ${debtToDelete.person}? Essa ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        onCancel={() => setDebtToDelete(null)}
        onConfirm={() => {
          if (debtToDelete) onDeleteDebt(debtToDelete.id);
          setDebtToDelete(null);
        }}
      />
    </View>
  );
}
