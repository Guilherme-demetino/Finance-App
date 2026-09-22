import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import * as transactionsDb from "../database/transactions";
import { resetDatabase } from "../database/sqlite";
import { createSqlJsDatabase } from "../test/sqliteFake";
import { useTrash } from "./useTrash";

const mockState: { db: unknown } = { db: null };
jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));
jest.mock("../services/cardsEvents", () => ({ notifyCardsChanged: jest.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const seen = {} as { hook: ReturnType<typeof useTrash> };
function Probe() {
  Object.assign(seen, { hook: useTrash() });
  return null;
}

const mounted: ReactTestRenderer[] = [];

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 30)));

async function mount() {
  await act(async () => {
    mounted.push(create(<Probe />));
  });
  await settle();
}

const add = (description: string, date = "01/09/2026") =>
  transactionsDb.createTransaction({ description, date, amount: 10, type: "expense", category: "Lazer" });

async function firstId(description: string): Promise<number> {
  const rows = await transactionsDb.getAllTransactions();
  return rows.find((row) => row.description === description)!.id;
}

beforeAll(async () => {
  mockState.db = await createSqlJsDatabase();
});

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  mounted.length = 0;
});

describe("useTrash", () => {
  it("lista as transações excluídas, da mais recente para a mais antiga", async () => {
    await add("Mercado");
    await add("Uber");
    await transactionsDb.deleteTransaction(await firstId("Mercado"));
    await transactionsDb.deleteTransaction(await firstId("Uber"));

    await mount();

    expect(seen.hook.isLoading).toBe(false);
    expect(seen.hook.items.map((item) => item.description)).toEqual(["Uber", "Mercado"]);
  });

  it("restaurar tira da Lixeira e volta a valer", async () => {
    await add("Mercado");
    const id = await firstId("Mercado");
    await transactionsDb.deleteTransaction(id);
    await mount();

    await act(async () => {
      await seen.hook.restore(id);
    });

    expect(seen.hook.items).toEqual([]);
    const [restored] = await transactionsDb.getAllTransactions();
    expect(restored).toMatchObject({ id, deleted_at: null });
  });

  it("excluir de vez some da Lixeira e não pode mais ser restaurada", async () => {
    await add("Mercado");
    const id = await firstId("Mercado");
    await transactionsDb.deleteTransaction(id);
    await mount();

    await act(async () => {
      await seen.hook.removeForever(id);
    });

    expect(seen.hook.items).toEqual([]);
    await transactionsDb.restoreTransaction(id);
    expect(await transactionsDb.getAllTransactions()).toEqual([]);
  });
});
