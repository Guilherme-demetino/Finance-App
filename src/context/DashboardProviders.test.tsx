import React from "react";
import { act, create } from "react-test-renderer";

import { useAlert, useAlertState } from "./AlertContext";
import { useBudgetActions, useBudgetData } from "./BudgetContext";
import { usePanorama, useScrollY } from "./DashboardUiContext";
import { DashboardProviders, useReloadDashboard } from "./DashboardProviders";
import { useDebtsContext } from "./DebtsContext";
import { usePeriod, useToday } from "./PeriodContext";
import { useProfile } from "./ProfileContext";
import { useSavingsContext } from "./SavingsContext";
import {
  useTransactionActions,
  useTransactionForm,
} from "./TransactionFormContext";
import {
  useTransactionsData,
  useTransactionsMutations,
} from "./TransactionsContext";

// Os hooks de dados falam com o SQLite; aqui viram valores fixos. O que se
// testa é a divisão em domínios e os handlers que ficam nos providers.
const mockSaveTransaction = jest.fn();
const mockSettleDebt = jest.fn();
const mockUpdateName = jest.fn();

const mockTransactionsHook = {
  transactions: [],
  isLoading: false,
  totalIncome: 0,
  totalExpense: 0,
  monthsData: [],
  saveTransaction: mockSaveTransaction,
  removeTransaction: jest.fn(),
  removeAllForCurrentPeriod: jest.fn(),
  removeSeries: jest.fn(),
  removeSeriesFromId: jest.fn(),
  refresh: jest.fn(),
};
const mockBudgetHook = { budget: null, updateBudget: jest.fn() };
const mockCategoryBudgetsHook = {
  categoryBudgets: [],
  isLoadingCategoryBudgets: false,
  saveCategoryGoal: jest.fn(),
  removeCategory: jest.fn(),
  refreshCategoryBudgets: jest.fn(),
};
const mockComparisonHook = { comparison: null, isLoadingComparison: false };
const mockDebtsHook = {
  pendingDebts: [],
  settledDebts: [],
  totalToReceive: 0,
  totalToPay: 0,
  isLoadingDebts: false,
  addDebt: jest.fn(),
  settleDebt: mockSettleDebt,
  removeDebt: jest.fn(),
};
const mockSavingsHook = {
  savingsGoals: [],
  isLoadingSavings: false,
  addSavingsGoal: jest.fn(),
  changeSavedAmount: jest.fn(),
  removeSavingsGoal: jest.fn(),
};
const mockProfileHook = {
  userName: "Ana",
  userImage: null,
  updateName: mockUpdateName,
  updateAvatar: jest.fn(),
};

