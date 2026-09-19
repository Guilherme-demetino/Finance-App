import { useEffect } from "react";

import { useAlert } from "../../context/AlertContext";
import { checkBackupReminder, runAutoBackup } from "../../services/autoBackup";
import { realAutoBackupDeps } from "../../services/autoBackupDeps";
import { logError } from "../../utils/logger";

/**
 * Roda quando o painel abre: faz o backup automático do dia (se estiver ligado
 * e for a hora) ou, se não estiver ligado, lembra de vez em quando que os dados
 * só existem neste aparelho. Não desenha nada.
 */
export function AutoBackupRunner() {
  const { showAlert } = useAlert();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await runAutoBackup(realAutoBackupDeps, { force: false });
      if (cancelled) return;

      if (result.status === "failed") {
        showAlert(
          "Backup automático não funcionou",
          `${result.error} Abra o menu do perfil > Backup Automático.`,
        );
      } else if (result.status === "disabled") {
        if (await checkBackupReminder(realAutoBackupDeps)) {
          if (cancelled) return;
          showAlert(
            "Faça backup dos seus dados",
            'Seus dados ficam só neste aparelho: se ele for perdido, trocado ou zerado, o histórico some. Abra o menu do perfil e ative o "Backup Automático" (pode ser uma pasta do Google Drive) ou faça um "Backup Completo".',
          );
        }
      }
    })().catch((error) => logError("Erro no backup automático ao abrir o app:", error));

    return () => {
      cancelled = true;
    };
  }, [showAlert]);

  return null;
}
