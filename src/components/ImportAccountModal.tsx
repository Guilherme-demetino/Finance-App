import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, ScrollView, TouchableOpacity, View } from "react-native";
import { DEFAULT_ACCOUNT_NAME } from "../database/accounts";
import { useAccounts } from "../hooks/useAccounts";
import { Text, modalCard, modalScrim, useTheme } from "../theme";
import { AccountModal } from "./forms/AccountModal";

interface ImportAccountModalProps {
  visible: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: (account: string) => void;
}

/** Escolhe em qual conta entram as transações importadas do extrato — todas juntas, num único lote. */
export function ImportAccountModal({ visible, message, onCancel, onConfirm }: ImportAccountModalProps) {
  const theme = useTheme();
  const { colors } = theme;
  const { options } = useAccounts();
  const [account, setAccount] = useState(DEFAULT_ACCOUNT_NAME);
  const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);

  // Reseta pro padrão toda vez que o modal abre (durante a renderização, sem setState no effect).
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setAccount(DEFAULT_ACCOUNT_NAME);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: modalScrim(theme, 0.6), justifyContent: "center", padding: 24 }}>
        <View style={{ ...modalCard(theme), borderRadius: 20, padding: 24 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>
            Importar transações
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 20, lineHeight: 20 }}>
            {message}
          </Text>

          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 10 }}>Em qual conta?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
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
                <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 12 }}>Nova</Text>
              </TouchableOpacity>
              {options.map((option) => {
                const isSelected = account === option.name;
                return (
                  <TouchableOpacity
                    key={option.name}
                    onPress={() => setAccount(option.name)}
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
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "bold" }}>{option.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity onPress={onCancel} style={{ flex: 1, paddingVertical: 12, alignItems: "center" }} accessibilityRole="button">
              <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onConfirm(account)}
              style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.textPrimary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "bold" }}>Importar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <AccountModal
        visible={isAccountModalVisible}
        onClose={() => setIsAccountModalVisible(false)}
        onSave={(novaConta) => {
          setIsAccountModalVisible(false);
          setAccount(novaConta);
        }}
      />
    </Modal>
  );
}
