import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";

import { Text, useTheme } from "../../theme";
import { OnboardingEntryRow, type EntryRowProps } from "./OnboardingEntryRow";

interface OnboardingEntryStepProps {
  entries: (EntryRowProps & { id: string })[];
  addLabel: string;
  onAdd: () => void;
}

/** Corpo dos passos de lista do onboarding (receitas/despesas fixas, parcelas, dívidas): itens + botão de adicionar. */
export function OnboardingEntryStep({ entries, addLabel, onAdd }: OnboardingEntryStepProps) {
  const { colors } = useTheme();
  return (
    <>
      {entries.map(({ id, ...row }) => (
        <OnboardingEntryRow key={id} {...row} />
      ))}

      <TouchableOpacity
        onPress={onAdd}
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
        <Ionicons name="add-circle-outline" size={20} color={colors.textPrimary} />
        <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 14 }}>{addLabel}</Text>
      </TouchableOpacity>
    </>
  );
}
