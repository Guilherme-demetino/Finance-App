import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { realDueReminderDeps } from "./dueRemindersDeps";

// O pacote expo-notifications é trocado por __mocks__/expo-notifications.ts (não há módulo nativo nos testes).
const mocked = Notifications as unknown as Record<string, jest.Mock>;
const scheduler = realDueReminderDeps.scheduler;

beforeEach(() => {
  Object.values(mocked).forEach((fn) => typeof fn?.mockClear === "function" && fn.mockClear());
});

describe("agendador real (expo-notifications)", () => {
  it("agenda uma notificação única na data, no canal de vencimentos e com o identificador do app", async () => {
    const date = new Date(2026, 8, 20, 9, 0);

    await scheduler.schedule({ id: "due-reminder-20260921", title: "Pagar Maria vence amanhã", body: "R$ 100,00", date });

    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: "due-reminder-20260921",
      content: { title: "Pagar Maria vence amanhã", body: "R$ 100,00" },
      trigger: { type: "date", date, channelId: "due-reminders" },
    });
  });

  it("lista pelos identificadores e cancela um a um", async () => {
    mocked.getAllScheduledNotificationsAsync.mockResolvedValueOnce([{ identifier: "a" }, { identifier: "b" }]);

    await expect(scheduler.listScheduledIds()).resolves.toEqual(["a", "b"]);
    await scheduler.cancel("a");

    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith("a");
  });

  it("traduz a resposta de permissão do sistema", async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false, status: "denied" });
    mocked.requestPermissionsAsync.mockResolvedValueOnce({ granted: true, canAskAgain: true, status: "granted" });

    await expect(scheduler.getPermission()).resolves.toEqual({ granted: false, canAskAgain: false });
    await expect(scheduler.requestPermission()).resolves.toEqual({ granted: true, canAskAgain: true });
  });

  it("no Android cria o canal antes de tudo e deixa o aviso aparecer com o app aberto", async () => {
    const restore = jest.replaceProperty(Platform, "OS", "android");

    await scheduler.prepare();
    restore.restore();

    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith("due-reminders", {
      name: "Contas a vencer",
      importance: 6,
    });
    const [{ handleNotification }] = mocked.setNotificationHandler.mock.calls[0];
    await expect(handleNotification()).resolves.toMatchObject({ shouldShowBanner: true, shouldShowList: true });
  });
});
