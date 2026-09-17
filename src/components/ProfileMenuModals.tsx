import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { styles as menuStyles } from "../app/../styles/menuStyles";

interface ProfileMenuModalProps {
  visible: boolean;
  onClose: () => void;
  userName: string;
  userImage: string | null;
  onPickImage: () => void;
  onOpenEditName: () => void;
  onExportPDF: () => void;
}

export function ProfileMenuModal({
  visible,
  onClose,
  userName,
  userImage,
  onPickImage,
  onOpenEditName,
  onExportPDF,
}: ProfileMenuModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={menuStyles.overlay}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={menuStyles.menuContainer}>
          <View>
            <View style={menuStyles.menuHeader}>
              <TouchableOpacity
                onPress={onPickImage}
                style={menuStyles.avatarContainer}
              >
                {userImage ? (
                  <Image
                    source={{ uri: userImage }}
                    style={menuStyles.avatarImage}
                  />
                ) : (
                  <Ionicons name="camera" size={40} color="#FFFFFF" />
                )}
              </TouchableOpacity>
              <Text style={menuStyles.menuTitle}>{userName}</Text>
              <Text style={menuStyles.menuSubtitle}>
                Toque na foto para alterar
              </Text>
            </View>

            <View style={menuStyles.menuBody}>
              {/* Botão de Alterar Nome */}
              <TouchableOpacity
                style={{
                  backgroundColor: "#2A2A2A",
                  borderWidth: 1,
                  borderColor: "#FFFFFF",
                  height: 50,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  marginBottom: 12,
                }}
                onPress={onOpenEditName}
              >
                <Text
                  style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "bold" }}
                >
                  Altere seu nome
                </Text>
              </TouchableOpacity>

              {/* Botão de Exportar Relatório PDF (Com borda branca igual ao de cima) */}
              <TouchableOpacity
                style={{
                  backgroundColor: "#2A2A2A",
                  borderWidth: 1,
                  borderColor: "#FFFFFF", // Alterado para branco
                  height: 50,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  gap: 8,
                }}
                onPress={() => {
                  onClose();
                  onExportPDF();
                }}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color="#FFFFFF"
                />
                <Text
                  style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "bold" }}
                >
                  Exportar Relatório PDF
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={menuStyles.closeButton} onPress={onClose}>
            <Text style={menuStyles.closeButtonText}>Fechar Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface EditNameModalProps {
  visible: boolean;
  onClose: () => void;
  newName: string;
  setNewName: (text: string) => void;
  onSave: () => void;
}

export function EditNameModal({
  visible,
  onClose,
  newName,
  setNewName,
  onSave,
}: EditNameModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={menuStyles.modalContainer}>
        <View style={menuStyles.modalContent}>
          <Text style={menuStyles.modalTitle}>Alterar Seu Nome</Text>
          <TextInput
            style={menuStyles.modalInput}
            placeholder="Digite o novo nome"
            placeholderTextColor="#666"
            value={newName}
            onChangeText={setNewName}
            autoFocus={true}
          />
          <View style={menuStyles.modalButtons}>
            <TouchableOpacity
              style={menuStyles.modalButtonCancel}
              onPress={onClose}
            >
              <Text style={menuStyles.modalButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={menuStyles.modalButtonSave}
              onPress={onSave}
            >
              <Text style={menuStyles.modalButtonText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
