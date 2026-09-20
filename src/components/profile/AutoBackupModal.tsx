import { ActivityIndicator, Modal, TouchableOpacity, View } from "react-native";

import type { AutoBackupSettings } from "../../services/autoBackup";
import { describeLastBackup, KEEP_BACKUPS } from "../../utils/backup/autoBackup";
import { Text, makeStyles, useTheme } from "../../theme";

interface AutoBackupModalProps {
  visible: boolean;
  settings: AutoBackupSettings | null;
  isBusy: boolean;
  onClose: () => void;
  onChooseFolder: () => void;
  onBackupNow: () => void;
  onDisable: () => void;
}

/** Liga, desliga e confere o backup automático numa pasta (por exemplo, do Google Drive). */
export function AutoBackupModal({
  visible,
  settings,
  isBusy,
  onClose,
  onChooseFolder,
  onBackupNow,
  onDisable,
}: AutoBackupModalProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const hasFolder = settings?.folderUri != null;
  const lastBackup = describeLastBackup(settings?.lastAt ?? null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Backup automático</Text>
          <Text style={styles.description}>
            O app salva um backup completo na pasta que você escolher (pode ser uma pasta do Google Drive),
            no máximo uma vez por dia, quando você abre o app. Ficam os {KEEP_BACKUPS} mais recentes.
          </Text>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Situação</Text>
            <Text style={[styles.statusValue, { color: hasFolder ? colors.income : colors.textMuted }]}>
              {hasFolder ? "Ligado" : "Desligado"}
            </Text>
            {hasFolder && (
              <>
                <Text style={styles.statusLabel}>Pasta</Text>
                <Text style={styles.statusValue}>{settings?.folderName ?? "Pasta escolhida"}</Text>
                <Text style={styles.statusLabel}>Último backup</Text>
                <Text style={styles.statusValue}>{lastBackup}</Text>
              </>
            )}
            {settings?.lastError ? (
              <Text style={styles.errorText}>{settings.lastError}</Text>
            ) : null}
          </View>

          {isBusy && <ActivityIndicator color={colors.income} style={{ marginBottom: 12 }} />}

          <TouchableOpacity style={styles.primaryButton} onPress={onChooseFolder} disabled={isBusy}>
            <Text style={styles.primaryButtonText}>{hasFolder ? "Trocar pasta" : "Escolher pasta"}</Text>
          </TouchableOpacity>

          {hasFolder && (
            <>
              <TouchableOpacity style={styles.secondaryButton} onPress={onBackupNow} disabled={isBusy}>
                <Text style={styles.secondaryButtonText}>Fazer backup agora</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={onDisable} disabled={isBusy}>
                <Text style={[styles.secondaryButtonText, { color: colors.expense }]}>Desligar</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  statusBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  statusLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  statusValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    color: colors.expense,
    fontSize: 13,
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: {
    color: colors.textOnColor,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  closeButton: {
    paddingVertical: 10,
    alignItems: "center",
  },
  closeButtonText: {
    color: colors.textMuted,
    fontSize: 15,
  },
}));
