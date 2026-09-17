import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CustomAlert } from "../components/CustomAlert";
import { getDatabase } from "../database/sqlite";

export default function SecurityScreen() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  useEffect(() => {
    checkPinTable();
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsBiometricSupported(compatible && enrolled);
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Desbloqueie o Meu Finanças",
        fallbackLabel: "Usar PIN",
      });

      if (result.success) {
        router.replace("/dashboard" as any);
      }
    } catch (error) {
      console.log("Erro na biometria:", error);
    }
  };

  const checkPinTable = async () => {
    try {
      const db = await getDatabase();

      const result: any = db.getFirstSync("SELECT pin FROM security LIMIT 1");
      if (result && result.pin) {
        setStoredPin(result.pin);
        setIsSettingUp(false);
        // Opcional: Chama a biometria automaticamente ao abrir a tela
        // handleBiometricAuth();
      } else {
        setIsSettingUp(true);
      }
    } catch (error) {
      console.log("Erro ao verificar PIN:", error);
    }
  };

  const handlePressNumber = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);

      if (newPin.length === 4) {
        processPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const processPin = async (enteredPin: string) => {
    try {
      const db = await getDatabase();

      if (isSettingUp) {
        db.runSync("DELETE FROM security");

        // Interpolação direta do valor para driblar o bug do prepareSync no Android
        db.runSync(`INSERT INTO security (pin) VALUES ('${enteredPin}')`);

        showAlert("Sucesso", "PIN de segurança cadastrado com sucesso!");
        setTimeout(() => {
          router.replace("/dashboard" as any);
        }, 1000);
      } else {
        if (enteredPin === storedPin) {
          router.replace("/dashboard" as any);
        } else {
          showAlert("Atenção", "PIN incorreto. Tente novamente.");
          setPin("");
        }
      }
    } catch (error) {
      console.log("Erro ao processar PIN:", error);
      showAlert("Erro", "Não foi possível validar a segurança.");
      setPin("");
    }
  };
  return (
    <View style={styles.container}>
      <Ionicons
        name="lock-closed-outline"
        size={48}
        color="#10B981"
        style={{ marginBottom: 16 }}
      />
      <Text style={styles.title}>
        {isSettingUp ? "Crie seu PIN de Segurança" : "Digite seu PIN"}
      </Text>
      <Text style={styles.subtitle}>
        {isSettingUp
          ? "Escolha uma senha de 4 dígitos"
          : "Insira sua senha para desbloquear"}
      </Text>

      <View style={styles.pinDotsContainer}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: index < pin.length ? "#10B981" : "#2A2A2A" },
            ]}
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "bio", "0", "back"].map(
          (item, index) => {
            // Lógica do botão de Biometria
            if (item === "bio") {
              if (!isSettingUp && isBiometricSupported) {
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.keyEmpty}
                    onPress={handleBiometricAuth}
                  >
                    <Ionicons name="finger-print" size={36} color="#10B981" />
                  </TouchableOpacity>
                );
              }
              return <View key={index} style={styles.keyEmpty} />;
            }

            // Lógica do botão de Apagar
            if (item === "back") {
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.key}
                  onPress={handleDelete}
                >
                  <Ionicons
                    name="backspace-outline"
                    size={24}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              );
            }

            // Teclas numéricas padrão
            return (
              <TouchableOpacity
                key={index}
                style={styles.key}
                onPress={() => handlePressNumber(item)}
              >
                <Text style={styles.keyText}>{item}</Text>
              </TouchableOpacity>
            );
          },
        )}
      </View>

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: "#888888",
    fontSize: 14,
    marginBottom: 32,
    textAlign: "center",
  },
  pinDotsContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 48,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
  },
  keypad: {
    width: "100%",
    maxWidth: 280,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
  },
  key: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
  },
  keyEmpty: {
    width: 70,
    height: 70,
    justifyContent: "center",
    alignItems: "center",
  },
  keyText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },
});
