import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { useAccountFilter } from "../context/AccountFilterContext";
import { useAlertState } from "../context/AlertContext";
import { useBudgetData } from "../context/BudgetContext";
import { DashboardProviders } from "../context/DashboardProviders";
import { useDebtsContext } from "../context/DebtsContext";
import {
  useTransactionActions,
  useTransactionForm,
} from "../context/TransactionFormContext";
import { useTransactionsData } from "../context/TransactionsContext";
import { readBackupData } from "../database/backup";
import { resetDatabase } from "../database/sqlite";
import { createTransfer } from "../database/transfers";
import { notifyCardsChanged } from "../services/cardsEvents";
import { createSqlJsDatabase } from "../test/sqliteFake";
import { groupBalancesByAccount } from "../utils/accountBalances";

/**
 * Integração: providers, hooks de dados e banco de verdade (SQLite em memória),
 * sem mockar nada do app. Só o que é do aparelho (SQLite nativo, orientação da
 * tela, seletor de imagens) é trocado.
 */
const mockState: { db: unknown } = { db: null };
jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));
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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Seen = {
  transactions: ReturnType<typeof useTransactionsData>;
  form: ReturnType<typeof useTransactionForm>;
  actions: ReturnType<typeof useTransactionActions>;
  alert: ReturnType<typeof useAlertState>;
  debts: ReturnType<typeof useDebtsContext>;
  budget: ReturnType<typeof useBudgetData>;
  accountFilter: ReturnType<typeof useAccountFilter>;
};

function createApp() {
  const seen = {} as Seen;
  function Probe() {
    seen.transactions = useTransactionsData();
    seen.form = useTransactionForm();
    seen.actions = useTransactionActions();
    seen.alert = useAlertState();
    seen.debts = useDebtsContext();
    seen.budget = useBudgetData();
    seen.accountFilter = useAccountFilter();
    return null;
  }
  return { seen, Probe };
}

const pad = (n: number) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

let seen: Seen;
let Probe: () => null;
const mounted: ReactTestRenderer[] = [];

