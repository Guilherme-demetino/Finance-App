// Os testes não têm o módulo nativo de notificações: este faz-de-conta é usado no lugar do pacote.
// Testes que precisam de outro comportamento usam os serviços com um agendador de mentira.
export const AndroidImportance = { HIGH: 6 };
export const SchedulableTriggerInputTypes = { DATE: "date" };

export const setNotificationHandler = jest.fn();
export const setNotificationChannelAsync = jest.fn(async () => null);
export const getPermissionsAsync = jest.fn(async () => ({ granted: true, canAskAgain: true, status: "granted" }));
export const requestPermissionsAsync = jest.fn(async () => ({ granted: true, canAskAgain: true, status: "granted" }));
export const getAllScheduledNotificationsAsync = jest.fn(async () => []);
export const cancelScheduledNotificationAsync = jest.fn(async () => undefined);
export const scheduleNotificationAsync = jest.fn(async () => "id");