jest.mock("../hooks/useTransactions", () => ({
  useTransactions: () => mockTransactionsHook,
}));
jest.mock("../hooks/useBudget", () => ({ useBudget: () => mockBudgetHook }));
jest.mock("../hooks/useCategoryBudgets", () => ({
  useCategoryBudgets: () => mockCategoryBudgetsHook,
}));
jest.mock("../hooks/useMonthComparison", () => ({
  useMonthComparison: () => mockComparisonHook,
}));
jest.mock("../hooks/useDebts", () => ({ useDebts: () => mockDebtsHook }));
jest.mock("../hooks/useSavingsGoals", () => ({
  useSavingsGoals: () => mockSavingsHook,
}));
jest.mock("../hooks/useUserProfile", () => ({
  useUserProfile: () => mockProfileHook,
}));
jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(),
  OrientationLock: { LANDSCAPE: 1, PORTRAIT_UP: 2 },
}));
jest.mock("react-native-reanimated", () => ({
  useSharedValue: (initial: number) => {
    // Um objeto só por montagem, como no Reanimated (identidade estável).
    const { useRef } = jest.requireActual<typeof import("react")>("react");
    return useRef({ value: initial, get: () => initial, set: () => {} }).current;
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const HOOKS = {
  period: usePeriod,
  today: useToday,
  transactions: useTransactionsData,
  mutations: useTransactionsMutations,
  budget: useBudgetData,
  budgetActions: useBudgetActions,
  debts: useDebtsContext,
  savings: useSavingsContext,
  profile: useProfile,
  alert: useAlert,
  alertState: useAlertState,
  panorama: usePanorama,
  scroll: useScrollY,
  formActions: useTransactionActions,
  form: useTransactionForm,
} as const;

type Name = keyof typeof HOOKS;
type Seen = { [K in Name]: ReturnType<(typeof HOOKS)[K]> };

function setup() {
  const seen = {} as Seen;
  const renders = {} as Record<Name, number>;

  const Probe = ({ name }: { name: Name }) => {
    (seen as Record<string, unknown>)[name] = HOOKS[name]();
    renders[name] = (renders[name] ?? 0) + 1;
    return null;
  };

  act(() => {
    create(
      <DashboardProviders>
        {(Object.keys(HOOKS) as Name[]).map((name) => (
          <Probe key={name} name={name} />
        ))}
      </DashboardProviders>,
    );
  });

  /** Roda a ação e devolve quais consumidores foram re-renderizados por causa dela. */
  const rerendered = (action: () => void): Name[] => {
    const before = { ...renders };
    act(action);
    return (Object.keys(HOOKS) as Name[])
      .filter((name) => renders[name] !== before[name])
      .sort();
  };

  const rerenderedAsync = async (action: () => Promise<void>): Promise<Name[]> => {
    const before = { ...renders };
    await act(action);
    return (Object.keys(HOOKS) as Name[])
      .filter((name) => renders[name] !== before[name])
      .sort();
  };

  return { seen, renders, rerendered, rerenderedAsync };
}

const pad = (n: number) => String(n).padStart(2, "0");
const todayString = () => {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

describe("DashboardProviders: isolamento entre domínios", () => {
  beforeEach(() => jest.clearAllMocks());

  it("abrir o modal de dívidas só re-renderiza quem consome dívidas", () => {
    const { seen, rerendered } = setup();
    expect(rerendered(() => seen.debts.setIsDebtModalOpen(true))).toEqual([
      "debts",
    ]);
  });

  it("abrir o modal de metas só re-renderiza quem consome metas", () => {
    const { seen, rerendered } = setup();
    expect(rerendered(() => seen.savings.setIsSavingsModalOpen(true))).toEqual([
      "savings",
    ]);
  });

  it("mostrar um aviso só re-renderiza quem desenha o aviso", () => {
    const { seen, rerendered } = setup();
    expect(rerendered(() => seen.alert.showAlert("Oi", "Mensagem"))).toEqual([
      "alertState",
    ]);
    expect(seen.alertState.alertVisible).toBe(true);
    expect(seen.alertState.alertMessage).toBe("Mensagem");
  });

  it("digitar no formulário de transação só re-renderiza o formulário", () => {
    const { seen, rerendered } = setup();
    expect(
      rerendered(() => seen.form.setTransactionTitle("Mercado")),
    ).toEqual(["form"]);
  });

  it("abrir o painel em paisagem só re-renderiza o panorama", async () => {
    const { seen, rerenderedAsync } = setup();
    expect(
      await rerenderedAsync(() => seen.panorama.openLandscapePanorama()),
    ).toEqual(["panorama"]);
    expect(seen.panorama.isLandscapePanoramaOpen).toBe(true);
  });

  it("trocar de mês não re-renderiza dívidas, metas, perfil nem avisos", () => {
    const { seen, rerendered } = setup();
    const changed = rerendered(() => seen.period.setSelectedMonth("Janeiro"));

    expect(changed).toEqual([
      "budget",
      "form",
      "formActions",
      "period",
      "transactions",
    ]);
    // ações e datas de hoje continuam com a mesma identidade
    expect(changed).not.toContain("mutations");
    expect(changed).not.toContain("today");
  });
});

describe("DashboardProviders: handlers movidos", () => {
  beforeEach(() => jest.clearAllMocks());

  it("quitar uma dívida a receber registra a receita no saldo", async () => {
    mockSettleDebt.mockResolvedValue(undefined);
    mockSaveTransaction.mockResolvedValue(undefined);
    const { seen } = setup();

    await act(async () => {
      await seen.debts.handleSettleDebt(
        {
          id: 3,
          type: "lent",
          person: "Bia",
          amount: 50,
        } as never,
        "Conta principal",
      );
    });

    expect(mockSettleDebt).toHaveBeenCalledWith(3, todayString());
    expect(mockSaveTransaction).toHaveBeenCalledWith(null, {
      amount: 50,
      date: todayString(),
      description: "Recebimento de Bia",
      type: "income",
      category: "Empréstimos",
      account: "Conta principal",
    });
    expect(seen.alertState.alertMessage).toBe(
      "Dívida quitada e registrada no seu saldo.",
    );
  });

  it("quitar uma dívida a pagar registra a despesa", async () => {
    mockSettleDebt.mockResolvedValue(undefined);
    mockSaveTransaction.mockResolvedValue(undefined);
    const { seen } = setup();

    await act(async () => {
      await seen.debts.handleSettleDebt(
        {
          id: 4,
          type: "borrowed",
          person: "Caio",
          amount: 20,
        } as never,
        "Conta principal",
      );
    });

    expect(mockSaveTransaction).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        type: "expense",
        description: "Pagamento a Caio",
      }),
    );
  });

  it("nome vazio não salva e avisa", async () => {
    const { seen } = setup();
    const onSaved = jest.fn();

    let saved = true;
    await act(async () => {
      saved = await seen.profile.handleUpdateName("   ", onSaved);
    });

    expect(saved).toBe(false);
    expect(mockUpdateName).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(seen.alertState.alertMessage).toBe("O nome não pode ficar vazio.");
  });

  it("nome válido salva, chama onSaved e avisa", async () => {
    mockUpdateName.mockResolvedValue(undefined);
    const { seen } = setup();
    const onSaved = jest.fn();

    let saved = false;
    await act(async () => {
      saved = await seen.profile.handleUpdateName("Ana Maria", onSaved);
    });

    expect(saved).toBe(true);
    expect(mockUpdateName).toHaveBeenCalledWith("Ana Maria");
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(seen.alertState.alertMessage).toBe("Nome alterado com sucesso!");
  });

  it("falha ao salvar o nome não chama onSaved", async () => {
    mockUpdateName.mockRejectedValue(new Error("boom"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const { seen } = setup();
    const onSaved = jest.fn();

    let saved = true;
    await act(async () => {
      saved = await seen.profile.handleUpdateName("Ana", onSaved);
    });

    expect(saved).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
    expect(seen.alertState.alertMessage).toBe(
      "Não foi possível atualizar o nome.",
    );
  });
});

describe("DashboardProviders: recarregar depois de restaurar um backup", () => {
  it("remonta o painel para ler tudo de novo, mas o aviso em tela continua", () => {
    let mounts = 0;
    const seen = {} as {
      reload: () => void;
      alert: ReturnType<typeof useAlert>;
      state: ReturnType<typeof useAlertState>;
    };

    const Mount = () => {
      React.useEffect(() => {
        mounts++;
      }, []);
      return null;
    };
    const Reader = () => {
      seen.reload = useReloadDashboard();
      seen.alert = useAlert();
      seen.state = useAlertState();
      return <Mount />;
    };

    act(() => {
      create(
        <DashboardProviders>
          <Reader />
        </DashboardProviders>,
      );
    });
    expect(mounts).toBe(1);

    act(() => seen.alert.showAlert("Sucesso", "Backup restaurado."));
    act(() => seen.reload());

    expect(mounts).toBe(2);
    expect(seen.state.alertVisible).toBe(true);
    expect(seen.state.alertMessage).toBe("Backup restaurado.");
  });
});
