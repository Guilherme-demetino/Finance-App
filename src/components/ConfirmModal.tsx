import { Modal, TouchableOpacity, View } from "react-native";
import { useMenuStyles } from "../styles/menuStyles";
import { Text, useTheme } from "../theme";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Deixa o botão de confirmar em vermelho, pra ações destrutivas (excluir). */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors } = useTheme();
  const menuStyles = useMenuStyles();
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={menuStyles.modalContainer}>
        <View style={menuStyles.modalContent}>
          <Text style={menuStyles.modalTitle}>{title}</Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              textAlign: "center",
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            {message}
          </Text>

          <View style={menuStyles.modalButtons}>
            <TouchableOpacity style={menuStyles.modalButtonCancel} onPress={onCancel}>
              <Text style={menuStyles.modalButtonText}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                menuStyles.modalButtonSave,
                destructive && { backgroundColor: colors.expense },
              ]}
              onPress={onConfirm}
            >
              <Text style={[menuStyles.modalButtonText, { color: colors.textOnColor }]}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
