import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../constants/colors";

interface ProfileMenuModalProps {
  visible: boolean;
  onClose: () => void;
  userName: string;
  userImage: string | null;
  onPickImage: () => void;
  onOpenEditName: () => void;
  onExportPDF: () => void;
  onExportCSV: () => void;
  onImportCSV: () => void;
  onChangePIN: () => void;
  onWipeData: () => void;
}

export function ProfileMenuModal({
  visible,
  onClose,
  userName,
  userImage,
  onPickImage,
  onOpenEditName,
  onExportPDF,
  onExportCSV,
  onImportCSV,
  onChangePIN,
  onWipeData,
}: ProfileMenuModalProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.menuContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onPickImage}>
              {userImage ? (
                <Image source={{ uri: userImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={24} color={colors.textPrimary} />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userName}</Text>
              <TouchableOpacity onPress={onOpenEditName}>
                <Text style={styles.editNameText}>Editar Nome</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={onExportPDF}>
            <Ionicons name="document-text-outline" size={24} color={colors.textPrimary} />
            <Text style={styles.menuItemText}>Exportar Relatório PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onExportCSV}>
            <Ionicons name="download-outline" size={24} color={colors.textPrimary} />
            <Text style={styles.menuItemText}>Exportar Backup (CSV)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onImportCSV}>
            <Ionicons name="cloud-upload-outline" size={24} color={colors.textPrimary} />
            <Text style={styles.menuItemText}>Importar Backup (CSV)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onChangePIN}>
            <Ionicons name="lock-closed-outline" size={24} color={colors.textPrimary} />
            <Text style={styles.menuItemText}>Alterar PIN de Segurança</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={onWipeData}>
            <Ionicons name="trash-outline" size={24} color={colors.expense} />
            <Text style={[styles.menuItemText, { color: colors.expense }]}>
              Zerar Dados do App
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

interface EditNameModalProps {
  visible: boolean;
  onClose: () => void;
  newName: string;
  setNewName: (name: string) => void;
  onSave: () => void;
}

export function EditNameModal({
  visible,
  onClose,
  newName,
  setNewName,
  onSave,
}: EditNameModalProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.topOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Como devemos te chamar?</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite seu nome"
            placeholderTextColor={colors.textMuted}
            value={newName}
            onChangeText={setNewName}
            autoCorrect={false}
            autoFocus
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={onSave}>
              <Text style={styles.saveButtonText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  // Fica no topo pra o teclado (que abre na hora, por causa do autoFocus)
  // não cobrir o campo nem os botões.
  topOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 100,
  },
  menuContainer: {
    width: "85%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "bold",
  },
  editNameText: {
    color: colors.textPrimary,
    fontSize: 14,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  menuItemText: {
    color: colors.textPrimary,
    fontSize: 16,
    marginLeft: 16,
  },
  modalContainer: {
    width: "85%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: colors.income,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "bold",
  },
});
