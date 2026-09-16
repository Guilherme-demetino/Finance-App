import { Ionicons } from "@expo/vector-icons";
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
  formatCurrency,
  onSave,
}: TransactionModalProps) {
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
              onPress={() => setTransactionType("income")}
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
              onPress={() => setTransactionType("expense")}
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

            <View>
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
              <View
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
              >
                <Text style={{ color: "#FFFFFF", fontSize: 14 }}>
                  {transactionCategory}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#A1A1AA" />
              </View>
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
