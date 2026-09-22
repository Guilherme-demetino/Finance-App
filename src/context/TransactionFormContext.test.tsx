import React from "react";
import { act, create } from "react-test-renderer";

import type { DisplayTransaction } from "../types";
import {
  TransactionFormProvider,
  useTransactionActions,
  useTransactionForm,
} from "./TransactionFormContext";

const mockSaveTransaction = jest.fn();
const mockShowAlert = jest.fn();

jest.mock("./PeriodContext", () => ({
  usePeriod: () => ({ selectedMonth: "Setembro", selectedYear: "2026" }),
  useToday: () => ({
    currentMonthNum: "09",
    currentYearStr: "2026",
    currentDay: "19",
  }),
}));
jest.mock("./TransactionsContext", () => ({
  useTransactionsMutations: () => ({ saveTransaction: mockSaveTransaction }),
}));
jest.mock("./AlertContext", () => ({
  useAlert: () => ({ showAlert: mockShowAlert }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Form = ReturnType<typeof useTransactionForm>;
type Actions = ReturnType<typeof useTransactionActions>;

function setup() {
  const seen = { form: null as Form | null, actions: null as Actions | null };
  const renders = { form: 0, actions: 0 };

  const FormConsumer = () => {
    seen.form = useTransactionForm();
    renders.form++;
    return null;
  };
  const ActionsConsumer = () => {
    seen.actions = useTransactionActions();
    renders.actions++;
    return null;
  };

  let root!: ReturnType<typeof create>;
  act(() => {
    root = create(
      <TransactionFormProvider>
        <FormConsumer />
        <ActionsConsumer />
      </TransactionFormProvider>,
    );
  });

  return { seen, renders, root };
}

const item: DisplayTransaction = {
  id: "7",
  description: "Padaria",
  amount: 12.5,
  type: "expense",
  date: "05/09/2026",
  category: "Alimentação",
  color: "#fff",
  icon: "cart-outline",
  recurrenceType: null,
  recurrenceGroupId: null,
  installmentNumber: null,
  installmentTotal: null,
};

describe("TransactionFormProvider", () => {
  beforeEach(() => jest.clearAllMocks());

  it("digitar no formulário não re-renderiza quem só usa as ações", () => {
    const { seen, renders } = setup();
    const before = renders.actions;

    act(() => seen.form!.setTransactionTitle("M"));
    act(() => seen.form!.setTransactionTitle("Me"));
    act(() => seen.form!.setTransactionAmount("1"));

    expect(seen.form!.transactionTitle).toBe("Me");
    expect(renders.form).toBeGreaterThan(1);
    expect(renders.actions).toBe(before);
  });

  it("nova transação abre com título e valor vazios, mesmo depois de uma edição", () => {
    const { seen } = setup();

    act(() => seen.actions!.handleOpenEditTransaction(item));
    expect(seen.form!.transactionTitle).toBe("Padaria");
    expect(seen.form!.editingTransactionId).toBe("7");
    expect(seen.form!.isTransactionModalOpen).toBe(true);

    act(() => seen.form!.setIsTransactionModalOpen(false));
    act(() => seen.actions!.openNewTransactionModal());

    expect(seen.form!.transactionTitle).toBe("");
    expect(seen.form!.transactionAmount).toBe("");
    expect(seen.form!.editingTransactionId).toBeNull();
    expect(seen.form!.transactionType).toBe("income");
    expect(seen.form!.transactionDate).toBe("19/09/2026");
    expect(seen.form!.isTransactionModalOpen).toBe(true);
  });

  it("salva com os valores digitados e limpa o formulário", async () => {
    mockSaveTransaction.mockResolvedValue(undefined);
    const { seen } = setup();

    act(() => seen.actions!.openNewTransactionModal());
    act(() => {
      seen.form!.setTransactionTitle("Salário");
      seen.form!.setTransactionAmount("1.500,00");
    });
    await act(async () => {
      await seen.form!.handleSaveTransaction();
    });

    expect(mockSaveTransaction).toHaveBeenCalledWith(
      null,
      {
        amount: 1500,
        date: "19/09/2026",
        description: "Salário",
        type: "income",
        category: "Salário",
        account: "Conta principal",
      },
      { kind: "single" },
    );
    expect(seen.form!.transactionTitle).toBe("");
    expect(seen.form!.isTransactionModalOpen).toBe(false);
  });

  it("não salva sem título ou valor", async () => {
    const { seen } = setup();
    await act(async () => {
      await seen.form!.handleSaveTransaction();
    });
    expect(mockSaveTransaction).not.toHaveBeenCalled();
    expect(mockShowAlert).toHaveBeenCalledWith(
      "Atenção",
      "Preencha o título e o valor da transação.",
    );
  });
});
