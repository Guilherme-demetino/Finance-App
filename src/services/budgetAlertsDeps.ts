import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getMeta, setMeta } from "../database/appMeta";
import { getBudget } from "../database/budgets";
import { getCategoryBudgets } from "../database/categoryBudgets";
import { getTransactionsByMonth } from "../database/transactions";
import type { BudgetAlertDeps, BudgetAlertNotifier } from "./budgetAlerts";

const CHANNEL_ID = "budget-alerts";

/** O sistema de notificações do aparelho (expo-notifications): avisos locais na hora, sem servidor. */
const notifier: BudgetAlertNotifier = {
  async prepare() {
    // Com o app aberto o aviso também aparece (o padrão do sistema seria engolir em silêncio).
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Alertas de orçamento",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
  },
  async getPermission() {
    const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    return { granted, canAskAgain };
  },
  async requestPermission() {
    const { granted, canAskAgain } = await Notifications.requestPermissionsAsync();
    return { granted, canAskAgain };
  },
  async notify({ id, title, body }) {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body },
      // Só o canal, sem data: a notificação sai na hora.
      trigger: { channelId: CHANNEL_ID },
    });
  },
};

/** As dependências de verdade: o banco do app e as notificações do aparelho. */
export const realBudgetAlertDeps: BudgetAlertDeps = {
  getMeta,
  setMeta,
  async readMonth(month, year) {
    const [transactions, goals, budget] = await Promise.all([
      getTransactionsByMonth(month, year),
      getCategoryBudgets(month, year),
      getBudget(month, year),
    ]);
    return {
      // Transferência entre contas não é gasto de verdade: fora do alerta de orçamento.
      expenses: transactions.filter((row) => row.type === "expense" && !row.transfer_group_id),
      goals,
      budget,
    };
  },
  notifier,
  now: () => new Date(),
};
