import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function DashboardScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState("Usuário");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  const showAlert = (title: string, message: string) => {
    Alert.alert(title, message);
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = () => {
    try {
      const db = SQLite.openDatabaseSync("meufinanceiro.db");
      db.runSync(
        `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, avatar TEXT)`,
      );
      const result: any = db.getAllSync("SELECT name FROM users LIMIT 1");
      if (result && result.length > 0) {
        setUserName(result[0].name);
      }
    } catch (error) {
      console.log("Erro ao carregar dados do usuário:", error);
    }
  };

  const handleUpdateName = () => {
    if (newName.trim() === "") {
      showAlert("Atenção", "O nome não pode ficar vazio.");
      return;
    }

    try {
      const db = SQLite.openDatabaseSync("meufinanceiro.db");

      db.runSync(
        `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, avatar TEXT)`,
      );

      const existingUser: any = db.getAllSync("SELECT id FROM users LIMIT 1");

      if (existingUser && existingUser.length > 0) {
        db.runSync(
          "UPDATE users SET name = ? WHERE id = ?",
          newName.trim(),
          existingUser[0].id,
        );
      } else {
        db.runSync(
          "INSERT INTO users (id, name) VALUES (1, ?)",
          newName.trim(),
        );
      }

      setUserName(newName.trim());
      setNewName("");
      setIsEditingName(false);
      setIsMenuOpen(false);
      showAlert("Sucesso", "Nome alterado com sucesso!");
    } catch (error) {
      console.log("Erro ao atualizar nome:", error);
      showAlert("Erro", "Não foi possível atualizar o nome.");
    }
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Olá, bem-vindo(a)</Text>
          <Text style={styles.userNameText}>{userName}</Text>
        </View>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setIsMenuOpen(true)}
        >
          <Ionicons name="menu" size={26} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Card de Saldo */}
        <View style={styles.cardBalance}>
          <Text style={styles.cardLabel}>Saldo Total</Text>
          <Text style={styles.cardValue}>R$ 0,00</Text>
        </View>
      </ScrollView>

      {/* Modal do Menu de Opções / Alteração de Nome */}
      <Modal visible={isMenuOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Menu de Opções</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsMenuOpen(false);
                  setIsEditingName(false);
                }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {!isEditingName ? (
              <View style={styles.menuOptionsList}>
                <TouchableOpacity
                  style={styles.menuOptionItem}
                  onPress={() => setIsEditingName(true)}
                >
                  <Ionicons name="person-outline" size={20} color="#007AFF" />
                  <Text style={styles.menuOptionText}>
                    Alterar Nome de Exibição
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuOptionItem}
                  onPress={() => {
                    setIsMenuOpen(false);
                    router.push("/security");
                  }}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#007AFF"
                  />
                  <Text style={styles.menuOptionText}>
                    Configurações de Segurança
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.editNameContainer}>
                <Text style={styles.inputLabel}>Novo Nome:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite seu nome"
                  placeholderTextColor="#999"
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
                <View style={styles.editButtonsRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={() => setIsEditingName(false)}
                  >
                    <Text style={styles.cancelButtonText}>Voltar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.saveButton]}
                    onPress={handleUpdateName}
                  >
                    <Text style={styles.saveButtonText}>Salvar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  welcomeText: {
    fontSize: 14,
    color: "#666",
  },
  userNameText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
  },
  scrollContent: {
    padding: 20,
  },
  cardBalance: {
    backgroundColor: "#007AFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardLabel: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    marginBottom: 8,
  },
  cardValue: {
    color: "#FFF",
    fontSize: 32,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  menuOptionsList: {
    gap: 12,
  },
  menuOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F8F9FA",
    borderRadius: 10,
    gap: 12,
  },
  menuOptionText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
  },
  editNameContainer: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: "#555",
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    backgroundColor: "#FAFAFA",
    color: "#333",
  },
  editButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#F0F0F0",
  },
  cancelButtonText: {
    color: "#333",
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#007AFF",
  },
  saveButtonText: {
    color: "#FFF",
    fontWeight: "600",
  },
});
