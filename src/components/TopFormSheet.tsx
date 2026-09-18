import { Ionicons } from "@expo/vector-icons";
import { useEffect, type ReactNode } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { colors } from "../constants/colors";

interface TopFormSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Formulário em cartão ancorado no topo da tela — mesmo padrão do modal de
 * nova transação do dashboard. Como fica em cima (e não colado embaixo), o
 * teclado não cobre os campos. Não é um Modal nativo: é uma camada absoluta
 * dentro da própria tela, então o Android redimensiona junto com o teclado.
 */
export function TopFormSheet({
  visible,
  onClose,
  title,
  children,
}: TopFormSheetProps) {
  // O botão voltar do Android fecha o formulário em vez de sair da tela.
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "flex-start",
        paddingTop: 60,
        zIndex: 999,
        elevation: 999,
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ maxHeight: "85%" }}
      >
        <Animated.ScrollView
          entering={FadeInDown.duration(250).springify().damping(18)}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            marginHorizontal: 16,
            padding: 24,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <Text
              style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "bold" }}
            >
              {title}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {children}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
