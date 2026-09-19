import { Directory } from "expo-file-system";
import { useEffect, useState } from "react";

import { useAlert } from "../context/AlertContext";
import {
  disableAutoBackup,
  getAutoBackupSettings,
  runAutoBackup,
  saveBackupFolder,
  type AutoBackupResult,
  type AutoBackupSettings,
} from "../services/autoBackup";
import { realAutoBackupDeps } from "../services/autoBackupDeps";
import { logError } from "../utils/logger";

/** O seletor de pastas do Android avisa que o usuário desistiu lançando este erro. */
function isPickerCancelled(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  return code === "ERR_PICKER_CANCELLED" || /cancel/i.test(String(message ?? ""));
}

/** Configuração do backup automático para a tela: pasta escolhida, último backup e as ações. */
export function useAutoBackup() {
  const { showAlert } = useAlert();
  const [settings, setSettings] = useState<AutoBackupSettings | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAutoBackupSettings(realAutoBackupDeps)
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch((error) => logError("Erro ao ler o backup automático:", error));
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = async () => {
    setSettings(await getAutoBackupSettings(realAutoBackupDeps));
  };

  const tell = (result: AutoBackupResult) => {
    if (result.status === "done") {
      showAlert("Backup automático", "Backup salvo na pasta escolhida.");
    } else if (result.status === "empty") {
      showAlert("Backup automático", "Ainda não há dados no app para salvar.");
    } else if (result.status === "failed") {
      showAlert("Backup automático", result.error);
    }
  };

  /** Escolhe a pasta e já grava um backup, para descobrir na hora se a pasta aceita gravação. */
  const chooseFolder = async () => {
    let directory: Directory;
    try {
      directory = await Directory.pickDirectoryAsync();
    } catch (error) {
      if (isPickerCancelled(error)) return;
      logError("Erro ao escolher a pasta de backup:", error);
      showAlert("Erro", "Não foi possível abrir o seletor de pastas.");
      return;
    }

    setIsBusy(true);
    try {
      await saveBackupFolder(realAutoBackupDeps, directory.uri, directory.name || "Pasta escolhida");
      tell(await runAutoBackup(realAutoBackupDeps, { force: true }));
      await reload();
    } catch (error) {
      logError("Erro ao configurar o backup automático:", error);
      showAlert("Erro", "Não foi possível configurar o backup automático.");
    } finally {
      setIsBusy(false);
    }
  };

  const backupNow = async () => {
    setIsBusy(true);
    try {
      tell(await runAutoBackup(realAutoBackupDeps, { force: true }));
      await reload();
    } catch (error) {
      logError("Erro ao fazer o backup agora:", error);
      showAlert("Erro", "Não foi possível fazer o backup.");
    } finally {
      setIsBusy(false);
    }
  };

  const disable = async () => {
    try {
      await disableAutoBackup(realAutoBackupDeps);
      await reload();
    } catch (error) {
      logError("Erro ao desligar o backup automático:", error);
      showAlert("Erro", "Não foi possível desligar o backup automático.");
    }
  };

  return { settings, isBusy, chooseFolder, backupNow, disable };
}
