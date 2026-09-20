import type { BudgetAlertDeps } from "../services/budgetAlerts";
import type { BudgetNotification } from "../utils/budgetAlerts";

export interface FakeMonth {
  expenses: { category_id: string; amount: number }[];
  goals: { category: string; amount: number }[];
  budget: number | null;
}

/** Banco, notificações e relógio de mentira para os alertas de orçamento. */
export function createFakeBudgetDeps(
  initial: { month?: Partial<FakeMonth>; granted?: boolean; willGrant?: boolean; now?: Date } = {},
) {
  const meta = new Map<string, string>();
  const state = {
    month: { expenses: [], goals: [], budget: null, ...initial.month } as FakeMonth,
    granted: initial.granted ?? true,
    canAskAgain: true,
    willGrant: initial.willGrant ?? true,
    requested: 0,
    prepared: 0,
    notified: [] as BudgetNotification[],
    notifyError: null as Error | null,
    reads: [] as [string, string][],
    now: initial.now ?? new Date(2026, 8, 20, 12, 0),
  };

  const deps: BudgetAlertDeps = {
    getMeta: async (key) => meta.get(key) ?? null,
    setMeta: async (key, value) => void meta.set(key, value),
    async readMonth(month, year) {
      state.reads.push([month, year]);
      return state.month;
    },
    notifier: {
      async prepare() {
        state.prepared += 1;
      },
      async getPermission() {
        return { granted: state.granted, canAskAgain: state.canAskAgain };
      },
      async requestPermission() {
        state.requested += 1;
        if (state.willGrant) state.granted = true;
        else state.canAskAgain = state.requested < 2;
        return { granted: state.granted, canAskAgain: state.canAskAgain };
      },
      async notify(notification) {
        if (state.notifyError) throw state.notifyError;
        state.notified.push(notification);
      },
    },
    now: () => state.now,
  };

  return { deps, meta, state };
}

/** Atalho: gasto numa categoria com meta, para os testes lerem melhor. */
export function monthWith(spent: Record<string, number>, goals: Record<string, number>, budget: number | null = null): FakeMonth {
  return {
    expenses: Object.entries(spent).map(([category_id, amount]) => ({ category_id, amount })),
    goals: Object.entries(goals).map(([category, amount]) => ({ category, amount })),
    budget,
  };
}
