import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import {
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function SecurityScreen() {
  const [pin, setPin] = useState("");
  const [isSetupMode, setIsSetupMode] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkExistingPin();
  }, []);

  // Verifica se o usuário já tem um PIN salvo
  const checkExistingPin = async () => {
    const savedPin = await SecureStore.getItemAsync("user_pin");
    if (savedPin) {
      setIsSetupMode(false); // Já tem PIN, então é modo "Login"
      handleBiometricAuth(); // Tenta a biometria direto!
    }
  };

  // Função para chamar a Impressão Digital ou FaceID
  const handleBiometricAuth = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (hasHardware && isEnrolled) {
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: "Acesse seu Financeiro",
        fallbackLabel: "Usar PIN",
      });

      if (auth.success) {
        router.replace("/dashboard");
      }
    }
  };

  // Lida com o botão de confirmar o PIN digitado
  const handlePinSubmit = async () => {
    if (pin.length !== 4) {
      Alert.alert("Atenção", "O PIN deve ter exatamente 4 dígitos.");
      return;
    }

    if (isSetupMode) {
      // Cria e salva o novo PIN
      await SecureStore.setItemAsync("user_pin", pin);
      Alert.alert("Sucesso", "PIN cadastrado com segurança!");
      router.replace("/dashboard");
    } else {
      // Valida o PIN existente
      const savedPin = await SecureStore.getItemAsync("user_pin");
      if (pin === savedPin) {
        router.replace("/dashboard");
      } else {
        Alert.alert("Erro", "PIN incorreto. Tente novamente.");
        setPin(""); // Limpa o campo
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {isSetupMode ? "Crie seu PIN de Segurança" : "Digite seu PIN"}
      </Text>
      <Text style={styles.subtitle}>
        {isSetupMode
          ? "Digite 4 números para proteger seus dados."
          : "Use sua biometria ou digite o PIN."}
      </Text>

      <TextInput
        style={styles.input}
        keyboardType="numeric"
        secureTextEntry={true} // Esconde os números (bolinhas)
        maxLength={4}
        value={pin}
        onChangeText={setPin}
        autoFocus={true}
        placeholder="••••"
        placeholderTextColor="#555"
      />

      <TouchableOpacity style={styles.button} onPress={handlePinSubmit}>
        <Text style={styles.buttonText}>
          {isSetupMode ? "Salvar PIN" : "Entrar"}
        </Text>
      </TouchableOpacity>

      {!isSetupMode && (
        <TouchableOpacity
          style={styles.biometricButton}
          onPress={handleBiometricAuth}
        >
          <Text style={styles.biometricText}>Usar Biometria</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    padding: 24,
    alignItems: "center", // Centraliza os itens
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#A1A1AA",
    marginBottom: 40,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 12,
    padding: 20,
    fontSize: 32,
    letterSpacing: 8,
    color: "#FFFFFF",
    textAlign: "center",
    width: "60%", // Caixa de texto mais curta, focada no centro
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#3B82F6",
    padding: 16,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  biometricButton: {
    padding: 16,
  },
  biometricText: {
    color: "#3B82F6",
    fontSize: 16,
    fontWeight: "600",
  },
});
