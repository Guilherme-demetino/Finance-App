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
import { colors } from "../constants/colors";
import { getAllCategories } from "../database/categories";
import type { CategoryRow } from "../types";
import { CalendarPicker } from "./CalendarPicker";
import { CategoryModal } from "./CategoryModal";

const parseDateString = (value: string): Date => {
  const [day, month, year] = String(value).split("/").map(Number);
  if (day && month && year) {
    return new Date(year, month - 1, day);
  }
  return new Date();
};

const formatDateToString = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

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

  const defaultIncomeCategories = ["Salário", "Investimentos"];
  const defaultExpenseCategories = [
    "Alimentação",
    "Transporte",
    "Lazer",
    "Moradia",
    "Saúde",
  ];

  const customIncomeCategories = dbCategories
    .filter((c) => String(c.type).trim().toLowerCase() === "income")
    .map((c) => String(c.name).trim());

  const customExpenseCategories = dbCategories
    .filter((c) => String(c.type).trim().toLowerCase() !== "income")
    .map((c) => String(c.name).trim());

  let displayCategories =
    transactionType === "income"
      ? [...defaultIncomeCategories, ...customIncomeCategories]
      : [...defaultExpenseCategories, ...customExpenseCategories];

  displayCategories = Array.from(new Set(displayCategories));

  if (!visible) return null;

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
                    ...defaultIncomeCategories,
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
                    !defaultExpenseCategories.includes(transactionCategory) &&
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
                Descrição
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
