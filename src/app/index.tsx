import { useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function WelcomeScreen() {
  const [name, setName] = useState("");
  const router = useRouter();

  // Isso roda automaticamente quando a tela abre
  useEffect(() => {
    checkIfUserExists();
  }, []);

  // Verifica se já tem usuário salvo para pular esta tela
  const checkIfUserExists = async () => {
    try {
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");
      const user = await db.getFirstAsync("SELECT * FROM users LIMIT 1");

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
      Alert.alert("Ops!", "Por favor, digite como gostaria de ser chamado.");
      return;
    }

    try {
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");
      await db.runAsync("INSERT INTO users (name) VALUES (?)", name);

      Alert.alert("Sucesso!", `Bem-vindo(a), ${name}!`);

      // Agora ele vai para a tela de Segurança depois de salvar!
      router.replace("/security");
    } catch (error) {
      console.error("Erro ao salvar o nome:", error);
      Alert.alert("Erro", "Ocorreu um problema ao salvar seu nome.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bem-vindo ao seu Financeiro!</Text>
      <Text style={styles.subtitle}>Para começar, como podemos te chamar?</Text>

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
    </View>
  );
}

// Estilos com o Padrão Dark Mode
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#A1A1AA",
    marginBottom: 32,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#3B82F6",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
