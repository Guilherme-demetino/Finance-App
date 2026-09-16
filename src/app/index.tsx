import { useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { CustomAlert } from "../components/CustomAlert";
import { styles } from "../styles/indexStyles";

export default function WelcomeScreen() {
  const [name, setName] = useState("");
  const router = useRouter();

  // Estados para o CustomAlert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  // Isso roda automaticamente quando a tela abre
  useEffect(() => {
    checkIfUserExists();
  }, []);

  // Verifica se já tem usuário salvo para pular esta tela
  const checkIfUserExists = async () => {
    try {
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");

      // Garante a criação da tabela caso venha de um app limpo
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        );
      `);

      const user: any = await db.getFirstAsync("SELECT * FROM users LIMIT 1");

      if (user) {
        // Se o usuário já existe, pula essa tela e vai pra tela de Segurança!
        router.replace("/security");
      }
    } catch (error) {
      console.log("Erro ao verificar usuário:", error);
    }
  };

  const handleSaveName = async () => {
    if (name.trim() === "") {
      showAlert("Ops!", "Por favor, digite como gostaria de ser chamado.");
      return;
    }

    try {
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        );
      `);

      await db.runAsync("INSERT INTO users (name) VALUES (?)", name);

      showAlert("Sucesso!", `Bem-vindo(a), ${name}!`);

      // Agora ele vai para a tela de Segurança depois de salvar!
      router.replace("/security");
    } catch (error) {
      console.error("Erro ao salvar o nome:", error);
      showAlert("Erro", "Ocorreu um problema ao salvar seu nome.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bem-vindo ao seu dashboard financeiro</Text>
      <Text style={styles.subtitle}>Como devemos te chamar?</Text>

      <TextInput
        style={styles.input}
        placeholder="Digite seu nome"
        placeholderTextColor="#888888"
        value={name}
        onChangeText={setName}
        autoCorrect={false}
      />

      <TouchableOpacity style={styles.button} onPress={handleSaveName}>
        <Text style={styles.buttonText}>Começar</Text>
      </TouchableOpacity>

      {/* ================= ALERTA CUSTOMIZADO ================= */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}
