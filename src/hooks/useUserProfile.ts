import { useEffect, useState } from "react";
import { getUser, updateUserAvatar, updateUserName } from "../database/users";

export function useUserProfile() {
  const [userName, setUserName] = useState("Carregando...");
  const [userImage, setUserImage] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const user = await getUser();
      setUserName(user?.name || "Meu Finanças");
      if (user?.avatar) setUserImage(user.avatar);
    } catch (error) {
      console.log("Erro ao buscar usuário:", error);
      setUserName("Meu Finanças");
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const updateName = async (newName: string) => {
    await updateUserName(newName);
    setUserName(newName);
  };

  const updateAvatar = async (uri: string) => {
    setUserImage(uri);
    await updateUserAvatar(uri, userName);
  };

  return { userName, userImage, updateName, updateAvatar, refresh };
}
