import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CustomAlert } from "../components/CustomAlert";
import { colors } from "../constants/colors";
import { clearLegacyPin, getLegacyPin } from "../database/security";
import { getStoredPin, savePin } from "../utils/security";

export default function SecurityScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isChangeFlow = mode === "change";
  const [pin, setPin] = useState("");
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  // Só é possível estar em isSettingUp com um PIN já existente através do
  // fluxo de troca (o cadastro inicial nunca chega em isSettingUp tendo
  // um PIN salvo). Usar isso pro botão de voltar em vez do parâmetro de
  // rota evita depender de o "mode=change" sobreviver à navegação.
  const [hadExistingPin, setHadExistingPin] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

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

  const checkPin = async () => {
    try {
      const existingPin = await getStoredPin();

      if (isChangeFlow) {
        // Troca de PIN: o usuário já está autenticado, sempre pede um novo.
        setHadExistingPin(!!existingPin);
        setIsSettingUp(true);
        return;
      }

      if (existingPin) {
        setStoredPin(existingPin);
        setIsSettingUp(false);
        return;
      }

      // Migração: PIN antigo pode existir em texto puro no SQLite
      // (versão anterior, antes do expo-secure-store). Move para o
      // SecureStore e limpa o registro legado.
      const legacyPin = await getLegacyPin();
      if (legacyPin) {
        await savePin(legacyPin);
        await clearLegacyPin();
        setStoredPin(legacyPin);
        setIsSettingUp(false);
      } else {
        setIsSettingUp(true);
      }
    } catch (error) {
      console.log("Erro ao verificar PIN:", error);
      setIsSettingUp(true);
    }
  };

  useEffect(() => {
    checkPin();
    checkBiometrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda só na montagem
  }, []);

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
      if (isSettingUp) {
        await savePin(enteredPin);

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
      {isSettingUp && hadExistingPin && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/dashboard" as any)}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      )}
      <Ionicons
        name="lock-closed-outline"
        size={48}
        color={colors.income}
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
              { backgroundColor: index < pin.length ? colors.income : colors.surfaceAlt },
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
                    <Ionicons name="finger-print" size={36} color={colors.income} />
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
                    color={colors.textPrimary}
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
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
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
    borderColor: colors.borderSubtle,
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
    backgroundColor: colors.surface,
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
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "bold",
  },
});
