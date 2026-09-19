import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { colors } from "../../constants/colors";
import { useProfile } from "../../context/ProfileContext";
import { useDataTransfer } from "../../hooks/useDataTransfer";
import { describeImportPlan } from "../../utils/importSummary";
import { ConfirmModal } from "../ConfirmModal";
import { EditNameModal, ProfileMenuModal } from "../ProfileMenuModals";

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
  const { userName, userImage, pickImage, handleUpdateName } = useProfile();
  const {
    handleExportPDF,
    handleExportCSV,
    handleImportFile,
    pendingImport,
    setPendingImport,
    isReadingImport,
    confirmImport,
    handleChangePIN,
    isWipeConfirmOpen,
    setIsWipeConfirmOpen,
    confirmWipeData,
  } = useDataTransfer();
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
        onChangePIN={() => {
          onCloseMenu();
          handleChangePIN();
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

      <ConfirmModal
        visible={pendingImport !== null}
        title="Importar transações"
        message={pendingImport ? describeImportPlan(pendingImport) : ""}
        confirmLabel="Importar"
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmImport}
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
