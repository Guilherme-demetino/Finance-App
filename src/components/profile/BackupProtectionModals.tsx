import { useState } from "react";
import { ActivityIndicator, Modal, ScrollView, Switch, TouchableOpacity, View } from "react-native";

import type { ProtectionStatus } from "../../services/backupProtection";
import { MIN_PASSWORD_LENGTH } from "../../utils/backup/encryption";
import { Text, TextInput, makeStyles, useTheme } from "../../theme";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  autoFocus?: boolean;
  editable?: boolean;
}

function PasswordField({ label, value, onChangeText, visible, autoFocus, editable = true }: PasswordFieldProps) {
  const { colors } = useTheme();
  const styles = useStyles();
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

// ------------------------------------------------------- proteger os backups

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
  const styles = useStyles();
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

// ------------------------------------------------- senha para restaurar

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
  const styles = useStyles();
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

const useStyles = makeStyles(({ colors }) => ({
  // Perto do topo: o teclado abre na hora (autoFocus) e não pode cobrir os campos nem os botões.
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxHeight: "92%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: 8 },
  text: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  spaced: { marginTop: 16 },
  box: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boxOn: { borderColor: colors.income },
  boxWarning: { borderColor: colors.categoryAmber },
  boxError: { borderColor: colors.expense },
  boxTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  field: { marginTop: 14 },
  fieldLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  switchLabel: { flex: 1, paddingRight: 12 },
  errorText: { color: colors.expense, fontSize: 14, fontWeight: "600", lineHeight: 20, marginTop: 12 },
  busy: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, marginTop: 8 },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  primaryText: { color: colors.textOnColor, fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  secondaryText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  closeButton: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  closeText: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.4 },
}));
