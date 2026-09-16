import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CustomAlert } from "../components/CustomAlert";
import { styles } from "./styles/dashboardStyles";
import { styles as menuStyles } from "./styles/menuStyles";

export default function DashboardScreen() {
  const [userName, setUserName] = useState("Carregando...");
  const [userImage, setUserImage] = useState<string | null>(null);
  const [isPieView, setIsPieView] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  // Estados para o CustomAlert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const totalIncome = 4500.0;
  const totalExpense = 189.9;
  const totalBalance = totalIncome - totalExpense;

  const totalMoney = totalIncome + totalExpense;
  const incomePercentage =
    totalMoney > 0 ? (totalIncome / totalMoney) * 100 : 50;
  const expensePercentage =
    totalMoney > 0 ? (totalExpense / totalMoney) * 100 : 50;

  // Busca dados do usuário (Nome e Foto) do SQLite
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");

      // 1. Garante que a tabela base existe
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        );
      `);

      // 2. Adiciona a coluna 'avatar' caso ela ainda não exista na tabela antiga
      try {
        await db.execAsync(`ALTER TABLE users ADD COLUMN avatar TEXT;`);
      } catch (e) {
        // Se a coluna já existir, o SQLite vai gerar um erro que ignoramos aqui com segurança
      }

      const result: any = await db.getAllAsync("SELECT * FROM users LIMIT 1");

      if (result && result.length > 0) {
        setUserName(result[0].name);
        if (result[0].avatar) {
          setUserImage(result[0].avatar);
        }
      } else {
        setUserName("Meu Finanças");
      }
    } catch (error) {
      console.log("Erro ao buscar usuário:", error);
      setUserName("Meu Finanças");
    }
  };

  // Função para escolher foto da galeria
  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      showAlert(
        "Permissão negada",
        "Precisamos de acesso à galeria para alterar sua foto.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      const imageUri = result.assets[0].uri;

      try {
        setUserImage(imageUri);

        const db = await SQLite.openDatabaseAsync("meufinanceiro.db");

        // Garante que o registro com id = 1 existe antes de atualizar para evitar NullPointerException
        await db.runAsync(
          "INSERT OR IGNORE INTO users (id, name) VALUES (1, ?)",
          [userName],
        );

        // Atualiza a foto no banco
        await db.runAsync("UPDATE users SET avatar = ? WHERE id = 1", [
          imageUri,
        ]);

        showAlert("Sucesso", "Foto de perfil atualizada com sucesso!");
      } catch (error) {
        console.log("Erro ao salvar foto no banco:", error);
        showAlert("Erro", "Não foi possível salvar a imagem.");
      }
    }
  };

  // Função para salvar o novo nome alterado
  const handleUpdateName = async () => {
    if (newName.trim() === "") {
      showAlert("Atenção", "O nome não pode ficar vazio.");
      return;
    }

    try {
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");
      await db.runAsync("UPDATE users SET name = ? WHERE id = 1", newName);
      setUserName(newName);
      setNewName("");
      setIsEditingName(false);
      setIsMenuOpen(false);
      showAlert("Sucesso", "Nome alterado com sucesso!");
    } catch (error) {
      console.log("Erro ao atualizar nome:", error);
      showAlert("Erro", "Não foi possível atualizar o nome.");
    }
  };

  const mockTransactions = [
    {
      id: "1",
      description: "Mercado",
      amount: 150.0,
      type: "expense",
      date: "Hoje",
      icon: "cart-outline",
    },
    {
      id: "2",
      description: "Salário",
      amount: 4500.0,
      type: "income",
      date: "Ontem",
      icon: "cash-outline",
    },
    {
      id: "3",
      description: "Netflix",
      amount: 39.9,
      type: "expense",
      date: "14 Set",
      icon: "tv-outline",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá,</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>

          {/* Botão de Perfil que abre a barra lateral */}
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => setIsMenuOpen(true)}
          >
            {userImage ? (
              <Image
                source={{ uri: userImage }}
                style={{ width: 40, height: 40, borderRadius: 20 }}
              />
            ) : (
              <Ionicons
                name="person-circle-outline"
                size={40}
                color="#3B82F6"
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Card de Saldo */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo Atual</Text>
          <Text style={styles.balanceAmount}>
            R$ {totalBalance.toFixed(2).replace(".", ",")}
          </Text>
        </View>

        {/* Resumo de Receitas e Despesas */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { marginRight: 8 }]}>
            <View style={styles.summaryHeader}>
              <Ionicons name="arrow-up-circle" size={24} color="#10B981" />
              <Text style={styles.summaryLabel}>Receitas</Text>
            </View>
            <Text style={styles.summaryValueIncome}>
              + R$ {totalIncome.toFixed(2).replace(".", ",")}
            </Text>
          </View>

          <View style={[styles.summaryCard, { marginLeft: 8 }]}>
            <View style={styles.summaryHeader}>
              <Ionicons name="arrow-down-circle" size={24} color="#EF4444" />
              <Text style={styles.summaryLabel}>Despesas</Text>
            </View>
            <Text style={styles.summaryValueExpense}>
              - R$ {totalExpense.toFixed(2).replace(".", ",")}
            </Text>
          </View>
        </View>

        {/* PAINEL INTERATIVO */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Balanço Geral</Text>
              <Text style={styles.chartSubtitle}>
                Toque no ícone para alternar a visão
              </Text>
            </View>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setIsPieView(!isPieView)}
            >
              <Ionicons
                name={isPieView ? "bar-chart-outline" : "pie-chart"}
                size={22}
                color="#3B82F6"
              />
            </TouchableOpacity>
          </View>

          {/* Gráfico de Pizza (Visão Circular) */}
          <View
            style={[
              styles.viewContainer,
              { display: isPieView ? "flex" : "none" },
            ]}
          >
            <View style={styles.pieContainer}>
              <View style={styles.donutOuterRing}>
                <View style={styles.donutInnerCircle}>
                  <Text style={styles.donutCenterText}>
                    {incomePercentage.toFixed(0)}%
                  </Text>
                  <Text style={styles.donutCenterSub}>Entradas</Text>
                </View>
              </View>

              <View style={styles.pieInfoSide}>
                <Text style={styles.pieInfoTitle}>Proporção de Fluxo</Text>
                <Text style={styles.pieInfoDesc}>
                  O gráfico demonstra o peso das saídas em relação às suas
                  entradas totais.
                </Text>
              </View>
            </View>
          </View>

          {/* Gráfico de Barras Proporcionais (Visão de Barras) */}
          <View
            style={[
              styles.viewContainer,
              { display: !isPieView ? "flex" : "none" },
            ]}
          >
            <View style={styles.progressBarWrapper}>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressIncome,
                    { width: `${incomePercentage}%` },
                  ]}
                />
                <View
                  style={[
                    styles.progressExpense,
                    { width: `${expensePercentage}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Legendas Dinâmicas */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#10B981" }]}
              />
              <Text style={styles.legendText}>
                Entradas ({incomePercentage.toFixed(0)}%)
              </Text>
            </View>

            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#EF4444" }]}
              />
              <Text style={styles.legendText}>
                Saídas ({expensePercentage.toFixed(0)}%)
              </Text>
            </View>
          </View>
        </View>

        {/* Transações Recentes */}
        <Text style={styles.sectionTitle}>Transações Recentes</Text>
        <View style={styles.transactionsList}>
          {mockTransactions.map((item) => (
            <View key={item.id} style={styles.transactionItem}>
              <View style={styles.transactionIcon}>
                <Ionicons name={item.icon as any} size={24} color="#FFFFFF" />
              </View>

              <View style={styles.transactionDetails}>
                <Text style={styles.transactionDescription}>
                  {item.description}
                </Text>
                <Text style={styles.transactionDate}>{item.date}</Text>
              </View>

              <Text
                style={[
                  styles.transactionAmount,
                  { color: item.type === "income" ? "#10B981" : "#EF4444" },
                ]}
              >
                {item.type === "income" ? "+" : "-"} R${" "}
                {item.amount.toFixed(2).replace(".", ",")}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Botão Flutuante (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => console.log("Ir para tela de adicionar")}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ================= BARRA LATERAL (DRAWER MENU) ================= */}
      <Modal
        visible={isMenuOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <View style={menuStyles.overlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setIsMenuOpen(false)}
          />

          <View style={menuStyles.menuContainer}>
            <View>
              {/* Ícone Redondo da Foto de Perfil */}
              <View style={menuStyles.menuHeader}>
                <TouchableOpacity
                  onPress={pickImage}
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

              {/* Botão Único para Alterar o Nome */}
              <View style={menuStyles.menuBody}>
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
                  }}
                  onPress={() => setIsEditingName(true)}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 16,
                      fontWeight: "bold",
                    }}
                  >
                    Altere seu nome
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Botão de Fechar Menu */}
            <TouchableOpacity
              style={menuStyles.closeButton}
              onPress={() => setIsMenuOpen(false)}
            >
              <Text style={menuStyles.closeButtonText}>Fechar Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL PARA ALTERAR O NOME ================= */}
      <Modal
        visible={isEditingName}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEditingName(false)}
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
                onPress={() => setIsEditingName(false)}
              >
                <Text style={menuStyles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={menuStyles.modalButtonSave}
                onPress={handleUpdateName}
              >
                <Text style={menuStyles.modalButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= ALERTA CUSTOMIZADO ================= */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}
