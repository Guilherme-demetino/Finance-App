import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "../constants/categories";
import { colors } from "../constants/colors";
import { getAllCategories } from "../database/categories";
import type { CategoryRow } from "../types";
import { formatCurrency as formatCurrencyDisplay } from "../utils/currency";
import { formatDateToString, parseDateString } from "../utils/dates";
import { CalendarPicker } from "./CalendarPicker";
import { CategoryModal } from "./CategoryModal";

const INSTALLMENT_OPTIONS = [2, 3, 4, 6, 10, 12];
const RECURRING_MONTHS_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface TransactionModalProps {
  visible: boolean;
  onClose: () => void;
  transactionType: "income" | "expense";
  setTransactionType: (type: "income" | "expense") => void;
  transactionTitle: string;
  setTransactionTitle: (title: string) => void;
  transactionAmount: string;
  setTransactionAmount: (amount: string) => void;
  transactionDate: string;
  setTransactionDate: (date: string) => void;
  transactionCategory: string;
  setTransactionCategory: (category: string) => void;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  recurringMonths: number;
  setRecurringMonths: (value: number) => void;
  installmentCount: number;
  setInstallmentCount: (value: number) => void;
  isEditing: boolean;
  formatCurrency: (value: string) => string;
  onSave: () => void;
}

