import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Text, TextInput, TouchableOpacity, View } from "react-native";

interface TransactionModalProps {
  visible: boolean;
  onClose: () => void;
  transactionType: "income" | "expense";
  setTransactionType: (type: "income" | "expense") => void;
  transactionTitle: string;
  setTransactionTitle: (text: string) => void;
  transactionAmount: string;
  setTransactionAmount: (text: string) => void;
  transactionDate: string;
  setTransactionDate: (text: string) => void;
  transactionCategory: string;
  setTransactionCategory: (category: string) => void;
  formatCurrency: (value: string) => string;
  onSave: () => void;
}

// Mapa global de cores por categoria
export const categoryColors: Record<string, string> = {
  Salário: "#10B981",
  Investimentos: "#3B82F6",
  Alimentação: "#F59E0B",
  Moradia: "#8B5CF6",
  Transporte: "#06B6D4",
  Lazer: "#EC4899",
  Outros: "#A1A1AA",
};

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
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const incomeCategories = ["Salário", "Investimentos"];
  const expenseCategories = [
    "Alimentação",
    "Moradia",
    "Transporte",
    "Lazer",
    "Outros",
  ];
  const currentCategories =
    transactionType === "income" ? incomeCategories : expenseCategories;

  const activeCategoryColor = categoryColors[transactionCategory] || "#FFFFFF";

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: "#1E1E1E",
            borderColor: "#333333",
            borderWidth: 1,
            borderRadius: 20,
            padding: 20,
            width: "100%",
            maxWidth: 380,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
              position: "relative",
            }}
          >
            <Text
              style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "bold" }}
            >
              NOVA TRANSAÇÃO
            </Text>
            <TouchableOpacity
              style={{ position: "absolute", right: 0 }}
              onPress={onClose}
            >
              <Ionicons name="close" size={22} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          {/* Abas Receita / Despesa */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#121212",
              borderRadius: 12,
              padding: 4,
              marginBottom: 16,
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: "center",
                backgroundColor:
                  transactionType === "income" ? "#10B981" : "transparent",
                borderRadius: 10,
              }}
              onPress={() => {
                setTransactionType("income");
                setTransactionCategory("Salário");
                setIsCategoryDropdownOpen(false);
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: 12 }}
              >
                RECEITA
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: "center",
                backgroundColor:
                  transactionType === "expense" ? "#EF4444" : "transparent",
                borderRadius: 10,
              }}
              onPress={() => {
                setTransactionType("expense");
                setTransactionCategory("Alimentação");
                setIsCategoryDropdownOpen(false);
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: 12 }}
              >
                DESPESA
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 12 }}>
            <View>
              <Text
                style={{
                  color: "#A1A1AA",
                  fontSize: 11,
                  marginBottom: 4,
                  fontWeight: "bold",
                }}
              >
                TÍTULO
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#121212",
                  borderWidth: 1,
                  borderColor: "#333333",
                  borderRadius: 12,
                  padding: 10,
                  color: "#FFFFFF",
                  fontSize: 14,
                }}
                placeholder="Ex: Aluguel, Salário..."
                placeholderTextColor="#666"
                value={transactionTitle}
                onChangeText={setTransactionTitle}
              />
            </View>

            <View>
              <Text
                style={{
                  color: "#A1A1AA",
                  fontSize: 11,
                  marginBottom: 4,
                  fontWeight: "bold",
                }}
              >
                VALOR (R$)
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#121212",
                  borderWidth: 1,
                  borderColor: "#333333",
                  borderRadius: 12,
                  padding: 10,
                  color: "#FFFFFF",
                  fontSize: 14,
                }}
                placeholder="R$ 0,00"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={transactionAmount}
                onChangeText={(text) =>
                  setTransactionAmount(formatCurrency(text))
                }
              />
            </View>

            <View>
              <Text
                style={{
                  color: "#A1A1AA",
                  fontSize: 11,
                  marginBottom: 4,
                  fontWeight: "bold",
                }}
              >
                DATA
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#121212",
                  borderWidth: 1,
                  borderColor: "#333333",
                  borderRadius: 12,
                  padding: 10,
                  color: "#FFFFFF",
                  fontSize: 14,
                }}
                value={transactionDate}
                onChangeText={setTransactionDate}
              />
            </View>

            {/* Seletor de Categoria com Indicador de Cor */}
            <View style={{ position: "relative" }}>
              <Text
                style={{
                  color: "#A1A1AA",
                  fontSize: 11,
                  marginBottom: 4,
                  fontWeight: "bold",
                }}
              >
                CATEGORIA
              </Text>

              <TouchableOpacity
                style={{
                  backgroundColor: "#121212",
                  borderWidth: 1,
                  borderColor: "#333333",
                  borderRadius: 12,
                  padding: 10,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onPress={() =>
                  setIsCategoryDropdownOpen(!isCategoryDropdownOpen)
                }
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: activeCategoryColor,
                    }}
                  />
                  <Text style={{ color: "#FFFFFF", fontSize: 14 }}>
                    {transactionCategory}
                  </Text>
                </View>
                <Ionicons
                  name={isCategoryDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#A1A1AA"
                />
              </TouchableOpacity>

              {isCategoryDropdownOpen && (
                <View
                  style={{
                    position: "absolute",
                    top: 75,
                    left: 0,
                    right: 0,
                    backgroundColor: "#121212",
                    borderWidth: 1,
                    borderColor: "#333333",
                    borderRadius: 12,
                    zIndex: 10,
                    overflow: "hidden",
                  }}
                >
                  {currentCategories.map((cat, index) => {
                    const itemColor = categoryColors[cat] || "#FFFFFF";
                    return (
                      <TouchableOpacity
                        key={index}
                        style={{
                          padding: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          borderBottomWidth:
                            index < currentCategories.length - 1 ? 1 : 0,
                          borderBottomColor: "#222222",
                          backgroundColor:
                            transactionCategory === cat
                              ? "#1E1E1E"
                              : "transparent",
                        }}
                        onPress={() => {
                          setTransactionCategory(cat);
                          setIsCategoryDropdownOpen(false);
                        }}
                      >
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: itemColor,
                          }}
                        />
                        <Text
                          style={{
                            color:
                              transactionCategory === cat
                                ? itemColor
                                : "#FFFFFF",
                            fontWeight:
                              transactionCategory === cat ? "bold" : "normal",
                            fontSize: 14,
                          }}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: "#2A2A2A",
                borderWidth: 1,
                borderColor: "#FFFFFF",
                borderRadius: 12,
                padding: 12,
                alignItems: "center",
                marginTop: 6,
              }}
              onPress={onSave}
            >
              <Text
                style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: 15 }}
              >
                SALVAR TRANSAÇÃO
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
