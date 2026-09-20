import type { ReminderPermission, ReminderScheduler } from "../services/dueReminders";

export interface ScheduledReminder {
  id: string;
  title: string;
  body: string;
  date: Date;
}

/** Sistema de notificações de mentira: guarda em memória o que foi agendado. */
export function createFakeScheduler(initial: { granted?: boolean; canAskAgain?: boolean; willGrant?: boolean } = {}) {
  const state = {
    permission: { granted: initial.granted ?? true, canAskAgain: initial.canAskAgain ?? true } as ReminderPermission,
    /** O que o usuário responde ao pedido de permissão. */
    willGrant: initial.willGrant ?? true,
    prepared: 0,
    requested: 0,
    scheduled: new Map<string, ScheduledReminder>(),
  };

  const scheduler: ReminderScheduler = {
    async prepare() {
      state.prepared += 1;
    },
    async getPermission() {
      return { ...state.permission };
    },
    async requestPermission() {
      state.requested += 1;
      if (state.willGrant) state.permission = { granted: true, canAskAgain: true };
      else state.permission = { granted: false, canAskAgain: state.requested < 2 };
      return { ...state.permission };
    },
    async listScheduledIds() {
      return [...state.scheduled.keys()];
    },
    async cancel(id) {
      state.scheduled.delete(id);
    },
    async schedule(reminder) {
      state.scheduled.set(reminder.id, reminder);
    },
  };

  return { scheduler, state };
}
