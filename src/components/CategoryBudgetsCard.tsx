import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import type { CategoryBudgetItem } from "../hooks/useCategoryBudgets";
import { useDashboardStyles } from "../styles/dashboardStyles";
import { formatCurrency as formatCurrencyDisplay } from "../utils/currency";
import { CategoryModal } from "./forms/CategoryModal";
import { ConfirmModal } from "./ConfirmModal";
import { Text, TextInput, useTheme } from "../theme";

interface CategoryBudgetsCardProps {
  items: CategoryBudgetItem[];
  isLoading: boolean;
  onSaveGoal: (category: string, amount: number) => void;
  onCategoryCreated: () => Promise<void> | void;
  onDeleteCategory: (id: number) => void;
  formatCurrency: (val: string) => string;
}

export function CategoryBudgetsCard({
  items,
  isLoading,
  onSaveGoal,
  onCategoryCreated,
  onDeleteCategory,
  formatCurrency,
}: CategoryBudgetsCardProps) {
  const { colors } = useTheme();
  const styles = useDashboardStyles();
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [draftAmount, setDraftAmount] = useState("");
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] =
    useState<CategoryBudgetItem | null>(null);

  const startEditing = (item: CategoryBudgetItem) => {
    setEditingCategory(item.category);
    const cents = item.goal ? Math.round(item.goal * 100).toString() : "";
    setDraftAmount(cents ? formatCurrency(cents) : "");
  };

  const handleSave = (category: string) => {
    const numericValue = Number(
      draftAmount.replace(/\./g, "").replace(",", "."),
    );
    if (!isNaN(numericValue) && numericValue > 0) {
      onSaveGoal(category, numericValue);
    }
    setEditingCategory(null);
    setDraftAmount("");
  };

  const handleCategoryCreated = async (categoryName: string) => {
    setIsAddCategoryOpen(false);
    await onCategoryCreated();
    setEditingCategory(categoryName);
    setDraftAmount("");
  };

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>Metas por Categoria</Text>
          <Text style={styles.chartSubtitle}>
            Defina quanto pretende gastar em cada categoria
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
          onPress={() => setIsAddCategoryOpen(true)}
        >
          <Ionicons name="add" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 12, gap: 18 }}>
        {isLoading ? null : items.length === 0 ? (
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 13,
              textAlign: "center",
              paddingVertical: 12,
            }}
          >
            Crie categorias de despesa para poder definir metas.
          </Text>
        ) : (
          items.map((item) => {
            const isEditing = editingCategory === item.category;
            const hasGoal = item.goal !== null && item.goal > 0;
            const percent = hasGoal ? item.spent / (item.goal as number) : 0;
            const remaining = hasGoal
              ? (item.goal as number) - item.spent
              : 0;
            const isOverBudget = remaining < 0;
            const barColor =
              percent < 0.8
                ? colors.income
                : percent < 1
                  ? colors.categoryAmber
                  : colors.expense;

            return (
              <View key={item.category}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
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
                      style={{
                        color: colors.textPrimary,
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                      numberOfLines={1}
                    >
                      {item.category}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {item.id !== null && (
                      <TouchableOpacity
                        onPress={() => setCategoryToDelete(item)}
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
                        <Ionicons
                          name="trash-outline"
                          size={15}
                          color={colors.expense}
                        />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() =>
                        isEditing ? setEditingCategory(null) : startEditing(item)
                      }
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
                      <Ionicons
                        name={isEditing ? "close-outline" : "create-outline"}
                        size={15}
                        color={colors.textPrimary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {isEditing ? (
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <TextInput
                      style={{
                        flex: 1,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.textPrimary,
                        borderRadius: 10,
                        padding: 10,
                        color: colors.textPrimary,
                        fontSize: 14,
                      }}
                      keyboardType="numeric"
                      value={draftAmount}
                      onChangeText={(text) => setDraftAmount(formatCurrency(text))}
                      placeholder="R$ 0,00"
                      placeholderTextColor={colors.textPlaceholder}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={{
                        backgroundColor: colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: colors.textPrimary,
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 10,
                      }}
                      onPress={() => handleSave(item.category)}
                    >
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontWeight: "bold",
                          fontSize: 13,
                        }}
                      >
                        Salvar
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : hasGoal ? (
                  <View>
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
                          width: `${Math.min(percent * 100, 100)}%`,
                          backgroundColor: barColor,
                          borderRadius: 4,
                        }}
                      />
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: 6,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        {formatCurrencyDisplay(item.spent)} de{" "}
                        {formatCurrencyDisplay(item.goal as number)}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "bold",
                          color: isOverBudget ? colors.expense : colors.income,
                        }}
                      >
                        {isOverBudget
                          ? `${formatCurrencyDisplay(Math.abs(remaining))} acima`
                          : `${formatCurrencyDisplay(remaining)} restantes`}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => startEditing(item)}
                    style={{
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: colors.surfaceAlt,
                      borderStyle: "dashed",
                      borderRadius: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {item.spent > 0
                        ? `${formatCurrencyDisplay(item.spent)} gastos • toque para definir uma meta`
                        : "Toque para definir uma meta"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </View>

      <CategoryModal
        visible={isAddCategoryOpen}
        onClose={() => setIsAddCategoryOpen(false)}
        transactionType="expense"
        lockType
        onSave={(categoryName) => {
          handleCategoryCreated(categoryName);
        }}
      />

      <ConfirmModal
        visible={!!categoryToDelete}
        title="Excluir categoria"
        message={
          categoryToDelete
            ? `Excluir a categoria "${categoryToDelete.category}"? As transações e metas já registradas com ela continuam existindo, só deixam de aparecer atreladas a essa categoria.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        onCancel={() => setCategoryToDelete(null)}
        onConfirm={() => {
          if (categoryToDelete?.id !== null && categoryToDelete?.id !== undefined) {
            onDeleteCategory(categoryToDelete.id);
          }
          setCategoryToDelete(null);
        }}
      />
    </View>
  );
}
