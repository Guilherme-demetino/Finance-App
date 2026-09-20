import React from "react";
import { Text as RNText } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { FinancialHealthContainer } from "../components/dashboard/FinancialHealthContainer";
import { useBudgetData } from "../context/BudgetContext";
import { DashboardProviders } from "../context/DashboardProviders";
import { useDebtsContext } from "../context/DebtsContext";
import { usePeriod } from "../context/PeriodContext";
import { useTransactionActions, useTransactionForm } from "../context/TransactionFormContext";
import { resetDatabase } from "../database/sqlite";
import { createSqlJsDatabase } from "../test/sqliteFake";
import { MONTH_NAMES } from "../utils/dates";

/**
 * Integração: a saúde financeira do painel lendo receitas, despesas, orçamento e
 * dívidas de verdade (providers + SQLite em memória). Só os módulos nativos são trocados.
 */
const mockState: { db: unknown } = { db: null };

jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));
jest.mock("expo-image-picker", () => ({}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
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

type Seen = {
  form: ReturnType<typeof useTransactionForm>;
  actions: ReturnType<typeof useTransactionActions>;
  debts: ReturnType<typeof useDebtsContext>;
  budget: ReturnType<typeof useBudgetData>;
  period: ReturnType<typeof usePeriod>;
};

const seen = {} as Seen;
function Probe() {
  Object.assign(seen, {
    form: useTransactionForm(),
    actions: useTransactionActions(),
    debts: useDebtsContext(),
    budget: useBudgetData(),
    period: usePeriod(),
  });
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const formatDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDate(d);
};

const mounted: ReactTestRenderer[] = [];
let tree: ReactTestRenderer;

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const cardText = () =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

async function mountApp() {
  await act(async () => {
    tree = create(
      <DashboardProviders>
        <FinancialHealthContainer />
        <Probe />
      </DashboardProviders>,
    );
    mounted.push(tree);
  });
  await settle();
}

async function addTransaction(title: string, amount: string, type: "income" | "expense", date?: string) {
  await act(async () => {
    seen.actions.openNewTransactionModal();
  });
  await act(async () => {
    seen.form.setTransactionTitle(title);
    seen.form.setTransactionAmount(amount);
    seen.form.setTransactionType(type);
    seen.form.setTransactionCategory(type === "income" ? "salário" : "outros");
    if (date) seen.form.setTransactionDate(date);
  });
  await act(async () => {
    await seen.form.handleSaveTransaction();
  });
  await settle();
}

const addDebt = async (amount: number, dueDate: string | null, type: "lent" | "borrowed" = "borrowed") => {
  await act(async () => {
    await seen.debts.handleAddDebt({
      person: "Maria",
      amount,
      type,
      description: null,
      date: formatDate(new Date()),
      dueDate,
    });
  });
  await settle();
};

const openDetails = () =>
  act(() => {
    tree.root.findByProps({ accessibilityRole: "button" }).props.onPress();
  });

beforeAll(async () => {
  mockState.db = await createSqlJsDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.restoreAllMocks();
});

describe("saúde financeira no painel (providers + banco)", () => {
  it("app novo, sem nada lançado: sem dados", async () => {
    await mountApp();

    const text = cardText();
    expect(text).toContain("Sem dados");
    expect(text).toContain("Registre receitas e despesas para ver a nota do mês.");
  });

  it("receita maior que a despesa: mês saudável e a nota acompanha cada lançamento", async () => {
    await mountApp();

    await addTransaction("Salário", "5.000,00", "income");
    await addTransaction("Aluguel", "1.000,00", "expense");

    expect(cardText()).toContain("Saudável");
    expect(cardText()).toContain("100");

    // Gastar bem mais do que entrou derruba a nota na hora.
    await addTransaction("Viagem", "9.000,00", "expense");
    expect(cardText()).toContain("Em risco");
    expect(cardText()).toContain("Você gastou 100% a mais do que recebeu no mês.");
  });

  it("estourar o orçamento tira o selo de saudável, mesmo com o resto bem", async () => {
    await mountApp();
    await addTransaction("Salário", "5.000,00", "income");
    await addTransaction("Mercado", "3.000,00", "expense");
    await act(async () => {
      await seen.budget.updateBudget(2500);
    });
    await settle();

    const text = cardText();
    expect(text).toContain("Atenção");
    expect(text).toContain("Você estourou o orçamento do mês em R$ 500,00.");

    await openDetails();
    expect(cardText()).toContain("Orçamento | 36/100");
  });

  it("dívida a pagar vencida pesa na nota; quitar tira o peso", async () => {
    await mountApp();
    await addTransaction("Salário", "5.000,00", "income");
    await addTransaction("Mercado", "1.000,00", "expense");
    await addDebt(5000, daysFromNow(-3));

    expect(cardText()).toContain("Atenção");
    expect(cardText()).toContain("Você deve R$ 5.000,00 (100% da receita do mês), 1 vencida.");

    await act(async () => {
      await seen.debts.handleSettleDebt(seen.debts.pendingDebts[0]);
    });
    await settle();
    expect(cardText()).not.toContain("Você deve");
  });

  it("dívida a receber não entra na nota", async () => {
    await mountApp();
    await addTransaction("Salário", "5.000,00", "income");
    await addTransaction("Mercado", "1.000,00", "expense");
    await addDebt(99999, daysFromNow(-3), "lent");

    expect(cardText()).toContain("Saudável");
    await openDetails();
    expect(cardText()).toContain("Nenhuma dívida a pagar em aberto.");
    expect(cardText()).toContain("1 cobrança a receber em atraso (não entra na nota).");
  });

  it("em outro mês as dívidas em aberto ficam fora da nota", async () => {
    await mountApp();
    const now = new Date();
    // Um mês diferente do atual, no mesmo ano.
    const sameYear = new Date(now.getFullYear(), (now.getMonth() + 1) % 12, 15);
    await addTransaction("Salário", "5.000,00", "income", formatDate(sameYear));
    await addDebt(5000, daysFromNow(-3));

    await act(async () => {
      seen.period.setSelectedMonth(MONTH_NAMES[sameYear.getMonth()]);
    });
    await settle();
    await openDetails();

    const text = cardText();
    expect(text).toContain("Saldo do mês");
    expect(text).not.toContain("Dívidas a pagar");
    expect(text).toContain("As dívidas em aberto só entram na nota do mês atual.");
  });
});
