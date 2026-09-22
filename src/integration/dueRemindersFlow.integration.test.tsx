import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { DueRemindersRunner } from "../components/dashboard/DueRemindersRunner";
import { DashboardProviders } from "../context/DashboardProviders";
import { useDebtsContext } from "../context/DebtsContext";
import { useTransactionActions, useTransactionForm } from "../context/TransactionFormContext";
import { useTransactionsData } from "../context/TransactionsContext";
import { resetDatabase } from "../database/sqlite";
import { useDataTransfer } from "../hooks/useDataTransfer";
import { REMINDER_META } from "../services/dueReminders";
import { createSqlJsDatabase } from "../test/sqliteFake";
import type { createFakeScheduler } from "../test/fakeReminderScheduler";

/**
 * Integração dos lembretes de vencimento: o painel de verdade, o banco de verdade
 * (SQLite em memória) e o serviço de verdade. Só o sistema de notificações do
 * aparelho é trocado por um faz-de-conta que guarda o que foi agendado.
 */
const mockState: { db: unknown } = { db: null };
const mockReplace = jest.fn();

jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("expo-print", () => ({ printAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: async () => false, shareAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: class {}, Paths: { cache: "cache" } }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(),
  OrientationLock: { LANDSCAPE: 1, PORTRAIT_UP: 2 },
}));
jest.mock("react-native-reanimated", () => ({
  useSharedValue: (initial: number) => {
    const { useRef } = jest.requireActual<typeof import("react")>("react");
    return useRef({ value: initial, get: () => initial, set: () => {} }).current;
  },
}));
// O banco e o serviço são os de verdade; só o agendador de notificações é o faz-de-conta.
jest.mock("../services/dueRemindersDeps", () => {
  const { getMeta, setMeta } = jest.requireActual("../database/appMeta");
  const { getAllDebts } = jest.requireActual("../database/debts");
  const { getRecurringExpenses } = jest.requireActual("../database/transactions");
  const { createFakeScheduler: create } = jest.requireActual("../test/fakeReminderScheduler");
  const fake = create();
  return {
    fake,
    realDueReminderDeps: {
      getMeta,
      setMeta,
      readDebts: getAllDebts,
      readRecurringExpenses: getRecurringExpenses,
      scheduler: fake.scheduler,
      now: () => new Date(),
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.setTimeout(20_000);

const fake = (jest.requireMock("../services/dueRemindersDeps") as { fake: ReturnType<typeof createFakeScheduler> }).fake;

type Seen = {
  debts: ReturnType<typeof useDebtsContext>;
  transactions: ReturnType<typeof useTransactionsData>;
  form: ReturnType<typeof useTransactionForm>;
  actions: ReturnType<typeof useTransactionActions>;
  transfer: ReturnType<typeof useDataTransfer>;
};

const seen = {} as Seen;
function Probe() {
  // Object.assign: o React Compiler não aceita atribuir a uma variável de fora dentro de um componente.
  Object.assign(seen, {
    debts: useDebtsContext(),
    transactions: useTransactionsData(),
    form: useTransactionForm(),
    actions: useTransactionActions(),
    transfer: useDataTransfer(),
  });
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const idFor = (date: string) => {
  const [d, m, y] = date.split("/");
  return `due-reminder-${y}${m}${d}`;
};

const mounted: ReactTestRenderer[] = [];
const sleep = (ms: number) => act(async () => void (await new Promise((resolve) => setTimeout(resolve, ms))));
/** Deixa os hooks lerem o banco. */
const settle = () => sleep(30);
/** O Runner espera 1,5 s para as mudanças assentarem antes de sincronizar. */
const waitForSync = () => sleep(1800);

async function mountApp() {
  await act(async () => {
    mounted.push(
      create(
        <DashboardProviders>
          <DueRemindersRunner />
          <Probe />
        </DashboardProviders>,
      ),
    );
  });
  await settle();
}

const turnOn = async () => {
  const { setMeta } = jest.requireActual<typeof import("../database/appMeta")>("../database/appMeta");
  await setMeta(REMINDER_META.enabled, "1");
};

const newDebt = (over: { person?: string; type?: "lent" | "borrowed"; dueDate: string | null }) => ({
  person: over.person ?? "Maria",
  amount: 100,
  type: over.type ?? ("borrowed" as const),
  description: null,
  date: inDays(0),
  dueDate: over.dueDate,
});

beforeAll(async () => {
  mockState.db = await createSqlJsDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  fake.state.scheduled.clear();
  fake.state.permission = { granted: true, canAskAgain: true };
  mockReplace.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
  jest.restoreAllMocks();
});

describe("lembretes de vencimento (painel + banco + serviço)", () => {
  it("desligados por padrão: nada é agendado mesmo com dívida a vencer", async () => {
    await mountApp();

    await act(async () => {
      await seen.debts.handleAddDebt(newDebt({ dueDate: inDays(3) }));
    });
    await waitForSync();

    expect(fake.state.scheduled.size).toBe(0);
  });

  it("cadastrar uma dívida com vencimento agenda o aviso; quitar cancela", async () => {
    await turnOn();
    await mountApp();
    const due = inDays(3);

    await act(async () => {
      await seen.debts.handleAddDebt(newDebt({ dueDate: due }));
    });
    await waitForSync();

    const reminder = fake.state.scheduled.get(idFor(due));
    expect(reminder?.title).toBe("Pagar Maria vence amanhã");
    expect(reminder?.body).toContain("R$ 100,00");
    expect(fake.state.scheduled.size).toBe(1);

    await act(async () => {
      await seen.debts.handleSettleDebt(seen.debts.pendingDebts[0], "Conta principal");
    });
    await waitForSync();

    expect(fake.state.scheduled.size).toBe(0);
  });

  it("dívida sem vencimento não gera aviso", async () => {
    await turnOn();
    await mountApp();

    await act(async () => {
      await seen.debts.handleAddDebt(newDebt({ dueDate: null }));
    });
    await waitForSync();

    expect(fake.state.scheduled.size).toBe(0);
  });

  it("compra parcelada agenda as próximas parcelas; apagar a série cancela", async () => {
    await turnOn();
    await mountApp();

    await act(async () => {
      seen.actions.openNewTransactionModal();
    });
    await act(async () => {
      seen.form.setTransactionTitle("Notebook");
      seen.form.setTransactionAmount("300");
      seen.form.setTransactionType("expense");
      seen.form.setTransactionCategory("outros");
      seen.form.setInstallmentCount(3);
    });
    await act(async () => {
      await seen.form.handleSaveTransaction();
    });
    await settle();
    await waitForSync();

    const bodies = [...fake.state.scheduled.values()].map((r) => `${r.title} | ${r.body}`).join("\n");
    expect(bodies).toContain("Notebook (2/3) vence");
    expect(bodies).not.toContain("parcela");

    const groupId = seen.transactions.formattedTransactions.find((t) => t.recurrenceGroupId)?.recurrenceGroupId;
    expect(groupId).toBeTruthy();
    await act(async () => {
      await seen.transactions.handleDeleteSeries(groupId as string);
    });
    await waitForSync();

    expect(fake.state.scheduled.size).toBe(0);
  });

  it("zerar os dados cancela os avisos que estavam agendados", async () => {
    await turnOn();
    await mountApp();
    await act(async () => {
      await seen.debts.handleAddDebt(newDebt({ dueDate: inDays(3) }));
    });
    await waitForSync();
    expect(fake.state.scheduled.size).toBe(1);

    await act(async () => {
      await seen.transfer.confirmWipeData();
    });
    await settle();

    expect(fake.state.scheduled.size).toBe(0);
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
