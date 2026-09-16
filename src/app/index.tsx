import { useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { useState } from "react";
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

  const handleSaveName = async () => {
    if (name.trim() === "") {
      Alert.alert("Ops!", "Por favor, digite como gostaria de ser chamado.");
      return;
    }

    try {
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");
      await db.runAsync("INSERT INTO users (name) VALUES (?)", name);

      Alert.alert("Sucesso!", `Bem-vindo(a), ${name}!`);

      // router.replace('/dashboard');
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
        placeholderTextColor="#888888" // Cor do texto de dica adaptada para o escuro
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
    backgroundColor: "#121212", // Fundo principal escuro
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF", // Título branco
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#A1A1AA", // Subtítulo em cinza claro
    marginBottom: 32,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#1E1E1E", // Fundo da caixa de texto levemente mais claro que o fundo
    borderWidth: 1,
    borderColor: "#333333", // Borda cinza escura
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF", // Cor do texto que o usuário vai digitar
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#3B82F6", // Azul um pouco mais vibrante para destacar no escuro
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
