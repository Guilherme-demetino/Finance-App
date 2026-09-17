import { useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { CustomAlert } from "../components/CustomAlert";
import { styles } from "../styles/indexStyles";

export default function WelcomeScreen() {
  const [name, setName] = useState("");
  const router = useRouter();

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  useEffect(() => {
    checkIfUserExists();
  }, []);

  const checkIfUserExists = () => {
    try {
      const db = SQLite.openDatabaseSync("meufinanceiro.db");

      // 1. Garante que as tabelas existem
      db.runSync(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          avatar TEXT
        );
      `);

      db.runSync(`
        CREATE TABLE IF NOT EXISTS security (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pin TEXT NOT NULL
        );
      `);

      // 2. Verifica se já existe um PIN salvo. Se sim, vai direto pedir a senha!
      const security: any = db.getFirstSync("SELECT pin FROM security LIMIT 1");
      if (security && security.pin) {
        router.replace("/security");
        return;
      }

      // 3. Se não tem PIN, verifica se já tem nome salvo (liberamos o nome Guilherme agora!)
      const user: any = db.getFirstSync("SELECT * FROM users LIMIT 1");
      if (
        user &&
        user.name &&
        user.name.trim() !== "" &&
        user.name !== "Meu Finanças"
      ) {
        router.replace("/security");
      }
    } catch (error) {
      console.log("Erro ao verificar usuário/PIN:", error);
    }
  };

  const handleSaveName = () => {
    if (name.trim() === "") {
      showAlert("Ops!", "Por favor, digite como gostaria de ser chamado.");
      return;
    }

    try {
      const db = SQLite.openDatabaseSync("meufinanceiro.db");

      // Comandos de criação de tabela (DDL) SEMPRE FORA da transação no Android
      db.runSync(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          avatar TEXT
        );
      `);

      db.withTransactionSync(() => {
        const existing: any = db.getFirstSync("SELECT id FROM users LIMIT 1");
        if (existing) {
          db.runSync(
            "UPDATE users SET name = ? WHERE id = ?",
            name.trim(),
            existing.id,
          );
        } else {
          db.runSync("INSERT INTO users (name) VALUES (?)", name.trim());
        }
      });

      showAlert("Sucesso!", `Bem-vindo(a), ${name}!`);
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

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}
