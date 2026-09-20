import { useEffect, useState } from "react";
import { Linking } from "react-native";

import {
  disableDueReminders,
  enableDueReminders,
  getReminderPermission,
  getReminderSettings,
  previewDueReminders,
  sendTestReminder,
  updateReminderTiming,
  type DueReminderDeps,
  type ReminderPermission,
} from "../services/dueReminders";
import { realDueReminderDeps } from "../services/dueRemindersDeps";
import type { PlannedReminder, ReminderSettings } from "../utils/dueReminders";
import { logError } from "../utils/logger";

interface Snapshot {
  settings: ReminderSettings;
  permission: ReminderPermission;
  upcoming: PlannedReminder[];
}

async function readSnapshot(deps: DueReminderDeps): Promise<Snapshot> {
  const [settings, permission, upcoming] = await Promise.all([
    getReminderSettings(deps),
    getReminderPermission(deps),
    previewDueReminders(deps),
  ]);
  return { settings, permission, upcoming };
}

const BLOCKED_NOTICE =
  "As notificações do app estão bloqueadas no Android. Abra as configurações e permita para receber os lembretes.";
const DENIED_NOTICE = "Sem a permissão de notificação o app não consegue avisar. Tente de novo e toque em Permitir.";

/** Configuração dos lembretes de vencimento para a tela: preferências, permissão, próximos avisos e as ações. */
export function useDueReminders(deps: DueReminderDeps = realDueReminderDeps) {
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
        logError("Erro ao ler os lembretes de vencimento:", error);
        if (!cancelled) setNotice("Não foi possível ler os lembretes.");
      });
    return () => {
      cancelled = true;
    };
  }, [deps]);

  /** Roda uma ação, avisa se falhar e sempre relê o estado no fim. */
  const perform = async (action: () => Promise<void>, failure: string) => {
    setIsBusy(true);
    try {
      await action();
    } catch (error) {
      logError(failure, error);
      setNotice(failure);
    }
    try {
      setSnapshot(await readSnapshot(deps));
    } catch (error) {
      logError("Erro ao reler os lembretes de vencimento:", error);
    }
    setIsBusy(false);
  };

  const setEnabled = (enabled: boolean) =>
    perform(async () => {
      setNotice(null);
      if (!enabled) {
        await disableDueReminders(deps);
        return;
      }
      const result = await enableDueReminders(deps);
      if (result.status === "denied") setNotice(result.canAskAgain ? DENIED_NOTICE : BLOCKED_NOTICE);
    }, enabled ? "Não foi possível ligar os lembretes." : "Não foi possível desligar os lembretes.");

  const setDaysBefore = (daysBefore: number) =>
    perform(async () => {
      setNotice(null);
      await updateReminderTiming(deps, { daysBefore });
    }, "Não foi possível salvar a antecedência.");

  const setHour = (hour: number) =>
    perform(async () => {
      setNotice(null);
      await updateReminderTiming(deps, { hour });
    }, "Não foi possível salvar o horário.");

  const sendTest = () =>
    perform(async () => {
      const result = await sendTestReminder(deps);
      setNotice(
        result.status === "sent"
          ? "Notificação de teste agendada: ela chega em cerca de 5 segundos. Se não aparecer, confira as notificações do app nas configurações do Android."
          : result.canAskAgain
            ? DENIED_NOTICE
            : BLOCKED_NOTICE,
      );
    }, "Não foi possível enviar a notificação de teste.");

  const openSystemSettings = () => {
    Linking.openSettings().catch((error) => logError("Erro ao abrir as configurações do Android:", error));
  };

  return { snapshot, isBusy, notice, setEnabled, setDaysBefore, setHour, sendTest, openSystemSettings };
}
