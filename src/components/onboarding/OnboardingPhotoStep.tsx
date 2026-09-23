import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";

import { Text, useTheme } from "../../theme";

interface OnboardingPhotoStepProps {
  avatarUri: string | null;
  addLabel: string;
  onPickImage: () => void;
  onRemoveImage: () => void;
}

/** Corpo do passo "Foto de perfil" do onboarding: remover a foto escolhida e escolher/trocar. */
export function OnboardingPhotoStep({ avatarUri, addLabel, onPickImage, onRemoveImage }: OnboardingPhotoStepProps) {
  const { colors } = useTheme();
  return (
    <>
      {avatarUri ? (
        <TouchableOpacity onPress={onRemoveImage} style={{ alignItems: "center", marginBottom: 14 }} hitSlop={8}>
          <Text style={{ color: colors.expense, fontSize: 13, fontWeight: "600" }}>Remover foto</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={onPickImage}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 16,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          borderStyle: "dashed",
          borderRadius: 12,
        }}
      >
        <Ionicons name="image-outline" size={20} color={colors.textPrimary} />
        <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 14 }}>
          {avatarUri ? "Escolher outra foto" : addLabel}
        </Text>
      </TouchableOpacity>
    </>
  );
}
