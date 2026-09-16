import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { CustomAlert } from "../components/CustomAlert";
import { styles } from "../styles/securityStyles";

export default function SecurityScreen() {
  const [pin, setPin] = useState("");
  const [isSetupMode, setIsSetupMode] = useState(true);
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
      showAlert("Atenção", "O PIN deve ter exatamente 4 dígitos.");
      return;
    }

    if (isSetupMode) {
      // Cria e salva o novo PIN
      await SecureStore.setItemAsync("user_pin", pin);
      showAlert("Sucesso", "PIN cadastrado com segurança!");
      router.replace("/dashboard");
    } else {
      // Valida o PIN existente
      const savedPin = await SecureStore.getItemAsync("user_pin");
      if (pin === savedPin) {
        router.replace("/dashboard");
      } else {
        showAlert("Erro", "PIN incorreto. Tente novamente.");
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
