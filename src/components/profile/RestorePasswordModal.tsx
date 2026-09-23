import { useState } from "react";
import { ActivityIndicator, Modal, ScrollView, Switch, TouchableOpacity, View } from "react-native";

import { Text, useTheme } from "../../theme";
import { PasswordField } from "./PasswordField";
import { useBackupProtectionStyles } from "./backupProtectionStyles";

interface RestorePasswordModalProps {
  visible: boolean;
  isBusy: boolean;
  error: string | null;
  onSubmit: (password: string, keepProtection: boolean) => void;
  onCancel: () => void;
}

/** Pede a senha de um backup protegido. Depois de restaurar, pode continuar protegendo com ela. */
export function RestorePasswordModal({ visible, isBusy, error, onSubmit, onCancel }: RestorePasswordModalProps) {
  const { colors } = useTheme();
  const styles = useBackupProtectionStyles();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepProtection, setKeepProtection] = useState(true);

  const cancel = () => {
    setPassword("");
    setShowPassword(false);
    setKeepProtection(true);
    onCancel();
  };

  const submit = () => {
    if (password === "") return;
    onSubmit(password, keepProtection);
    setPassword("");
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title} accessibilityRole="header">
              Backup protegido
            </Text>
            <Text style={styles.text}>Digite a senha usada para proteger este backup.</Text>

            <PasswordField
              label="Senha do backup"
              value={password}
              onChangeText={setPassword}
              visible={showPassword}
              autoFocus
              editable={!isBusy}
            />
            <View style={styles.switchRow}>
              <Text style={styles.text}>Mostrar a senha</Text>
              <Switch
                value={showPassword}
                onValueChange={setShowPassword}
                trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
                thumbColor={colors.textPrimary}
                accessibilityLabel="Mostrar a senha"
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.text, styles.switchLabel]}>Continuar protegendo meus backups com esta senha</Text>
              <Switch
                value={keepProtection}
                onValueChange={setKeepProtection}
                trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
                thumbColor={colors.textPrimary}
                accessibilityLabel="Continuar protegendo meus backups com esta senha"
              />
            </View>
            <Text style={styles.hint}>Abrir o backup leva alguns segundos e a tela pode ficar parada nesse tempo.</Text>

            {error && (
              <Text style={styles.errorText} accessibilityRole="alert">
                {error}
              </Text>
            )}

            {isBusy ? (
              <View style={styles.busy}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.text}>Abrindo o backup…</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, password === "" && styles.disabled]}
                onPress={submit}
                disabled={password === ""}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>Abrir backup</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={cancel} disabled={isBusy} accessibilityRole="button">
              <Text style={styles.closeText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
