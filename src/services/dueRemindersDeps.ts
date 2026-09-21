import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getMeta, setMeta } from "../database/appMeta";
import { getAllCardPayments, getAllCardPurchases, getAllCreditCards } from "../database/creditCards";
import { getAllDebts } from "../database/debts";
import { getRecurringExpenses } from "../database/transactions";
import { unpaidInvoiceDues } from "../utils/creditCards";
import type { DueReminderDeps, ReminderPermission, ReminderScheduler } from "./dueReminders";

const CHANNEL_ID = "due-reminders";

function toPermission(response: { granted: boolean; canAskAgain: boolean }): ReminderPermission {
  return { granted: response.granted, canAskAgain: response.canAskAgain };
}

/** O sistema de notificações do aparelho (expo-notifications). Só lembretes locais: sem servidor, sem push remoto. */
const scheduler: ReminderScheduler = {
  async prepare() {
    // Com o app aberto, o aviso também aparece (o padrão do sistema seria engolir em silêncio).
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
        name: "Contas a vencer",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
  },
  async getPermission() {
    return toPermission(await Notifications.getPermissionsAsync());
  },
  async requestPermission() {
    return toPermission(await Notifications.requestPermissionsAsync());
  },
  async listScheduledIds() {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.map((item) => item.identifier);
  },
  async cancel(id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
  async schedule({ id, title, body, date }) {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: CHANNEL_ID,
      },
    });
  },
};

/** As dependências de verdade: o banco do app e as notificações do aparelho. */
export const realDueReminderDeps: DueReminderDeps = {
  getMeta,
  setMeta,
  readDebts: getAllDebts,
  readRecurringExpenses: getRecurringExpenses,
  async readInvoices() {
    const [cards, purchases, payments] = await Promise.all([getAllCreditCards(), getAllCardPurchases(), getAllCardPayments()]);
    return unpaidInvoiceDues({ cards, purchases, payments, today: new Date() });
  },
  scheduler,
  now: () => new Date(),
};
