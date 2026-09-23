import React from "react";
import { Platform } from "react-native";
import { act, create } from "react-test-renderer";

import { WidgetSyncRunner } from "./WidgetSyncRunner";

const mockRequestWidgetUpdate = jest.fn();
jest.mock("react-native-android-widget", () => ({
  requestWidgetUpdate: (...args: unknown[]) => mockRequestWidgetUpdate(...args),
}));

const mockLoadMonthBalance = jest.fn();
const mockLoadUpcomingBills = jest.fn();
jest.mock("../../services/widgetDataDeps", () => ({
  loadMonthBalance: (...args: unknown[]) => mockLoadMonthBalance(...args),
  loadUpcomingBills: (...args: unknown[]) => mockLoadUpcomingBills(...args),
}));

let mockDebtsValue: { pendingDebts: unknown[] } = { pendingDebts: [] };
let mockTransactionsValue: { transactions: unknown[] } = { transactions: [] };
let mockCardsValue: { invoiceDues: unknown[] } = { invoiceDues: [] };
jest.mock("../../context/DebtsContext", () => ({ useDebtsContext: () => mockDebtsValue }));
jest.mock("../../context/TransactionsContext", () => ({ useTransactionsData: () => mockTransactionsValue }));
jest.mock("../../context/CardsContext", () => ({ useCardsContext: () => mockCardsValue }));

const mockLogError = jest.fn();
jest.mock("../../utils/logger", () => ({ logError: (...args: unknown[]) => mockLogError(...args) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.useFakeTimers();

function mount() {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<WidgetSyncRunner />);
  });
  return tree;
}

beforeEach(() => {
  mockRequestWidgetUpdate.mockReset().mockResolvedValue(undefined);
  mockLoadMonthBalance.mockReset().mockResolvedValue({
    balanceText: "R$ 100,00",
    incomeText: "R$ 100,00",
    expenseText: "R$ 0,00",
    isPositive: true,
  });
  mockLoadUpcomingBills.mockReset().mockResolvedValue([]);
  mockLogError.mockReset();
  mockDebtsValue = { pendingDebts: [] };
  mockTransactionsValue = { transactions: [] };
  mockCardsValue = { invoiceDues: [] };
});

describe("WidgetSyncRunner", () => {
  it("no Android, depois do atraso de espera, atualiza os dois widgets com os dados carregados", async () => {
    const restore = jest.replaceProperty(Platform, "OS", "android");

    mount();
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(mockRequestWidgetUpdate).toHaveBeenCalledTimes(2);
    const [monthCall] = mockRequestWidgetUpdate.mock.calls.find(([args]) => args.widgetName === "MonthBalance")!;
    const [billsCall] = mockRequestWidgetUpdate.mock.calls.find(([args]) => args.widgetName === "UpcomingBills")!;

    await expect(monthCall.renderWidget()).resolves.toBeTruthy();
    await expect(billsCall.renderWidget()).resolves.toBeTruthy();
    expect(mockLoadMonthBalance).toHaveBeenCalled();
    expect(mockLoadUpcomingBills).toHaveBeenCalled();

    restore.restore();
  });

  it("fora do Android, não tenta atualizar nada", async () => {
    const restore = jest.replaceProperty(Platform, "OS", "ios");

    mount();
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(mockRequestWidgetUpdate).not.toHaveBeenCalled();

    restore.restore();
  });

  it("antes do atraso de espera, ainda não atualizou", async () => {
    const restore = jest.replaceProperty(Platform, "OS", "android");

    mount();
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(mockRequestWidgetUpdate).not.toHaveBeenCalled();

    restore.restore();
  });

  it("se a atualização falhar, registra o log em vez de deixar a promessa rejeitada solta", async () => {
    const restore = jest.replaceProperty(Platform, "OS", "android");
    mockRequestWidgetUpdate.mockRejectedValue(new Error("falhou"));

    mount();
    await act(async () => {
      jest.advanceTimersByTime(1500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockLogError).toHaveBeenCalled();

    restore.restore();
  });

  it("mudanças nos dados (dívidas, transações, faturas) disparam uma nova atualização", async () => {
    const restore = jest.replaceProperty(Platform, "OS", "android");
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<WidgetSyncRunner />);
    });
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(mockRequestWidgetUpdate).toHaveBeenCalledTimes(2);

    mockTransactionsValue = { transactions: [{ id: 1 }] };
    act(() => {
      tree.update(<WidgetSyncRunner />);
    });
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(mockRequestWidgetUpdate).toHaveBeenCalledTimes(4);

    restore.restore();
  });
});
