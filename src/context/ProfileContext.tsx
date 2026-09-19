import * as ImagePicker from "expo-image-picker";
import { createContext, type ReactNode } from "react";

import { useUserProfile } from "../hooks/useUserProfile";
import { logError } from "../utils/logger";
import { useAlert } from "./AlertContext";
import { useRequiredContext } from "./useRequiredContext";

interface ProfileContextValue {
  userName: string;
  userImage: string | null;
  pickImage: () => Promise<void>;
  /** Devolve se salvou. `onSaved` roda antes do aviso de sucesso, para a tela poder fechar os modais primeiro. */
  handleUpdateName: (newName: string, onSaved: () => void) => Promise<boolean>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { showAlert } = useAlert();
  const { userName, userImage, updateName, updateAvatar } = useUserProfile();

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      showAlert(
        "Permissão negada",
        "Precisamos de acesso à galeria para alterar sua foto.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      try {
        await updateAvatar(result.assets[0].uri);
        showAlert("Sucesso", "Foto de perfil atualizada com sucesso!");
      } catch (error) {
        logError("Erro ao salvar foto no banco:", error);
        showAlert("Erro", "Não foi possível salvar a imagem.");
      }
    }
  };

  const handleUpdateName = async (newName: string, onSaved: () => void) => {
    if (newName.trim() === "") {
      showAlert("Atenção", "O nome não pode ficar vazio.");
      return false;
    }

    try {
      await updateName(newName);
      onSaved();
      showAlert("Sucesso", "Nome alterado com sucesso!");
      return true;
    } catch (error) {
      logError("Erro ao atualizar nome:", error);
      showAlert("Erro", "Não foi possível atualizar o nome.");
      return false;
    }
  };

  const value: ProfileContextValue = {
    userName,
    userImage,
    pickImage,
    handleUpdateName,
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  return useRequiredContext(ProfileContext, "useProfile", "ProfileProvider");
}
