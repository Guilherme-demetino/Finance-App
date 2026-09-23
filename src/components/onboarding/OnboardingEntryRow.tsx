import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { TouchableOpacity, View } from "react-native";

import { Text, useTheme } from "../../theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface EntryRowProps {
  icon: IconName;
  color: string;
  title: string;
  subtitle: string;
  amountText: string;
  onRemove: () => void;
}

/** Uma linha de item já adicionado num passo do onboarding (receita fixa, parcela, dívida). */
export function OnboardingEntryRow({ icon, color, title, subtitle, amountText, onRemove }: EntryRowProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceAlt,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: `${color}26`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={20} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
      </View>

      <Text style={{ color, fontSize: 14, fontWeight: "bold" }}>{amountText}</Text>

      <TouchableOpacity onPress={onRemove} hitSlop={8}>
        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}