/** Deixa os hooks de dados terminarem de ler o banco. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

async function mountApp() {
  await act(async () => {
    mounted.push(
      create(
        <DashboardProviders>
          <Probe />
        </DashboardProviders>,
      ),
    );
  });
  await settle();
}

async function fillAndSave(fields: {
  title: string;
  amount: string;
  type?: "income" | "expense";
  category?: string;
  account?: string;
  recurringMonths?: number;
  installments?: number;
}) {
  await act(async () => {
    seen.actions.openNewTransactionModal();
  });
  await act(async () => {
    seen.form.setTransactionTitle(fields.title);
    seen.form.setTransactionAmount(fields.amount);
    if (fields.type) seen.form.setTransactionType(fields.type);
    if (fields.category) seen.form.setTransactionCategory(fields.category);
    if (fields.account) seen.form.setTransactionAccount(fields.account);
    if (fields.recurringMonths) {
      seen.form.setIsRecurring(true);
      seen.form.setRecurringMonths(fields.recurringMonths);
    }
    if (fields.installments) seen.form.setInstallmentCount(fields.installments);
  });
  await act(async () => {
    await seen.form.handleSaveTransaction();
  });
  await settle();
}

beforeAll(async () => {
  mockState.db = await createSqlJsDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  ({ seen, Probe } = createApp());
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
  jest.restoreAllMocks();
});

describe("fluxo de transações (interface + dados + banco)", () => {
  it("começa vazio", async () => {
    await mountApp();
    expect(seen.transactions.transactions).toEqual([]);
    expect(seen.transactions.totalBalance).toBe(0);
  });

  it("criar uma receita: aparece na lista, entra no saldo, fica no banco e limpa o formulário", async () => {
    await mountApp();

    await fillAndSave({ title: "Salário", amount: "1.500,00" });

    expect(seen.alert.alertMessage).toBe("Transação salva com sucesso!");
    expect(seen.transactions.formattedTransactions).toHaveLength(1);
    expect(seen.transactions.formattedTransactions[0]).toMatchObject({
      description: "Salário",
      amount: 1500,
      type: "income",
      date: today(),
    });
    expect(seen.transactions.totalIncome).toBe(1500);
    expect(seen.transactions.totalBalance).toBe(1500);

    const stored = (await readBackupData()).transactions;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ description: "Salário", amount: 1500, date: today() });

    expect(seen.form.transactionTitle).toBe("");
    expect(seen.form.isTransactionModalOpen).toBe(false);
  });

  it("receita e despesa se somam no saldo", async () => {
    await mountApp();

    await fillAndSave({ title: "Salário", amount: "2.000,00" });
    await fillAndSave({
      title: "Mercado",
      amount: "350,50",
      type: "expense",
      category: "Alimentação",
    });

    expect(seen.transactions.totalIncome).toBe(2000);
    expect(seen.transactions.totalExpense).toBe(350.5);
    expect(seen.transactions.totalBalance).toBe(1649.5);
  });

  it("sem título ou sem valor não grava nada", async () => {
    await mountApp();

    await fillAndSave({ title: "", amount: "10,00" });
    expect(seen.alert.alertMessage).toBe("Preencha o título e o valor da transação.");
    await fillAndSave({ title: "Algo", amount: "0,00" });
    expect(seen.alert.alertMessage).toBe("Insira um valor válido.");

    expect((await readBackupData()).transactions).toHaveLength(0);
  });

  it("recorrente por 3 meses cria 3 lançamentos ligados pela mesma série", async () => {
    await mountApp();

    await fillAndSave({
      title: "Aluguel",
      amount: "900,00",
      type: "expense",
      recurringMonths: 3,
    });

    const stored = (await readBackupData()).transactions;
    expect(stored).toHaveLength(3);
    expect(new Set(stored.map((t) => t.recurrence_group_id)).size).toBe(1);
    expect(stored.every((t) => t.recurrence_type === "recurring")).toBe(true);
    // só o mês em exibição aparece na tela
    expect(seen.transactions.formattedTransactions).toHaveLength(1);
  });

  it("apagar uma série recorrente remove todas as ocorrências", async () => {
    await mountApp();
    await fillAndSave({ title: "Aluguel", amount: "900,00", type: "expense", recurringMonths: 3 });
    const groupId = (await readBackupData()).transactions[0].recurrence_group_id!;

    await act(async () => {
      await seen.transactions.handleDeleteSeries(groupId);
    });
    await settle();

    expect((await readBackupData()).transactions).toHaveLength(0);
    expect(seen.transactions.formattedTransactions).toHaveLength(0);
    expect(seen.alert.alertMessage).toBe("Série excluída com sucesso.");
  });

  it("compra parcelada em 3x cria 3 parcelas numeradas que somam o total", async () => {
    await mountApp();

    await fillAndSave({ title: "Notebook", amount: "1.000,00", type: "expense", installments: 3 });

    const stored = (await readBackupData()).transactions;
    expect(stored.map((t) => t.installment_number)).toEqual([1, 2, 3]);
    expect(stored.every((t) => t.installment_total === 3)).toBe(true);
    const total = stored.reduce((sum, t) => sum + t.amount, 0);
    expect(Math.round(total * 100)).toBe(100000);
    expect(seen.alert.alertMessage).toBe("Compra parcelada em 3x cadastrada com sucesso!");
  });

  it("editar altera o lançamento existente, sem duplicar", async () => {
    await mountApp();
    await fillAndSave({ title: "Salario", amount: "1.000,00" });
    const item = seen.transactions.formattedTransactions[0];

    await act(async () => {
      seen.actions.handleOpenEditTransaction(item);
    });
    expect(seen.form.transactionTitle).toBe("Salario");
    expect(seen.form.transactionAmount).toBe("1.000,00");
    await act(async () => {
      seen.form.setTransactionTitle("Salário corrigido");
      seen.form.setTransactionAmount("1.200,00");
    });
    await act(async () => {
      await seen.form.handleSaveTransaction();
    });
    await settle();

    const stored = (await readBackupData()).transactions;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ description: "Salário corrigido", amount: 1200 });
    expect(seen.alert.alertMessage).toBe("Transação atualizada com sucesso!");
    expect(seen.transactions.totalIncome).toBe(1200);
  });

  it("excluir remove do banco e da tela, e oferece desfazer (sem alerta bloqueando)", async () => {
    await mountApp();
    await fillAndSave({ title: "Uber", amount: "25,00", type: "expense" });
    const id = seen.transactions.formattedTransactions[0].id;

    await act(async () => {
      await seen.transactions.handleDeleteTransaction(id);
    });
    await settle();

    expect(seen.transactions.formattedTransactions).toHaveLength(0);
    expect((await readBackupData()).transactions).toHaveLength(0);
    // Nenhum alerta novo: quem avisa da exclusão agora é o snackbar de "Desfazer".
    expect(seen.alert.alertMessage).toBe("Transação salva com sucesso!");
    expect(seen.transactions.pendingUndo).toMatchObject({ id: Number(id), description: "Uber" });
  });

  it("desfazer a exclusão traz a transação de volta", async () => {
    await mountApp();
    await fillAndSave({ title: "Uber", amount: "25,00", type: "expense" });
    const id = seen.transactions.formattedTransactions[0].id;
    await act(async () => {
      await seen.transactions.handleDeleteTransaction(id);
    });
    await settle();

    await act(async () => {
      await seen.transactions.undoDelete();
    });
    await settle();

    expect(seen.transactions.formattedTransactions).toHaveLength(1);
    expect(seen.transactions.pendingUndo).toBeNull();
    expect((await readBackupData()).transactions).toHaveLength(1);
  });
});

describe("alternar entre contas/carteiras", () => {
  it("com uma conta em foco, o saldo e a lista mostram só ela; 'todas as contas' junta tudo de novo", async () => {
    await mountApp();
    await fillAndSave({ title: "Salário", amount: "1000,00", type: "income", account: "Carteira" });
    await fillAndSave({ title: "Mercado", amount: "100,00", type: "expense", account: "Carteira" });
    await fillAndSave({ title: "Freela", amount: "500,00", type: "income", account: "Poupança" });

    expect(seen.transactions.totalIncome).toBe(1500);
    expect(seen.transactions.transactions).toHaveLength(3);

    await act(async () => {
      seen.accountFilter.setSelectedAccount("Carteira");
    });
    await settle();

    expect(seen.transactions.totalIncome).toBe(1000);
    expect(seen.transactions.totalExpense).toBe(100);
    expect(seen.transactions.formattedTransactions.map((t) => t.description).sort()).toEqual(["Mercado", "Salário"]);

    await act(async () => {
      seen.accountFilter.setSelectedAccount(null);
    });
    await settle();

    expect(seen.transactions.totalIncome).toBe(1500);
    expect(seen.transactions.transactions).toHaveLength(3);
  });
});

describe("transferência entre contas", () => {
  it("não conta como receita nem despesa, mas ajusta o saldo de cada conta envolvida", async () => {
    await mountApp();
    await fillAndSave({ title: "Salário", amount: "1000,00", type: "income", account: "Carteira" });

    await act(async () => {
      await createTransfer({ amount: 300, date: today(), fromAccount: "Carteira", toAccount: "Poupança" });
      notifyCardsChanged();
    });
    await settle();

    // Fora dos totais "de verdade" (Resumo/Saldo Atual/saúde financeira não inflam com a transferência).
    expect(seen.transactions.totalIncome).toBe(1000);
    expect(seen.transactions.totalExpense).toBe(0);
    // Mas aparece na lista bruta, e o saldo por conta reflete o dinheiro se movendo.
    expect(seen.transactions.transactions).toHaveLength(3);
    const balances = groupBalancesByAccount(seen.transactions.transactions);
    expect(balances.find((b) => b.account === "Carteira")?.balance).toBe(700);
    expect(balances.find((b) => b.account === "Poupança")?.balance).toBe(300);

    const descriptions = seen.transactions.formattedTransactions.map((t) => t.description).sort();
    expect(descriptions).toEqual(["Salário", "Transferência de Carteira", "Transferência para Poupança"]);
  });

  it("excluir a transferência tira as duas pontas de uma vez", async () => {
    await mountApp();
    await act(async () => {
      await createTransfer({ amount: 300, date: today(), fromAccount: "Carteira", toAccount: "Poupança" });
      notifyCardsChanged();
    });
    await settle();
    const groupId = seen.transactions.transactions[0].transfer_group_id!;

    await act(async () => {
      await seen.transactions.handleDeleteTransferGroup(groupId);
    });
    await settle();

    expect(seen.transactions.transactions).toEqual([]);
  });

  it("fica fora do orçamento por categoria e do comparativo com o mês anterior", async () => {
    await mountApp();
    await act(async () => {
      await createTransfer({ amount: 300, date: today(), fromAccount: "Carteira", toAccount: "Poupança" });
      notifyCardsChanged();
    });
    await settle();

    // Nenhuma categoria "Transferência entre contas" aparece com gasto no Orçamento.
    const transferCategory = seen.budget.categoryBudgets.find((c) => c.category === "Transferência entre contas");
    expect(transferCategory).toBeUndefined();

    // O comparativo do mês (gasto de verdade) não conta a saída da transferência.
    expect(seen.budget.comparison?.currentTotal).toBe(0);
  });
});

describe("fluxo de dívidas e orçamento (interface + dados + banco)", () => {
  it("quitar uma dívida a receber lança a receita no saldo de hoje", async () => {
    await mountApp();
    await act(async () => {
      await seen.debts.handleAddDebt({
        person: "Bia",
        amount: 50,
        type: "lent",
        description: null,
        date: today(),
        dueDate: null,
      });
    });
    await settle();
    expect(seen.debts.pendingDebts).toHaveLength(1);
    expect(seen.debts.totalToReceive).toBe(50);
    expect(seen.transactions.totalIncome).toBe(0); // pendente não mexe no saldo

    await act(async () => {
      await seen.debts.handleSettleDebt(seen.debts.pendingDebts[0], "Conta principal");
    });
    await settle();

    expect(seen.debts.pendingDebts).toHaveLength(0);
    expect(seen.debts.settledDebts).toHaveLength(1);
    expect(seen.transactions.totalIncome).toBe(50);
    expect(seen.transactions.formattedTransactions[0]).toMatchObject({
      description: "Recebimento de Bia",
      category: "Empréstimos",
      type: "income",
    });
    expect(seen.alert.alertMessage).toBe("Dívida quitada e registrada no seu saldo.");
  });

  it("quitar numa conta específica: a transação criada entra nela; cancelar não cria nada", async () => {
    await mountApp();
    await act(async () => {
      await seen.debts.handleAddDebt({
        person: "Caio",
        amount: 20,
        type: "borrowed",
        description: null,
        date: today(),
        dueDate: null,
      });
    });
    await settle();
    const debt = seen.debts.pendingDebts[0];

    act(() => seen.debts.requestSettleDebt(debt));
    expect(seen.debts.pendingSettleDebt).toEqual(debt);

    act(() => seen.debts.cancelSettleDebt());
    expect(seen.debts.pendingSettleDebt).toBeNull();
    expect(seen.debts.pendingDebts).toHaveLength(1); // cancelar não quita nada

    await act(async () => {
      await seen.debts.handleSettleDebt(debt, "Poupança");
    });
    await settle();

    expect(seen.transactions.formattedTransactions[0]).toMatchObject({
      description: "Pagamento a Caio",
      account: "Poupança",
    });
  });

  it("o orçamento do mês continua lá depois de fechar e abrir o painel", async () => {
    await mountApp();
    await act(async () => {
      await seen.budget.updateBudget(500);
    });
    await settle();
    expect(seen.budget.budget).toBe(500);

    act(() => {
      mounted.splice(0).forEach((tree) => tree.unmount());
    });
    await mountApp();

    expect(seen.budget.budget).toBe(500);
  });
});
