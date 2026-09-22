import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, ScrollView, TouchableOpacity, View } from "react-native";
import { ACCENT_COLORS, CATEGORY_COLORS } from "../../constants/colors";
import { createAccount } from "../../database/accounts";
import { logError } from "../../utils/logger";
import { Text, TextInput, modalCard, modalScrim, useTheme } from "../../theme";

// Cores fixas (ficam salvas na conta): iguais em todos os temas.
const COLORS = [
  ACCENT_COLORS.accent,
  ACCENT_COLORS.income,
  ACCENT_COLORS.expense,
  CATEGORY_COLORS.categoryAmber,
  CATEGORY_COLORS.categoryIndigo,
  CATEGORY_COLORS.categoryPurple,
  CATEGORY_COLORS.categoryPink,
  CATEGORY_COLORS.categoryCyan,
  CATEGORY_COLORS.categoryNeutral,
];

interface AccountModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (accountName: string) => void;
}

/** Criar uma conta/carteira nova (nome + cor), a partir do seletor de contas de qualquer formulário. */
export function AccountModal({ visible, onClose, onSave }: AccountModalProps) {
  const theme = useTheme();
  const { colors } = theme;
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  // Reseta o formulário quando o modal abre (durante a renderização, sem setState no effect).
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName("");
      setSelectedColor(COLORS[0]);
    }
  }

  const handleSave = async () => {
    const safeName = name.trim();
    if (!safeName) return;

    try {
      await createAccount(safeName, selectedColor);
      onSave(safeName);
    } catch (error) {
      logError("Erro ao salvar conta:", error);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: modalScrim(theme, 0.6),
          justifyContent: "flex-start",
          paddingTop: 60,
        }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            ...modalCard(theme),
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
              <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "bold" }}>Nova Conta</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>Nome da Conta</Text>
              <TextInput
                style={{
                  backgroundColor: colors.surfaceAlt,
                  color: colors.textPrimary,
                  padding: 16,
                  borderRadius: 12,
                }}
                value={name}
                onChangeText={setName}
                placeholder="Ex: Carteira, Nubank, Poupança"
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>Cor</Text>
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
                        borderColor: selectedColor === color ? colors.textPrimary : "transparent",
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
              <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 16 }}>Salvar Conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
