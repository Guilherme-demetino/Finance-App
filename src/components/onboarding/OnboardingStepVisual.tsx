import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Image, View } from "react-native";

import { useTheme } from "../../theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

interface OnboardingStepVisualProps {
  /** No passo de foto mostra o avatar (ou um ícone de placeholder); nos demais, o ícone do passo. */
  isPhotoStep: boolean;
  icon: IconName;
  avatarUri: string | null;
}

/** Círculo no topo de cada passo do onboarding: avatar no passo de foto, ícone temático nos demais. */
export function OnboardingStepVisual({ isPhotoStep, icon, avatarUri }: OnboardingStepVisualProps) {
  const { colors } = useTheme();

  if (isPhotoStep) {
    return (
      <View
        style={{
          width: 112,
          height: 112,
          borderRadius: 56,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 2,
          borderColor: avatarUri ? colors.accent : colors.borderSubtle,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <Ionicons name="person" size={48} color={colors.textMuted} />
        )}
      </View>
    );
  }

  return (
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: `${colors.income}1A`,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
      }}
    >
      <Ionicons name={icon} size={30} color={colors.income} />
    </View>
  );
}
