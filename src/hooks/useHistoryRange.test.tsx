import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import * as transactionsDb from "../database/transactions";
import { resetDatabase } from "../database/sqlite";
import { createSqlJsDatabase } from "../test/sqliteFake";
import type { DateRange } from "../utils/historyFilters";
import { useHistoryRange } from "./useHistoryRange";

const mockState: { db: unknown } = { db: null };
jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const seen = {} as { hook: ReturnType<typeof useHistoryRange> };
function Probe({ period, signal }: { period: DateRange | null; signal: number }) {
  Object.assign(seen, { hook: useHistoryRange(period, signal) });
  return null;
}

const mounted: ReactTestRenderer[] = [];
let tree: ReactTestRenderer;

const render = (period: DateRange | null, signal = 0) =>
  act(async () => {
    if (!tree) {
      tree = create(<Probe period={period} signal={signal} />);
      mounted.push(tree);
    } else {
      tree.update(<Probe period={period} signal={signal} />);
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

const add = (description: string, date: string, amount = 10, category = "Lazer") =>
  transactionsDb.createTransaction({ description, date, amount, type: "expense", category });

beforeAll(async () => {
  mockState.db = await createSqlJsDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  tree = undefined as unknown as ReactTestRenderer;
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.restoreAllMocks();
});

describe("useHistoryRange", () => {
  it("sem período não busca nada e não fica carregando", async () => {
    const spy = jest.spyOn(transactionsDb, "getTransactionsInRange");

    await render(null);

    expect(seen.hook).toEqual({ items: [], isLoading: false, hasError: false });
    expect(spy).not.toHaveBeenCalled();
  });

  it("carrega o período, atravessando o ano, no formato das listas (id texto, cor da categoria)", async () => {
    await add("Dezembro", "20/12/2025");
    await add("Janeiro", "05/01/2026", 25.5);
    await add("Fora", "01/06/2026");

    await render({ from: "01/12/2025", to: "31/01/2026" });

    expect(seen.hook.isLoading).toBe(false);
    expect(seen.hook.hasError).toBe(false);
    expect(seen.hook.items.map((item) => item.description).sort()).toEqual(["Dezembro", "Janeiro"]);
    const january = seen.hook.items.find((item) => item.description === "Janeiro");
    expect(january).toMatchObject({ amount: 25.5, type: "expense", category: "Lazer", date: "05/01/2026", icon: "cart-outline" });
    expect(typeof january?.id).toBe("string");
    expect(january?.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("enquanto o período novo carrega, indica carregando e não mostra a lista do período anterior", async () => {
    await add("Agosto", "10/08/2026");
    await add("Setembro", "10/09/2026");
    await render({ from: "01/08/2026", to: "31/08/2026" });
    expect(seen.hook.items.map((item) => item.description)).toEqual(["Agosto"]);

    // Troca o período: no mesmo instante em que o React desenha, ainda não há lista do período novo.
    act(() => {
      tree.update(<Probe period={{ from: "01/09/2026", to: "30/09/2026" }} signal={0} />);
    });
    expect(seen.hook.isLoading).toBe(true);
    expect(seen.hook.items).toEqual([]);

    await render({ from: "01/09/2026", to: "30/09/2026" });
    expect(seen.hook.isLoading).toBe(false);
    expect(seen.hook.items.map((item) => item.description)).toEqual(["Setembro"]);
  });

  it("lê de novo quando as transações mudam (salvar, editar ou apagar)", async () => {
    await add("Primeira", "10/09/2026");
    const period = { from: "01/09/2026", to: "30/09/2026" };
    await render(period, 0);
    expect(seen.hook.items).toHaveLength(1);

    await add("Segunda", "11/09/2026");
    await render(period, 1);

    expect(seen.hook.items.map((item) => item.description).sort()).toEqual(["Primeira", "Segunda"]);
  });

  it("voltar para sem período esvazia a lista", async () => {
    await add("Primeira", "10/09/2026");
    await render({ from: "01/09/2026", to: "30/09/2026" });
    expect(seen.hook.items).toHaveLength(1);

    await render(null);

    expect(seen.hook).toEqual({ items: [], isLoading: false, hasError: false });
  });

  it("falha do banco: avisa o erro, sem ficar carregando para sempre e sem derrubar", async () => {
    jest.spyOn(transactionsDb, "getTransactionsInRange").mockRejectedValue(new Error("banco fora do ar"));

    await render({ from: "01/09/2026", to: "30/09/2026" });

    expect(seen.hook).toEqual({ items: [], isLoading: false, hasError: true });
  });
});
