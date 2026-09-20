import * as Notifications from "expo-notifications";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { BudgetAlertsRunner } from "../components/dashboard/BudgetAlertsRunner";
import { useBudgetActions, useBudgetData } from "../context/BudgetContext";
import { DashboardProviders } from "../context/DashboardProviders";
import { useTransactionActions, useTransactionForm } from "../context/TransactionFormContext";
import { useTransactionsData } from "../context/TransactionsContext";
import { getMeta } from "../database/appMeta";
import { resetDatabase } from "../database/sqlite";
import { useDataTransfer } from "../hooks/useDataTransfer";
import { BUDGET_ALERT_META, enableBudgetAlerts } from "../services/budgetAlerts";
import { realBudgetAlertDeps } from "../services/budgetAlertsDeps";
import { createSqlJsDatabase } from "../test/sqliteFake";

/**
 * Integração dos alertas de orçamento: o painel de verdade, o banco de verdade (SQLite em
 * memória), o serviço e o adaptador do expo-notifications de verdade. Só o módulo nativo de
 * notificações (o mock global em __mocks__) e o SQLite nativo são trocados.
 */
const mockState: { db: unknown } = { db: null };
const notify = Notifications.scheduleNotificationAsync as unknown as jest.Mock;

jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.setTimeout(30_000);

type Seen = {
  form: ReturnType<typeof useTransactionForm>;
  actions: ReturnType<typeof useTransactionActions>;
  transactions: ReturnType<typeof useTransactionsData>;
  budget: ReturnType<typeof useBudgetData>;
  budgetActions: ReturnType<typeof useBudgetActions>;
  transfer: ReturnType<typeof useDataTransfer>;
};

const seen = {} as Seen;
function Probe() {
  Object.assign(seen, {
    form: useTransactionForm(),
    actions: useTransactionActions(),
    transactions: useTransactionsData(),
    budget: useBudgetData(),
    budgetActions: useBudgetActions(),
    transfer: useDataTransfer(),
  });
  return null;
}

const mounted: ReactTestRenderer[] = [];
const sleep = (ms: number) => act(async () => void (await new Promise((resolve) => setTimeout(resolve, ms))));
const settle = () => sleep(30);
/** O executor espera 1,5 s para as mudanças assentarem antes de conferir os limites. */
const waitForCheck = () => sleep(1800);

async function mountApp() {
  await act(async () => {
    mounted.push(
      create(
        <DashboardProviders>
          <BudgetAlertsRunner />
          <Probe />
        </DashboardProviders>,
      ),
    );
  });
  await settle();
}

async function spend(title: string, amount: string, category = "Alimentação") {
  await act(async () => {
    seen.actions.openNewTransactionModal();
  });
  await act(async () => {
    seen.form.setTransactionTitle(title);
    seen.form.setTransactionAmount(amount);
    seen.form.setTransactionType("expense");
    seen.form.setTransactionCategory(category);
  });
  await act(async () => {
    await seen.form.handleSaveTransaction();
  });
  await settle();
  await waitForCheck();
}

const setGoal = async (category: string, amount: number) => {
  await act(async () => {
    await seen.budget.saveCategoryGoal(category, amount);
  });
  await settle();
};

/** Títulos das notificações mostradas até agora, na ordem. */
const shown = () => notify.mock.calls.map(([request]) => request.content.title as string);

beforeAll(async () => {
  mockState.db = await createSqlJsDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  notify.mockClear();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.restoreAllMocks();
});

describe("alertas de orçamento (painel + banco + serviço)", () => {
  it("desligados por padrão: gastar além da meta não avisa", async () => {
    await mountApp();
    await setGoal("Alimentação", 1000);

    await spend("Mercado", "1.500,00");

    expect(notify).not.toHaveBeenCalled();
  });

  it("chegar perto, estourar e continuar gastando: dois avisos, no canal certo, sem repetir", async () => {
    await mountApp();
    await setGoal("Alimentação", 1000);
    await enableBudgetAlerts(realBudgetAlertDeps);

    await spend("Feira", "300,00");
    expect(notify).not.toHaveBeenCalled();

    await spend("Mercado", "550,00"); // 850 de 1000: 85%
    expect(shown()).toEqual(["Alimentação: perto do limite"]);
    expect(notify).toHaveBeenLastCalledWith({
      identifier: "budget-alert-category:alimentação-1",
      content: { title: "Alimentação: perto do limite", body: "Você já usou 85% da meta do mês (R$ 850,00 de R$ 1.000,00)." },
      trigger: { channelId: "budget-alerts" },
    });

    await spend("Restaurante", "270,00"); // 1120: estourou
    expect(shown()).toEqual(["Alimentação: perto do limite", "Alimentação: meta estourada"]);
    expect(notify.mock.calls[1][0].content.body).toBe("Você passou R$ 120,00 da meta do mês (R$ 1.120,00 de R$ 1.000,00).");

    await spend("Padaria", "40,00"); // continua estourado: sem novo aviso
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("o que já estava perto do limite quando ligou não vira aviso; só o que vem depois", async () => {
    await mountApp();
    await setGoal("Alimentação", 1000);
    await spend("Mercado", "950,00");

    await enableBudgetAlerts(realBudgetAlertDeps);
    await waitForCheck();
    expect(notify).not.toHaveBeenCalled();

    await spend("Padaria", "100,00"); // 1050: cruzou o estouro
    expect(shown()).toEqual(["Alimentação: meta estourada"]);
  });

  it("o orçamento do mês avisa junto com a categoria, numa notificação só", async () => {
    await mountApp();
    await setGoal("Alimentação", 1000);
    await act(async () => {
      await seen.budget.updateBudget(1000);
    });
    await enableBudgetAlerts(realBudgetAlertDeps);

    await spend("Mercado", "900,00");

    expect(shown()).toEqual(["2 alertas de orçamento"]);
    expect(notify.mock.calls[0][0].content.body).toBe("• Orçamento do mês: 90% usado\n• Alimentação: 90% usado");
  });

  it("apagar o gasto e cruzar de novo avisa de novo", async () => {
    await mountApp();
    await setGoal("Alimentação", 1000);
    await enableBudgetAlerts(realBudgetAlertDeps);
    await spend("Mercado", "900,00");
    expect(notify).toHaveBeenCalledTimes(1);

    const id = seen.transactions.formattedTransactions[0].id;
    await act(async () => {
      await seen.transactions.handleDeleteTransaction(id);
    });
    await settle();
    await waitForCheck();

    await spend("Outro mercado", "850,00");
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("categorias sem meta e gastos de outras categorias não disparam nada", async () => {
    await mountApp();
    await setGoal("Alimentação", 1000);
    await enableBudgetAlerts(realBudgetAlertDeps);

    await spend("Cinema", "5.000,00", "Lazer");

    expect(notify).not.toHaveBeenCalled();
  });

  it("zerar os dados esquece o que foi avisado", async () => {
    await mountApp();
    await setGoal("Alimentação", 1000);
    await enableBudgetAlerts(realBudgetAlertDeps);
    await spend("Mercado", "900,00");
    expect(await getMeta(BUDGET_ALERT_META.state)).not.toBe("");

    await act(async () => {
      await seen.transfer.confirmWipeData();
    });

    expect(await getMeta(BUDGET_ALERT_META.state)).toBe("");
  });
});
