import { View } from "react-native";

import { Text, TextInput, useTheme } from "../../theme";
import { useBackupProtectionStyles } from "./backupProtectionStyles";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  autoFocus?: boolean;
  editable?: boolean;
}

/** Campo de senha usado pelos modais de proteção de backup (ligar/trocar e restaurar). */
export function PasswordField({ label, value, onChangeText, visible, autoFocus, editable = true }: PasswordFieldProps) {
  const { colors } = useTheme();
  const styles = useBackupProtectionStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        editable={editable}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
      />
    </View>
  );
}
