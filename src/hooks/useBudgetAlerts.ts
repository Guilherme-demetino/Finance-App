import { useEffect, useState } from "react";
import { Linking } from "react-native";

import {
  disableBudgetAlerts,
  enableBudgetAlerts,
  getBudgetAlertsEnabled,
  sendTestBudgetAlert,
  type BudgetAlertDeps,
} from "../services/budgetAlerts";
import { realBudgetAlertDeps } from "../services/budgetAlertsDeps";
import { logError } from "../utils/logger";

interface Snapshot {
  enabled: boolean;
  /** As notificações estão liberadas para o app no Android? */
  permitted: boolean;
}

async function readSnapshot(deps: BudgetAlertDeps): Promise<Snapshot> {
  const [enabled, permission] = await Promise.all([getBudgetAlertsEnabled(deps), deps.notifier.getPermission()]);
  return { enabled, permitted: permission.granted };
}

const BLOCKED_NOTICE =
  "As notificações do app estão bloqueadas no Android. Abra as configurações e permita para receber os alertas.";
const DENIED_NOTICE = "Sem a permissão de notificação o app não consegue avisar. Tente de novo e toque em Permitir.";

/** Alertas de orçamento para a tela: ligado ou não, permissão e as ações. */
export function useBudgetAlerts(deps: BudgetAlertDeps = realBudgetAlertDeps) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    readSnapshot(deps)
      .then((loaded) => {
        if (!cancelled) setSnapshot(loaded);
      })
      .catch((error) => {
        logError("Erro ao ler os alertas de orçamento:", error);
        if (!cancelled) setNotice("Não foi possível ler os alertas de orçamento.");
      });
    return () => {
      cancelled = true;
    };
  }, [deps]);

  /** Roda uma ação, avisa se falhar e sempre relê o estado no fim. */
  const perform = async (action: () => Promise<void>, failure: string) => {
    setIsBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      logError(failure, error);
      setNotice(failure);
    }
    try {
      setSnapshot(await readSnapshot(deps));
    } catch (error) {
      logError("Erro ao reler os alertas de orçamento:", error);
    }
    setIsBusy(false);
  };

  const setEnabled = (enabled: boolean) =>
    perform(
      async () => {
        if (!enabled) {
          await disableBudgetAlerts(deps);
          return;
        }
        const result = await enableBudgetAlerts(deps);
        if (result.status === "denied") setNotice(result.canAskAgain ? DENIED_NOTICE : BLOCKED_NOTICE);
      },
      enabled ? "Não foi possível ligar os alertas." : "Não foi possível desligar os alertas.",
    );

  const sendTest = () =>
    perform(async () => {
      const result = await sendTestBudgetAlert(deps);
      setNotice(
        result.status === "sent"
          ? "Alerta de teste enviado. Se não aparecer, confira as notificações do app nas configurações do Android."
          : result.canAskAgain
            ? DENIED_NOTICE
            : BLOCKED_NOTICE,
      );
    }, "Não foi possível enviar o alerta de teste.");

  const openSystemSettings = () => {
    Linking.openSettings().catch((error) => logError("Erro ao abrir as configurações do Android:", error));
  };

  return { snapshot, isBusy, notice, setEnabled, sendTest, openSystemSettings };
}
