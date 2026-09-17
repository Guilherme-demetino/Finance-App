import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getDatabase } from "../database/sqlite";
import { CategoryModal } from "./CategoryModal";

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
  const [dbCategories, setDbCategories] = useState<any[]>([]);

  const fetchCategories = async () => {
    try {
      const db = await getDatabase();

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT, 
          name TEXT NOT NULL, 
          color TEXT NOT NULL, 
          type TEXT NOT NULL DEFAULT 'expense'
        )
      `);

      const result = await db.getAllAsync(
        "SELECT * FROM categories ORDER BY id DESC",
      );
      setDbCategories(result);
    } catch (error) {
      console.log("Erro ao buscar categorias:", error);
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
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
          zIndex: 999,
          elevation: 999,
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ maxHeight: "90%" }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              backgroundColor: "#1E1E1E",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
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
                style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "bold" }}
              >
                Nova Transação
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#888" />
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
                      : "#2A2A2A",
                  borderWidth: 1,
                  borderColor:
                    transactionType === "income" ? "#10B981" : "#2A2A2A",
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
                    color: transactionType === "income" ? "#10B981" : "#888",
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
                      : "#2A2A2A",
                  borderWidth: 1,
                  borderColor:
                    transactionType === "expense" ? "#EF4444" : "#2A2A2A",
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
                    color: transactionType === "expense" ? "#EF4444" : "#888",
                    fontWeight: "bold",
                  }}
                >
                  Despesa
                </Text>
              </TouchableOpacity>
            </View>

            {/* CAMPOS DE TEXTO */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>
                Descrição
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#2A2A2A",
                  color: "#FFFFFF",
                  padding: 16,
                  borderRadius: 12,
                }}
                value={transactionTitle}
                onChangeText={setTransactionTitle}
                placeholder="Ex: Supermercado"
                placeholderTextColor="#666"
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>
                Valor (R$)
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#2A2A2A",
                  color: "#FFFFFF",
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
                placeholderTextColor="#666"
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>
                Data
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#2A2A2A",
                  color: "#FFFFFF",
                  padding: 16,
                  borderRadius: 12,
                }}
                value={transactionDate}
                onChangeText={setTransactionDate}
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#666"
              />
            </View>

            {/* LISTA DE CATEGORIAS */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: "#888", fontSize: 13, marginBottom: 10 }}>
                Categoria
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View
                  style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
                >
                  <TouchableOpacity
                    onPress={() => setIsCategoryModalVisible(true)}
                    style={{
                      backgroundColor: "#2A2A2A",
                      borderWidth: 1,
                      borderColor: "#FFFFFF",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Ionicons name="add" size={14} color="#FFFFFF" />
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontWeight: "bold",
                        fontSize: 12,
                      }}
                    >
                      Nova
                    </Text>
                  </TouchableOpacity>

                  {displayCategories.map((catName, index) => {
                    const isSelected = transactionCategory === catName;
                    return (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setTransactionCategory(catName)}
                        style={{
                          backgroundColor: "#2A2A2A",
                          borderWidth: 1,
                          borderColor: "#FFFFFF",
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 8,
                          opacity: isSelected ? 1 : 0.5,
                        }}
                      >
                        <Text
                          style={{
                            color: "#FFFFFF",
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
                backgroundColor: "#2A2A2A",
                borderWidth: 1,
                borderColor: "#FFFFFF",
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: 16 }}
              >
                Salvar Transação
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

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
