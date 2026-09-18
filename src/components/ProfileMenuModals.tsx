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

interface ProfileMenuModalProps {
  visible: boolean;
  onClose: () => void;
  userName: string;
  userImage: string | null;
  onPickImage: () => void;
  onOpenEditName: () => void;
  onExportPDF: () => void;
  onExportCSV: () => void;
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
                  <Ionicons name="person" size={24} color="#FFFFFF" />
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
            <Ionicons name="document-text-outline" size={24} color="#FFFFFF" />
            <Text style={styles.menuItemText}>Exportar Relatório PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onExportCSV}>
            <Ionicons name="download-outline" size={24} color="#FFFFFF" />
            <Text style={styles.menuItemText}>Exportar Backup (CSV)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onChangePIN}>
            <Ionicons name="lock-closed-outline" size={24} color="#10B981" />
            <Text style={styles.menuItemText}>Alterar PIN de Segurança</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={onWipeData}>
            <Ionicons name="trash-outline" size={24} color="#EF4444" />
            <Text style={[styles.menuItemText, { color: "#EF4444" }]}>
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
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Como devemos te chamar?</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite seu nome"
            placeholderTextColor="#888888"
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
  menuContainer: {
    width: "85%",
    backgroundColor: "#1E1E1E",
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
    backgroundColor: "#333333",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  editNameText: {
    color: "#10B981",
    fontSize: 14,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#333333",
    marginVertical: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  menuItemText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 16,
  },
  modalContainer: {
    width: "85%",
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#2A2A2A",
    color: "#FFFFFF",
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
    color: "#A1A1AA",
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: "#10B981",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
