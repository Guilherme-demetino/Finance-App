import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../constants/colors";
import { createCategory } from "../database/categories";
import { logError } from "../utils/logger";

// Cores disponíveis para as categorias
const COLORS = [
  colors.expense,
  colors.categoryOrange,
  colors.categoryAmber,
  colors.income,
  colors.accent,
  colors.categoryIndigo,
  colors.categoryPurple,
  colors.categoryPink,
  colors.categoryNeutral,
];

interface CategoryModalProps {
  visible: boolean;
  onClose: () => void;
  transactionType: "income" | "expense";
  onSave: (categoryName: string, type: "income" | "expense") => void;
  /** Quando true, esconde o alternador Receita/Despesa e trava no `transactionType` recebido. */
  lockType?: boolean;
}

export function CategoryModal({
  visible,
  onClose,
  transactionType,
  onSave,
  lockType = false,
}: CategoryModalProps) {
  const [categoryName, setCategoryName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedType, setSelectedType] = useState<"income" | "expense">(
    transactionType,
  );

  // Reseta o formulário quando o modal abre (durante a renderização, sem setState no effect).
  const openKey = visible ? transactionType : null;
  const [prevOpenKey, setPrevOpenKey] = useState<typeof openKey>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    if (openKey) {
      setSelectedType(openKey);
      setCategoryName("");
      setSelectedColor(COLORS[0]);
    }
  }

  const handleSave = async () => {
    const safeName = String(categoryName || "").trim();
    if (!safeName) return;

    const safeColor = String(selectedColor || colors.expense);
    const safeType =
      String(selectedType || "expense") === "income" ? "income" : "expense";

    try {
      await createCategory(safeName, safeColor, safeType);

      // Repassa os dados corretos para o modal pai
      onSave(safeName, safeType);
    } catch (error) {
      logError("Erro ao salvar categoria:", error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      {/* Ancorado no topo pra o teclado não cobrir os campos. */}
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-start",
          paddingTop: 60,
        }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            marginHorizontal: 16,
            padding: 24,
          }}
        >
          <View>
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
                Nova Categoria
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {!lockType && (
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor:
                      selectedType === "income"
                        ? "rgba(16, 185, 129, 0.15)"
                        : colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor:
                      selectedType === "income" ? colors.income : colors.surfaceAlt,
                  }}
                  onPress={() => setSelectedType("income")}
                >
                  <Text
                    style={{
                      color: selectedType === "income" ? colors.income : colors.textMuted,
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
                      selectedType === "expense"
                        ? "rgba(239, 68, 68, 0.15)"
                        : colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor:
                      selectedType === "expense" ? colors.expense : colors.surfaceAlt,
                  }}
                  onPress={() => setSelectedType("expense")}
                >
                  <Text
                    style={{
                      color: selectedType === "expense" ? colors.expense : colors.textMuted,
                      fontWeight: "bold",
                    }}
                  >
                    Despesa
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
                Nome da Categoria
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.surfaceAlt,
                  color: colors.textPrimary,
                  padding: 16,
                  borderRadius: 12,
                }}
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="Ex: Assinaturas"
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
                Cor
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  {COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setSelectedColor(color)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: color,
                        borderWidth: 3,
                        borderColor:
                          selectedColor === color ? colors.textPrimary : "transparent",
                      }}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <TouchableOpacity
              onPress={handleSave}
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
                Salvar Categoria
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
