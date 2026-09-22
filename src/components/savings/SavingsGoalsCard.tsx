import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { useDashboardStyles } from "../../styles/dashboardStyles";
import type { SavingsGoalRow } from "../../types";
import { formatCurrency } from "../../utils/currency";
import {
  monthlyDepositNeeded,
  monthsUntilDeadline,
  savingsProgress,
} from "../../utils/savings";
import { describeOutlook, expectedSavingsPercent, savingsOutlook } from "../../utils/savingsOutlook";
import { ConfirmModal } from "../ConfirmModal";
import { GoalEditButton } from "../GoalEditButton";
import { Text, makeStyles, useTheme } from "../../theme";

interface SavingsGoalsCardProps {
  goals: SavingsGoalRow[];
  isLoading: boolean;
  onOpenCreate: () => void;
  onOpenDeposit: (goal: SavingsGoalRow) => void;
  onEdit: (goal: SavingsGoalRow) => void;
  onDelete: (id: number) => void;
  /** O dia de "hoje" para a projeção (nos testes é fixo). */
  today?: Date;
}

const useIconButtonStyles = makeStyles(({ colors }) => ({
  button: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 8,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
}));

export function SavingsGoalsCard({
  goals,
  isLoading,
  onOpenCreate,
  onOpenDeposit,
  onEdit,
  onDelete,
  today,
}: SavingsGoalsCardProps) {
  const { colors } = useTheme();
  const { button: iconButtonStyle } = useIconButtonStyles();
  const styles = useDashboardStyles();
  const [goalToDelete, setGoalToDelete] = useState<SavingsGoalRow | null>(null);

  // Resumo de todas as metas juntas (só faz sentido com mais de uma).
  const totalSaved = goals.reduce((sum, goal) => sum + Math.min(goal.saved_amount, goal.target_amount), 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target_amount, 0);
  const totalPercent = savingsProgress(totalSaved, totalTarget);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>Metas de Economia</Text>
          <Text style={styles.chartSubtitle}>
            Quanto você quer juntar — fora do seu saldo
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
          onPress={onOpenCreate}
        >
          <Ionicons name="add" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {!isLoading && goals.length > 1 ? (
        <View style={{ marginTop: 12 }} accessibilityLabel={`Todas as metas: ${Math.floor(totalPercent)}% guardado`}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
            Todas as metas: {formatCurrency(totalSaved)} de {formatCurrency(totalTarget)} ({Math.floor(totalPercent)}%)
          </Text>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: "hidden" }}>
            <View style={{ height: "100%", width: `${totalPercent}%`, backgroundColor: colors.accent, borderRadius: 3 }} />
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: 12, gap: 20 }}>
        {isLoading ? null : goals.length === 0 ? (
          <TouchableOpacity
            onPress={onOpenCreate}
            style={{
              alignItems: "center",
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: colors.surfaceAlt,
              borderStyle: "dashed",
              borderRadius: 12,
            }}
          >
            <Ionicons name="trophy-outline" size={24} color={colors.textMuted} />
            <Text
              style={{
                color: colors.textPrimary,
                fontWeight: "bold",
                fontSize: 14,
                marginTop: 8,
              }}
            >
              Nenhuma meta de economia
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
              Toque para criar, ex: juntar R$ 5.000 até dezembro
            </Text>
          </TouchableOpacity>
        ) : (
          goals.map((goal) => {
            const percent = savingsProgress(goal.saved_amount, goal.target_amount);
            const isDone = goal.saved_amount >= goal.target_amount;
            const remaining = Math.max(0, goal.target_amount - goal.saved_amount);
            const barColor = isDone ? colors.income : colors.accent;
            const monthly = monthlyDepositNeeded(
              goal.saved_amount,
              goal.target_amount,
              goal.deadline,
            );
            const isOverdue =
              !isDone && goal.deadline
                ? monthsUntilDeadline(goal.deadline).isOverdue
                : false;
            const outlook = describeOutlook(savingsOutlook(goal, today));
            const expected = isDone ? null : expectedSavingsPercent(goal, today);
            const toneColor =
              outlook?.tone === "good" ? colors.income : outlook?.tone === "bad" ? colors.expense : colors.textMuted;

            return (
              <View key={goal.id}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}
                      numberOfLines={1}
                    >
                      {goal.name}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      {formatCurrency(goal.saved_amount)} de{" "}
                      {formatCurrency(goal.target_amount)}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <GoalEditButton
                      label={`Editar meta ${goal.name}`}
                      onPress={() => onEdit(goal)}
                    />
                    <TouchableOpacity
                      onPress={() => setGoalToDelete(goal)}
                      style={iconButtonStyle}
                      accessibilityRole="button"
                      accessibilityLabel={`Excluir meta ${goal.name}`}
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.expense} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onOpenDeposit(goal)}
                      style={iconButtonStyle}
                      accessibilityRole="button"
                      accessibilityLabel={`Guardar ou retirar em ${goal.name}`}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ justifyContent: "center" }}>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.surfaceAlt,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${percent}%`,
                        backgroundColor: barColor,
                        borderRadius: 4,
                      }}
                    />
                  </View>
                  {expected !== null ? (
                    <View
                      accessibilityLabel={`Esperado até hoje para chegar no prazo: ${Math.round(expected)}%`}
                      style={{
                        position: "absolute",
                        left: `${expected}%`,
                        width: 2,
                        height: 14,
                        marginLeft: -1,
                        borderRadius: 1,
                        backgroundColor: colors.textPrimary,
                      }}
                    />
                  ) : null}
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 6,
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "bold",
                      color: isDone ? colors.income : colors.textMuted,
                    }}
                  >
                    {isDone
                      ? "Meta alcançada"
                      : `${Math.floor(percent)}% • faltam ${formatCurrency(remaining)}`}
                  </Text>

                  {goal.deadline && !isDone ? (
                    <Text
                      style={{
                        flex: 1,
                        textAlign: "right",
                        fontSize: 11,
                        color: isOverdue ? colors.expense : colors.textSecondary,
                      }}
                    >
                      {isOverdue
                        ? `Prazo venceu em ${goal.deadline}`
                        : monthly !== null
                          ? `Até ${goal.deadline} • guarde ${formatCurrency(monthly)}/mês`
                          : `Até ${goal.deadline}`}
                    </Text>
                  ) : null}
                </View>

                {expected !== null ? (
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                    A marca na barra é onde você deveria estar hoje para chegar no prazo ({Math.round(expected)}%).
                  </Text>
                ) : null}
                {outlook ? (
                  <Text style={{ color: toneColor, fontSize: 12, marginTop: 4, lineHeight: 17 }}>{outlook.text}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      <ConfirmModal
        visible={!!goalToDelete}
        title="Excluir meta"
        message={
          goalToDelete
            ? `Excluir a meta "${goalToDelete.name}"? O valor guardado nela deixa de ser acompanhado pelo app.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        onCancel={() => setGoalToDelete(null)}
        onConfirm={() => {
          if (goalToDelete) onDelete(goalToDelete.id);
          setGoalToDelete(null);
        }}
      />
    </View>
  );
}
