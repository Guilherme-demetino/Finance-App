import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getDatabase } from "../database/sqlite";

// Cores disponíveis para as categorias
const COLORS = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#A8A29E",
];

interface CategoryModalProps {
  visible: boolean;
  onClose: () => void;
  transactionType: "income" | "expense";
  onSave: (categoryName: string, type: "income" | "expense") => void;
}

export function CategoryModal({
  visible,
  onClose,
  transactionType,
  onSave,
}: CategoryModalProps) {
  const [categoryName, setCategoryName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedType, setSelectedType] = useState<"income" | "expense">(
    transactionType,
  );

  useEffect(() => {
    if (visible) {
      setSelectedType(transactionType);
      setCategoryName("");
      setSelectedColor(COLORS[0]);
    }
  }, [visible, transactionType]);
  const handleSave = async () => {
    const safeName = String(categoryName || "").trim();
    if (!safeName) return;

    const safeColor = String(selectedColor || "#EF4444");
    const safeType =
      String(selectedType || "expense") === "income" ? "income" : "expense";

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

      await db.runAsync(
        "INSERT INTO categories (name, color, type) VALUES (?, ?, ?)",
        [safeName, safeColor, safeType],
      );

      // Repassa os dados corretos para o modal pai
      onSave(safeName, safeType);
    } catch (error) {
      console.log("Erro ao salvar categoria:", error);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={{
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
                Nova Categoria
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

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
                      : "#2A2A2A",
                  borderWidth: 1,
                  borderColor:
                    selectedType === "income" ? "#10B981" : "#2A2A2A",
                }}
                onPress={() => setSelectedType("income")}
              >
                <Text
                  style={{
                    color: selectedType === "income" ? "#10B981" : "#888",
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
                      : "#2A2A2A",
                  borderWidth: 1,
                  borderColor:
                    selectedType === "expense" ? "#EF4444" : "#2A2A2A",
                }}
                onPress={() => setSelectedType("expense")}
              >
                <Text
                  style={{
                    color: selectedType === "expense" ? "#EF4444" : "#888",
                    fontWeight: "bold",
                  }}
                >
                  Despesa
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>
                Nome da Categoria
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#2A2A2A",
                  color: "#FFFFFF",
                  padding: 16,
                  borderRadius: 12,
                }}
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="Ex: Assinaturas"
                placeholderTextColor="#666"
              />
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>
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
                          selectedColor === color ? "#FFFFFF" : "transparent",
                      }}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <TouchableOpacity
              onPress={handleSave}
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
                Salvar Categoria
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
