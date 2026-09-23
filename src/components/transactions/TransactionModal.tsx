import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "../../constants/categories";
import { DEFAULT_ACCOUNT_NAME } from "../../database/accounts";
import { useAccounts } from "../../hooks/useAccounts";
import { useCategoryOptions } from "../../hooks/useCategoryOptions";
import { useInlineEntityManager } from "../../hooks/useInlineEntityManager";
import { useReceiptScan } from "../../hooks/useReceiptScan";
import type { CategoryRow } from "../../types";
import { formatDateToString, parseDateString } from "../../utils/dates";
import { AccountModal } from "../forms/AccountModal";
import { CalendarPicker } from "../forms/CalendarPicker";
import { CategoryModal } from "../forms/CategoryModal";
import { ConfirmModal } from "../ConfirmModal";
import { InstallmentRecurrenceFields } from "./InstallmentRecurrenceFields";
import { Text, TextInput, modalCard, modalScrim, useTheme } from "../../theme";

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
  transactionAccount: string;
  setTransactionAccount: (account: string) => void;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  recurringMonths: number;
  setRecurringMonths: (value: number) => void;
  installmentCount: number;
  setInstallmentCount: (value: number) => void;
  isEditing: boolean;
  formatCurrency: (value: string) => string;
  onSave: () => void;
  /** Exclui uma categoria criada pelo usuário (as padrão não podem ser apagadas). */
  onDeleteCategory: (id: number) => Promise<void>;
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
  transactionAccount,
  setTransactionAccount,
  isRecurring,
  setIsRecurring,
  recurringMonths,
  setRecurringMonths,
  installmentCount,
  setInstallmentCount,
  isEditing,
  formatCurrency,
  onSave,
  onDeleteCategory,
}: TransactionModalProps) {
  const theme = useTheme();
  const { colors } = theme;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { options: accountOptions, remove: removeAccount, refresh: refreshAccounts } = useAccounts();
  const { categories: dbCategories, isLoading: isLoadingCategories, refresh: fetchCategories } =
    useCategoryOptions(visible);
  const { isScanning: isScanningReceipt, scanError, scanFromCamera: handleScanFromCamera, scanFromLibrary: handleScanFromLibrary } =
    useReceiptScan({
      setTransactionType,
      setTransactionTitle,
      setTransactionAmount,
      setTransactionDate,
      setTransactionCategory,
    });

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

  const defaultCategories =
    transactionType === "income"
      ? DEFAULT_INCOME_CATEGORIES
      : DEFAULT_EXPENSE_CATEGORIES;

  // Só as categorias criadas pelo usuário (fora da lista padrão) podem ser excluídas.
  const findDeletableCategory = (name: string) => {
    if (defaultCategories.includes(name)) return null;
    return (
      dbCategories.find(
        (c) =>
          String(c.name).trim() === name &&
          (String(c.type).trim().toLowerCase() === "income") ===
            (transactionType === "income"),
      ) ?? null
    );
  };

  const categoryManager = useInlineEntityManager<CategoryRow>({
    selectedValue: transactionCategory,
    setSelectedValue: setTransactionCategory,
    fallbackValue: defaultCategories[0],
    valueOf: (category) => String(category.name).trim(),
    remove: async (category) => {
      await onDeleteCategory(category.id);
      await fetchCategories();
    },
  });

  const accountManager = useInlineEntityManager<{ id: number; name: string }>({
    selectedValue: transactionAccount,
    setSelectedValue: setTransactionAccount,
    fallbackValue: DEFAULT_ACCOUNT_NAME,
    valueOf: (account) => account.name,
    remove: async (account) => {
      await removeAccount(account.id);
    },
  });

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
          backgroundColor: modalScrim(theme, 0.6),
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
              ...modalCard(theme),
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
                      ? `${colors.income}26`
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
                      ? `${colors.expense}26`
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

            {/* ESCANEAR RECIBO */}
            {!isEditing && (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={handleScanFromCamera}
                    disabled={isScanningReceipt}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      paddingVertical: 10,
                      opacity: isScanningReceipt ? 0.6 : 1,
                    }}
                    accessibilityRole="button"
                  >
                    <Ionicons name="camera-outline" size={16} color={colors.textPrimary} />
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>
                      Fotografar recibo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleScanFromLibrary}
                    disabled={isScanningReceipt}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      opacity: isScanningReceipt ? 0.6 : 1,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Escolher foto do recibo na galeria"
                  >
                    {isScanningReceipt ? (
                      <ActivityIndicator size="small" color={colors.textPrimary} />
                    ) : (
                      <Ionicons name="image-outline" size={16} color={colors.textPrimary} />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                  Lê o valor, a data e a loja do recibo e preenche os campos abaixo — sempre dá para conferir e editar
                  antes de salvar.
                </Text>
                {scanError && (
                  <Text style={{ color: colors.expense, fontSize: 12, marginTop: 6 }}>{scanError}</Text>
                )}
              </View>
            )}

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
                    onPress={categoryManager.openCreateModal}
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
                    const deletable = findDeletableCategory(catName);
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
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
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
                        {deletable && (
                          <TouchableOpacity
                            onPress={() => categoryManager.requestDelete(deletable)}
                            hitSlop={8}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={14}
                              color={colors.expense}
                            />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* LISTA DE CONTAS */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 10 }}>
                Conta
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={accountManager.openCreateModal}
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
                    <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 12 }}>
                      Nova
                    </Text>
                  </TouchableOpacity>

                  {accountOptions.map((option) => {
                    const isSelected = transactionAccount === option.name;
                    return (
                      <TouchableOpacity
                        key={option.name}
                        onPress={() => setTransactionAccount(option.name)}
                        style={{
                          backgroundColor: colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: option.color,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 8,
                          opacity: isSelected ? 1 : 0.5,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: option.color }} />
                        <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "bold" }}>
                          {option.name}
                        </Text>
                        {option.id !== null && (
                          <TouchableOpacity
                            onPress={() => accountManager.requestDelete({ id: option.id as number, name: option.name })}
                            hitSlop={8}
                          >
                            <Ionicons name="trash-outline" size={14} color={colors.expense} />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* RECORRÊNCIA / PARCELAMENTO */}
            {!isEditing && (
              <InstallmentRecurrenceFields
                isRecurring={isRecurring}
                setIsRecurring={setIsRecurring}
                recurringMonths={recurringMonths}
                setRecurringMonths={setRecurringMonths}
                installmentCount={installmentCount}
                setInstallmentCount={setInstallmentCount}
                numericAmount={numericAmount}
                hasValidAmount={hasValidAmount}
              />
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
        visible={categoryManager.isCreateModalVisible}
        onClose={categoryManager.closeCreateModal}
        transactionType={transactionType}
        onSave={(novaCategoria, tipoEscolhido) => {
          categoryManager.closeCreateModal();
          setTransactionType(tipoEscolhido);
          setTransactionCategory(String(novaCategoria).trim());
          fetchCategories();
        }}
      />

      <ConfirmModal
        visible={!!categoryManager.itemToDelete}
        title="Excluir categoria"
        message={
          categoryManager.itemToDelete
            ? `Excluir a categoria "${String(categoryManager.itemToDelete.name).trim()}"? As transações e metas já registradas com ela continuam existindo, só deixam de aparecer atreladas a essa categoria.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        onCancel={categoryManager.cancelDelete}
        onConfirm={categoryManager.confirmDelete}
      />

      {/* MODAL DE CRIAR CONTA */}
      <AccountModal
        visible={accountManager.isCreateModalVisible}
        onClose={accountManager.closeCreateModal}
        onSave={(novaConta) => {
          accountManager.closeCreateModal();
          setTransactionAccount(novaConta);
          refreshAccounts();
        }}
      />

      <ConfirmModal
        visible={!!accountManager.itemToDelete}
        title="Excluir conta"
        message={
          accountManager.itemToDelete
            ? `Excluir a conta "${accountManager.itemToDelete.name}"? As transações já registradas nela continuam existindo, só deixam de aparecer atreladas a essa conta.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        onCancel={accountManager.cancelDelete}
        onConfirm={accountManager.confirmDelete}
      />
    </>
  );
}