export function TransactionModal({
  visible,
  onClose,
  transactionType,
  setTransactionType,
  transactionTitle,
  setTransactionTitle,
  transactionAmount,
  setTransactionAmount,
  transactionDate,
  setTransactionDate,
  transactionCategory,
  setTransactionCategory,
  isRecurring,
  setIsRecurring,
  recurringMonths,
  setRecurringMonths,
  installmentCount,
  setInstallmentCount,
  isEditing,
  formatCurrency,
  onSave,
}: TransactionModalProps) {
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [dbCategories, setDbCategories] = useState<CategoryRow[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const result = await getAllCategories();
      setDbCategories(result);
    } catch (error) {
      console.log("Erro ao buscar categorias:", error);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchCategories();
    }
  }, [visible]);

  const customIncomeCategories = dbCategories
    .filter((c) => String(c.type).trim().toLowerCase() === "income")
    .map((c) => String(c.name).trim());

  const customExpenseCategories = dbCategories
    .filter((c) => String(c.type).trim().toLowerCase() !== "income")
    .map((c) => String(c.name).trim());

  let displayCategories =
    transactionType === "income"
      ? [...DEFAULT_INCOME_CATEGORIES, ...customIncomeCategories]
      : [...DEFAULT_EXPENSE_CATEGORIES, ...customExpenseCategories];

  displayCategories = Array.from(new Set(displayCategories));

  if (!visible) return null;

  const numericAmount = Number(
    String(transactionAmount).replace(/\./g, "").replace(",", "."),
  );
  const hasValidAmount = !isNaN(numericAmount) && numericAmount > 0;

  return (
    <>
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-start",
          paddingTop: 60,
          zIndex: 999,
          elevation: 999,
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ maxHeight: "85%" }}
        >
          <Animated.ScrollView
            entering={FadeInDown.duration(250).springify().damping(18)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              backgroundColor: colors.surface,
              borderRadius: 24,
              marginHorizontal: 16,
              padding: 24,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <Text
                style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "bold" }}
              >
                Nova Transação
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* ABAS RECEITA / DESPESA */}
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor:
                    transactionType === "income"
                      ? "rgba(16, 185, 129, 0.15)"
                      : colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor:
                    transactionType === "income" ? colors.income : colors.surfaceAlt,
                }}
                onPress={() => {
                  setTransactionType("income");
                  // Se a categoria atual não pertencer às receitas, força para "Salário" ou "Investimentos" com segurança
                  const validIncome = [
                    ...DEFAULT_INCOME_CATEGORIES,
                    ...customIncomeCategories,
                  ];
                  if (!validIncome.includes(transactionCategory)) {
                    setTransactionCategory("Salário");
                  }
                }}
              >
                <Text
                  style={{
                    color: transactionType === "income" ? colors.income : colors.textMuted,
                    fontWeight: "bold",
                  }}
                >
                  Receita
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor:
                    transactionType === "expense"
                      ? "rgba(239, 68, 68, 0.15)"
                      : colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor:
                    transactionType === "expense" ? colors.expense : colors.surfaceAlt,
                }}
                onPress={() => {
                  setTransactionType("expense");
                  if (
                    !DEFAULT_EXPENSE_CATEGORIES.includes(transactionCategory) &&
                    !customExpenseCategories.includes(transactionCategory)
                  ) {
                    setTransactionCategory("Alimentação");
                  }
                }}
              >
                <Text
                  style={{
                    color: transactionType === "expense" ? colors.expense : colors.textMuted,
                    fontWeight: "bold",
                  }}
                >
                  Despesa
                </Text>
              </TouchableOpacity>
            </View>

            {/* CAMPOS DE TEXTO */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
                Título
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.surfaceAlt,
                  color: colors.textPrimary,
                  padding: 16,
                  borderRadius: 12,
                }}
                value={transactionTitle}
                onChangeText={setTransactionTitle}
                placeholder="Ex: Supermercado"
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
                Valor (R$)
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.surfaceAlt,
                  color: colors.textPrimary,
                  padding: 16,
                  borderRadius: 12,
                  fontSize: 18,
                }}
                keyboardType="numeric"
                value={transactionAmount}
                onChangeText={(text) =>
                  setTransactionAmount(formatCurrency(text))
                }
                placeholder="0,00"
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
                Data
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={{
                  backgroundColor: colors.surfaceAlt,
                  padding: 16,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: colors.textPrimary }}>
                  {transactionDate || "DD/MM/AAAA"}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
              </TouchableOpacity>
              <CalendarPicker
                visible={showDatePicker}
                value={parseDateString(transactionDate)}
                accentColor={transactionType === "income" ? colors.income : colors.expense}
                onClose={() => setShowDatePicker(false)}
                onSelect={(selectedDate) => {
                  setShowDatePicker(false);
                  setTransactionDate(formatDateToString(selectedDate));
                }}
              />
            </View>

            {/* LISTA DE CATEGORIAS */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 10 }}>
                Categoria
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View
                  style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
                >
                  <TouchableOpacity
                    onPress={() => setIsCategoryModalVisible(true)}
                    style={{
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.textPrimary,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Ionicons name="add" size={14} color={colors.textPrimary} />
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontWeight: "bold",
                        fontSize: 12,
                      }}
                    >
                      Nova
                    </Text>
                  </TouchableOpacity>

                  {isLoadingCategories && (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  )}

                  {displayCategories.map((catName, index) => {
                    const isSelected = transactionCategory === catName;
                    return (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setTransactionCategory(catName)}
                        style={{
                          backgroundColor: colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: colors.textPrimary,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 8,
                          opacity: isSelected ? 1 : 0.5,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontSize: 12,
                            fontWeight: "bold",
                          }}
                        >
                          {catName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* RECORRÊNCIA / PARCELAMENTO */}
            {!isEditing && (
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 13,
                    marginBottom: 10,
                  }}
                >
                  Repetição
                </Text>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => {
                      const next = !isRecurring;
                      setIsRecurring(next);
                      if (next) setInstallmentCount(1);
                    }}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      backgroundColor: isRecurring
                        ? "rgba(16, 185, 129, 0.15)"
                        : colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: isRecurring
                        ? colors.income
                        : colors.surfaceAlt,
                      borderRadius: 12,
                      paddingVertical: 12,
                    }}
                  >
                    <Ionicons
                      name="repeat"
                      size={16}
                      color={isRecurring ? colors.income : colors.textMuted}
                    />
                    <Text
                      style={{
                        color: isRecurring ? colors.income : colors.textMuted,
                        fontWeight: "bold",
                        fontSize: 13,
                      }}
                    >
                      Recorrente
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      if (installmentCount > 1) {
                        setInstallmentCount(1);
                      } else {
                        setInstallmentCount(2);
                        setIsRecurring(false);
                      }
                    }}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      backgroundColor:
                        installmentCount > 1
                          ? "rgba(16, 185, 129, 0.15)"
                          : colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor:
                        installmentCount > 1
                          ? colors.income
                          : colors.surfaceAlt,
                      borderRadius: 12,
                      paddingVertical: 12,
                    }}
                  >
                    <Ionicons
                      name="card-outline"
                      size={16}
                      color={
                        installmentCount > 1 ? colors.income : colors.textMuted
                      }
                    />
                    <Text
                      style={{
                        color:
                          installmentCount > 1
                            ? colors.income
                            : colors.textMuted,
                        fontWeight: "bold",
                        fontSize: 13,
                      }}
                    >
                      Parcelar
                    </Text>
                  </TouchableOpacity>
                </View>

                {isRecurring && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 12 }}
                  >
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {RECURRING_MONTHS_OPTIONS.map((n) => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => setRecurringMonths(n)}
                          style={{
                            backgroundColor:
                              recurringMonths === n
                                ? colors.income
                                : colors.surfaceAlt,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 8,
                          }}
                        >
                          <Text
                            style={{
                              color:
                                recurringMonths === n
                                  ? colors.surface
                                  : colors.textPrimary,
                              fontWeight: "bold",
                              fontSize: 12,
                            }}
                          >
                            {n} meses
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}

                {installmentCount > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 12 }}
                  >
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {INSTALLMENT_OPTIONS.map((n) => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => setInstallmentCount(n)}
                          style={{
                            backgroundColor:
                              installmentCount === n
                                ? colors.income
                                : colors.surfaceAlt,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 8,
                          }}
                        >
                          <Text
                            style={{
                              color:
                                installmentCount === n
                                  ? colors.surface
                                  : colors.textPrimary,
                              fontWeight: "bold",
                              fontSize: 12,
                            }}
                          >
                            {n}x
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}

                {isRecurring && (
                  <Text
                    style={{ color: colors.textMuted, fontSize: 11, marginTop: 10 }}
                  >
                    Essa transação vai se repetir automaticamente todo mês,
                    pelos próximos {recurringMonths} meses.
                  </Text>
                )}

                {installmentCount > 1 && hasValidAmount && (
                  <Text
                    style={{ color: colors.textMuted, fontSize: 11, marginTop: 10 }}
                  >
                    {installmentCount}x de{" "}
                    {formatCurrencyDisplay(numericAmount / installmentCount)}{" "}
                    — valor total: {formatCurrencyDisplay(numericAmount)}
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity
              onPress={onSave}
              style={{
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.textPrimary,
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 16 }}
              >
                Salvar Transação
              </Text>
            </TouchableOpacity>
          </Animated.ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* MODAL DE CRIAR CATEGORIA */}
      <CategoryModal
        visible={isCategoryModalVisible}
        onClose={() => setIsCategoryModalVisible(false)}
        transactionType={transactionType}
        onSave={(novaCategoria, tipoEscolhido) => {
          setIsCategoryModalVisible(false);
          setTransactionType(tipoEscolhido);
          setTransactionCategory(String(novaCategoria).trim());
          fetchCategories();
        }}
      />
    </>
  );
}
