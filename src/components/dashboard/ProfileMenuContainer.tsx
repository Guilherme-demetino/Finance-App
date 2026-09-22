import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useProfile } from "../../context/ProfileContext";
import { useAutoBackup } from "../../hooks/useAutoBackup";
import { useBackupProtection } from "../../hooks/useBackupProtection";
import { useDataTransfer } from "../../hooks/useDataTransfer";
import { describeRestore } from "../../utils/backup/backup";
import { describeImportPlan } from "../../utils/statements/importSummary";
import { AutoBackupModal } from "../profile/AutoBackupModal";
import { BackupProtectionModal, RestorePasswordModal } from "../profile/BackupProtectionModals";
import { ConfirmModal } from "../ConfirmModal";
import { EditNameModal, ProfileMenuModal } from "../profile/ProfileMenuModals";
import { Text, useTheme } from "../../theme";

interface ProfileMenuContainerProps {
  isMenuOpen: boolean;
  onCloseMenu: () => void;
}

/**
 * Menu do perfil e tudo que ele dispara: editar nome, exportar, importar,
 * trocar PIN e zerar o app. O estado dos modais de nome, importação e
 * confirmação é só daqui.
 */
export function ProfileMenuContainer({
  isMenuOpen,
  onCloseMenu,
}: ProfileMenuContainerProps) {
  const { colors } = useTheme();
  const { userName, userImage, pickImage, handleUpdateName } = useProfile();
  const {
    handleExportPDF,
    handleExportCSV,
    handleImportFile,
    handleExportBackup,
    handleRestoreBackup,
    pendingRestore,
    setPendingRestore,
    confirmRestore,
    pendingPassword,
    passwordError,
    isUnlocking,
    submitRestorePassword,
    cancelRestorePassword,
    pendingImport,
    setPendingImport,
    isReadingImport,
    confirmImport,
    handleChangePIN,
    isWipeConfirmOpen,
    setIsWipeConfirmOpen,
    confirmWipeData,
  } = useDataTransfer();
  const router = useRouter();
  const autoBackup = useAutoBackup();
  const protection = useBackupProtection();
  const [isAutoBackupOpen, setIsAutoBackupOpen] = useState(false);
  const [isProtectionOpen, setIsProtectionOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <>
      <ProfileMenuModal
        visible={isMenuOpen}
        onClose={onCloseMenu}
        userName={userName}
        userImage={userImage}
        onPickImage={pickImage}
        onOpenEditName={() => setIsEditingName(true)}
        onExportPDF={handleExportPDF}
        onExportCSV={handleExportCSV}
        onImportFile={() => {
          onCloseMenu();
          handleImportFile();
        }}
        onExportBackup={() => {
          onCloseMenu();
          handleExportBackup();
        }}
        onRestoreBackup={() => {
          onCloseMenu();
          handleRestoreBackup();
        }}
        onOpenAutoBackup={() => {
          onCloseMenu();
          // Reler: restaurar um backup pode ter passado a proteger com a senha dele.
          protection.refresh();
          setIsAutoBackupOpen(true);
        }}
        onOpenBackupProtection={() => {
          onCloseMenu();
          protection.clearError();
          protection.refresh();
          setIsProtectionOpen(true);
        }}
        onOpenUpdates={() => {
          onCloseMenu();
          router.push("/updates");
        }}
        onOpenAppearance={() => {
          onCloseMenu();
          router.push("/appearance");
        }}
        onOpenReminders={() => {
          onCloseMenu();
          router.push("/reminders");
        }}
        onChangePIN={() => {
          onCloseMenu();
          handleChangePIN();
        }}
        onOpenTrash={() => {
          onCloseMenu();
          router.push("/trash");
        }}
        onWipeData={() => {
          onCloseMenu();
          setIsWipeConfirmOpen(true);
        }}
      />

      <EditNameModal
        visible={isEditingName}
        onClose={() => setIsEditingName(false)}
        newName={newName}
        setNewName={setNewName}
        onSave={() =>
          handleUpdateName(newName, () => {
            setNewName("");
            setIsEditingName(false);
            onCloseMenu();
          })
        }
      />

      <AutoBackupModal
        visible={isAutoBackupOpen}
        settings={autoBackup.settings}
        isBusy={autoBackup.isBusy}
        protection={protection.status}
        onClose={() => setIsAutoBackupOpen(false)}
        onChooseFolder={autoBackup.chooseFolder}
        onBackupNow={autoBackup.backupNow}
        onDisable={autoBackup.disable}
      />

      <BackupProtectionModal
        visible={isProtectionOpen}
        status={protection.status}
        isBusy={protection.isBusy}
        error={protection.error}
        onClose={() => setIsProtectionOpen(false)}
        onEnable={protection.enable}
        onDisable={protection.disable}
      />

      <RestorePasswordModal
        visible={pendingPassword !== null}
        isBusy={isUnlocking}
        error={passwordError}
        onSubmit={submitRestorePassword}
        onCancel={cancelRestorePassword}
      />

      <ConfirmModal
        visible={pendingImport !== null}
        title="Importar transações"
        message={pendingImport ? describeImportPlan(pendingImport) : ""}
        confirmLabel="Importar"
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmImport}
      />

      <ConfirmModal
        visible={pendingRestore !== null}
        title="Restaurar backup"
        message={
          pendingRestore
            ? describeRestore(pendingRestore.current, pendingRestore.backup)
            : ""
        }
        confirmLabel="Substituir tudo"
        destructive
        onCancel={() => setPendingRestore(null)}
        onConfirm={confirmRestore}
      />

      {isReadingImport && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            elevation: 1000,
          }}
        >
          <ActivityIndicator size="large" color={colors.textPrimary} />
          <Text style={{ color: colors.textPrimary, marginTop: 12, fontSize: 14 }}>
            Lendo o arquivo...
          </Text>
        </View>
      )}

      <ConfirmModal
        visible={isWipeConfirmOpen}
        title="Zerar Aplicativo"
        message="ATENÇÃO: Isso apagará todas as suas transações, categorias, nome, foto e PIN. Essa ação NÃO pode ser desfeita. Tem certeza?"
        confirmLabel="Sim, apagar tudo"
        destructive
        onCancel={() => setIsWipeConfirmOpen(false)}
        onConfirm={confirmWipeData}
      />
    </>
  );
}
