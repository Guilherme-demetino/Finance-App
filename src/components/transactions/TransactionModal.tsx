import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "../../constants/categories";
import { getAllCategories } from "../../database/categories";
import { DEFAULT_ACCOUNT_NAME } from "../../database/accounts";
import { useAccounts } from "../../hooks/useAccounts";
import { scanReceiptFromCamera, scanReceiptFromLibrary, type ReceiptScanResult } from "../../services/receiptScan";
import type { CategoryRow } from "../../types";
import { formatCurrency as formatCurrencyDisplay, formatCurrencyInput } from "../../utils/currency";
import { formatDateToString, parseDateString } from "../../utils/dates";
import { parseReceiptText } from "../../utils/statements/receiptOcr";
import { AccountModal } from "../forms/AccountModal";
import { CalendarPicker } from "../forms/CalendarPicker";
import { CategoryModal } from "../forms/CategoryModal";
import { ConfirmModal } from "../ConfirmModal";
import { logError } from "../../utils/logger";
import { Text, TextInput, modalCard, modalScrim, useTheme } from "../../theme";

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
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryRow | null>(
    null,
  );
  const [dbCategories, setDbCategories] = useState<CategoryRow[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{ id: number; name: string } | null>(null);
  const { options: accountOptions, remove: removeAccount, refresh: refreshAccounts } = useAccounts();
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const result = await getAllCategories();
      setDbCategories(result);
    } catch (error) {
      logError("Erro ao buscar categorias:", error);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  // Ao abrir, marca "carregando" já na renderização (sem setState síncrono no effect).
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setIsLoadingCategories(true);
  }

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getAllCategories()
      .then((result) => {
        if (!cancelled) setDbCategories(result);
      })
      .catch((error) => logError("Erro ao buscar categorias:", error))
      .finally(() => {
        if (!cancelled) setIsLoadingCategories(false);
      });
    return () => {
      cancelled = true;
    };
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

  const confirmDeleteCategory = async () => {
    const category = categoryToDelete;
    setCategoryToDelete(null);
    if (!category) return;

    await onDeleteCategory(category.id);
    if (transactionCategory === String(category.name).trim()) {
      setTransactionCategory(defaultCategories[0]);
    }
    fetchCategories();
  };

  const confirmDeleteAccount = async () => {
    const account = accountToDelete;
    setAccountToDelete(null);
    if (!account) return;

    await removeAccount(account.id);
    if (transactionAccount === account.name) {
      setTransactionAccount(DEFAULT_ACCOUNT_NAME);
    }
  };

  /** Preenche o formulário com o que a leitura do recibo achou; o usuário sempre confere antes de salvar. */
  const applyReceiptScanResult = (result: ReceiptScanResult) => {
    if (result.status === "cancelled") return;
    if (result.status === "unsupported") {
      setScanError("Esse aparelho não suporta a leitura de recibo por foto.");
      return;
    }
    if (result.status === "permission-denied") {
      setScanError("Sem permissão para usar a câmera ou a galeria.");
      return;
    }
    if (result.status === "no-text") {
      setScanError("Não encontrei nenhum texto legível nessa foto. Tente uma foto mais nítida.");
      return;
    }
    if (result.status === "error") {
      setScanError("Não foi possível ler essa foto. Tente de novo.");
      return;
    }

    const parsed = parseReceiptText(result.text);
    setScanError(null);
    setTransactionType("expense");
    if (parsed.description) setTransactionTitle(parsed.description);
    if (parsed.amount !== null) {
      const rawCents = Math.round(parsed.amount * 100).toString();
      setTransactionAmount(formatCurrencyInput(rawCents));
    }
    setTransactionDate(parsed.date);
    if (parsed.category) setTransactionCategory(parsed.category);
  };

  const handleScanFromCamera = async () => {
    setScanError(null);
    setIsScanningReceipt(true);
    try {
      applyReceiptScanResult(await scanReceiptFromCamera());
    } catch (error) {
      logError("Erro ao escanear recibo (câmera):", error);
      setScanError("Não foi possível ler essa foto. Tente de novo.");
    } finally {
      setIsScanningReceipt(false);
    }
  };

  const handleScanFromLibrary = async () => {
    setScanError(null);
    setIsScanningReceipt(true);
    try {
      applyReceiptScanResult(await scanReceiptFromLibrary());
    } catch (error) {
      logError("Erro ao escanear recibo (galeria):", error);
      setScanError("Não foi possível ler essa foto. Tente de novo.");
    } finally {
      setIsScanningReceipt(false);
    }
  };

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
                            onPress={() => setCategoryToDelete(deletable)}
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
                    onPress={() => setIsAccountModalVisible(true)}
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
                            onPress={() => setAccountToDelete({ id: option.id as number, name: option.name })}
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
                        ? `${colors.income}26`
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
                          ? `${colors.income}26`
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

      <ConfirmModal
        visible={!!categoryToDelete}
        title="Excluir categoria"
        message={
          categoryToDelete
            ? `Excluir a categoria "${String(categoryToDelete.name).trim()}"? As transações e metas já registradas com ela continuam existindo, só deixam de aparecer atreladas a essa categoria.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        onCancel={() => setCategoryToDelete(null)}
        onConfirm={confirmDeleteCategory}
      />

      {/* MODAL DE CRIAR CONTA */}
      <AccountModal
        visible={isAccountModalVisible}
        onClose={() => setIsAccountModalVisible(false)}
        onSave={(novaConta) => {
          setIsAccountModalVisible(false);
          setTransactionAccount(novaConta);
          refreshAccounts();
        }}
      />

      <ConfirmModal
        visible={!!accountToDelete}
        title="Excluir conta"
        message={
          accountToDelete
            ? `Excluir a conta "${accountToDelete.name}"? As transações já registradas nela continuam existindo, só deixam de aparecer atreladas a essa conta.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        onCancel={() => setAccountToDelete(null)}
        onConfirm={confirmDeleteAccount}
      />
    </>
  );
}
