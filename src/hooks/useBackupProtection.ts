import { useEffect, useState } from "react";

import {
  disableProtection,
  enableProtection,
  getProtectionStatus,
  type BackupProtectionDeps,
  type ProtectionStatus,
} from "../services/backupProtection";
import { realBackupProtectionDeps } from "../services/backupProtectionDeps";
import { logError } from "../utils/logger";
import { yieldToUi } from "../utils/yieldToUi";

/** Estado da proteção dos backups por senha para a tela: ligada, desligada ou com problema, e as ações. */
export function useBackupProtection(deps: BackupProtectionDeps = realBackupProtectionDeps) {
  const [status, setStatus] = useState<ProtectionStatus | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setStatus(await getProtectionStatus(deps));
    } catch (failure) {
      logError("Erro ao ler a proteção dos backups:", failure);
      setStatus("broken");
    }
  };

  useEffect(() => {
    let cancelled = false;
    getProtectionStatus(deps)
      .then((loaded) => {
        if (!cancelled) setStatus(loaded);
      })
      .catch((failure) => {
        logError("Erro ao ler a proteção dos backups:", failure);
        if (!cancelled) setStatus("broken");
      });
    return () => {
      cancelled = true;
    };
  }, [deps]);

  /** Liga a proteção ou troca a senha. Devolve true se deu certo. */
  const enable = async (password: string, confirmation: string): Promise<boolean> => {
    setError(null);
    setIsBusy(true);
    try {
      // Deixa o "Gerando a chave…" aparecer antes de o scrypt segurar o JavaScript.
      await yieldToUi();
      const result = await enableProtection(deps, password, confirmation);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      await refresh();
      return true;
    } catch (failure) {
      logError("Erro ao ligar a proteção dos backups:", failure);
      setError("Não foi possível ligar a proteção. Tente de novo.");
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const disable = async (): Promise<boolean> => {
    setError(null);
    setIsBusy(true);
    try {
      await disableProtection(deps);
      await refresh();
      return true;
    } catch (failure) {
      logError("Erro ao desligar a proteção dos backups:", failure);
      setError("Não foi possível desligar a proteção. Tente de novo.");
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const clearError = () => setError(null);

  return { status, isBusy, error, enable, disable, refresh, clearError };
}
