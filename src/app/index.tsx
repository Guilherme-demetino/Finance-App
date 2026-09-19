import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { CustomAlert } from "../components/CustomAlert";
import { colors } from "../constants/colors";
import { getLegacyPin } from "../database/security";
import { getUser, upsertUserName } from "../database/users";
import { styles } from "../styles/indexStyles";
import { hasPinConfigured } from "../utils/security";
import { logError } from "../utils/logger";

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

  const checkIfUserExists = async () => {
    try {
      // Verifica se já existe um PIN salvo (SecureStore, ou um PIN
      // legado ainda não migrado no SQLite). Se sim, vai direto pedir a senha!
      const hasPin = await hasPinConfigured();
      const legacyPin = await getLegacyPin();
      if (hasPin || legacyPin) {
        router.replace("/security");
        return;
      }

      // Se não tem PIN, verifica se já tem nome salvo (liberamos o nome Guilherme agora!)
      const user = await getUser();
      if (
        user &&
        user.name &&
        user.name.trim() !== "" &&
        user.name !== "Meu Finanças"
      ) {
        router.replace("/security");
      }
    } catch (error) {
      logError("Erro ao verificar usuário/PIN:", error);
    }
  };

  useEffect(() => {
    checkIfUserExists();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda só na montagem
  }, []);

  const handleSaveName = async () => {
    if (name.trim() === "") {
      showAlert("Ops!", "Por favor, digite como gostaria de ser chamado.");
      return;
    }

    try {
      await upsertUserName(name.trim());
      showAlert("Sucesso!", `Bem-vindo(a), ${name}!`);
      router.replace("/security");
    } catch (error) {
      logError("Erro ao salvar o nome:", error);
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
        placeholderTextColor={colors.textMuted}
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
