import { useState } from "react";
import { ActivityIndicator, Modal, ScrollView, Switch, TouchableOpacity, View } from "react-native";

import type { ProtectionStatus } from "../../services/backupProtection";
import { MIN_PASSWORD_LENGTH } from "../../utils/backup/encryption";
import { Text, useTheme } from "../../theme";
import { PasswordField } from "./PasswordField";
import { useBackupProtectionStyles } from "./backupProtectionStyles";

interface BackupProtectionModalProps {
  visible: boolean;
  status: ProtectionStatus | null;
  isBusy: boolean;
  error: string | null;
  onClose: () => void;
  /** Liga a proteção ou troca a senha; true = deu certo. */
  onEnable: (password: string, confirmation: string) => Promise<boolean>;
  onDisable: () => Promise<boolean>;
}

/** Liga, troca a senha e desliga a proteção dos backups. A senha nunca é guardada: só a chave dela. */
export function BackupProtectionModal({
  visible,
  status,
  isBusy,
  error,
  onClose,
  onEnable,
  onDisable,
}: BackupProtectionModalProps) {
  const { colors } = useTheme();
  const styles = useBackupProtectionStyles();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changing, setChanging] = useState(false);
  const [confirmingDisable, setConfirmingDisable] = useState(false);

  const reset = () => {
    setPassword("");
    setConfirmation("");
    setShowPassword(false);
    setChanging(false);
    setConfirmingDisable(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (await onEnable(password, confirmation)) reset();
  };

  const disable = async () => {
    if (await onDisable()) reset();
  };

  const showForm = status === "off" || status === "broken" || (status === "on" && changing);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title} accessibilityRole="header">
              Proteger backups com senha
            </Text>

            {status === null && <ActivityIndicator color={colors.accent} style={styles.spaced} />}

            {status === "on" && !changing && (
              <View style={[styles.box, styles.boxOn]}>
                <Text style={styles.boxTitle}>Proteção ligada</Text>
                <Text style={styles.text}>
                  O backup completo e o automático saem criptografados. O backup automático continua sem pedir a
                  senha. Para restaurar, o app pede a senha (a não ser neste aparelho, que já tem a chave).
                </Text>
              </View>
            )}

            {status === "broken" && (
              <View style={[styles.box, styles.boxError]}>
                <Text style={styles.boxTitle}>A proteção está com problema</Text>
                <Text style={styles.text}>
                  Por segurança, nenhum backup é gravado sem senha enquanto a proteção estiver assim. Ative de novo com
                  uma senha ou desative.
                </Text>
              </View>
            )}

            {status === "off" && (
              <Text style={styles.text}>
                Ligue para que o backup completo e o backup automático saiam criptografados: só quem tem a senha
                consegue abrir os arquivos, mesmo que outra pessoa acesse a pasta do Drive.
              </Text>
            )}

            {showForm && (
              <>
                <View style={[styles.box, styles.boxWarning]}>
                  <Text style={styles.boxTitle}>Guarde a senha fora do celular</Text>
                  <Text style={styles.text}>
                    Se você esquecer a senha, NÃO existe como recuperar os backups protegidos. Nem o app consegue abrir.
                    {changing
                      ? " Ao trocar a senha, os backups já feitos continuam com a senha antiga: guarde as duas."
                      : ""}
                  </Text>
                </View>

                <PasswordField
                  label={`Senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`}
                  value={password}
                  onChangeText={setPassword}
                  visible={showPassword}
                  editable={!isBusy}
                />
                <PasswordField
                  label="Repita a senha"
                  value={confirmation}
                  onChangeText={setConfirmation}
                  visible={showPassword}
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
                <Text style={styles.hint}>
                  Gerar a chave leva alguns segundos e a tela pode ficar parada nesse tempo. Uma frase longa é melhor
                  que uma senha curta e complicada.
                </Text>

                {error && (
                  <Text style={styles.errorText} accessibilityRole="alert">
                    {error}
                  </Text>
                )}

                {isBusy ? (
                  <View style={styles.busy}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.text}>Gerando a chave…</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.primaryButton} onPress={submit} accessibilityRole="button">
                    <Text style={styles.primaryText}>{changing ? "Salvar nova senha" : "Ativar proteção"}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {status === "on" && !changing && !confirmingDisable && (
              <>
                {error && (
                  <Text style={styles.errorText} accessibilityRole="alert">
                    {error}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setChanging(true)}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryText}>Trocar senha</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setConfirmingDisable(true)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.secondaryText, { color: colors.expense }]}>Desativar proteção</Text>
                </TouchableOpacity>
              </>
            )}

            {(status === "on" || status === "broken") && confirmingDisable && (
              <View style={[styles.box, styles.boxError]}>
                <Text style={styles.boxTitle}>Desativar a proteção?</Text>
                <Text style={styles.text}>
                  Os próximos backups saem sem senha. Os já feitos continuam protegidos e precisam da senha para abrir.
                </Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={disable} disabled={isBusy} accessibilityRole="button">
                  <Text style={[styles.secondaryText, { color: colors.expense }]}>Sim, desativar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setConfirmingDisable(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryText}>Voltar</Text>
                </TouchableOpacity>
              </View>
            )}

            {status === "broken" && !confirmingDisable && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setConfirmingDisable(true)}
                accessibilityRole="button"
              >
                <Text style={[styles.secondaryText, { color: colors.expense }]}>Desativar proteção</Text>
              </TouchableOpacity>
            )}

            {changing && !isBusy && (
              <TouchableOpacity style={styles.secondaryButton} onPress={reset} accessibilityRole="button">
                <Text style={styles.secondaryText}>Cancelar troca</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={close} disabled={isBusy} accessibilityRole="button">
              <Text style={styles.closeText}>Fechar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
