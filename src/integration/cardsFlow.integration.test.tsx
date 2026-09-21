import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { DueRemindersRunner } from "../components/dashboard/DueRemindersRunner";
import { useCardsContext } from "../context/CardsContext";
import { DashboardProviders } from "../context/DashboardProviders";
import { useTransactionsData } from "../context/TransactionsContext";
import { getAllCardPayments } from "../database/creditCards";
import { resetDatabase } from "../database/sqlite";
import { getAllTransactions } from "../database/transactions";
import { useCreditCards } from "../hooks/useCreditCards";
import { REMINDER_META } from "../services/dueReminders";
import type { createFakeScheduler } from "../test/fakeReminderScheduler";
import { createSqlJsDatabase } from "../test/sqliteFake";
import type { CreditCardRow } from "../types";
import { formatDateToString } from "../utils/dates";

/**
 * Integração de cartões e faturas: o painel de verdade, o banco de verdade (SQLite em memória)
 * e a tela de cartões representada pelo hook que ela usa. Só as notificações do aparelho são
 * um faz-de-conta.
 */
const mockState: { db: unknown } = { db: null };

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
jest.mock("../services/dueRemindersDeps", () => {
  const { getMeta, setMeta } = jest.requireActual("../database/appMeta");
  const { getAllDebts } = jest.requireActual("../database/debts");
  const { getRecurringExpenses } = jest.requireActual("../database/transactions");
  const { getAllCreditCards, getAllCardPurchases, getAllCardPayments } = jest.requireActual("../database/creditCards");
  const { unpaidInvoiceDues } = jest.requireActual("../utils/creditCards");
  const { createFakeScheduler: create } = jest.requireActual("../test/fakeReminderScheduler");
  const fake = create();
  return {
    fake,
    realDueReminderDeps: {
      getMeta,
      setMeta,
      readDebts: getAllDebts,
      readRecurringExpenses: getRecurringExpenses,
      async readInvoices() {
        const [cards, purchases, payments] = await Promise.all([getAllCreditCards(), getAllCardPurchases(), getAllCardPayments()]);
        return unpaidInvoiceDues({ cards, purchases, payments, today: new Date() });
      },
      scheduler: fake.scheduler,
      now: () => new Date(),
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.setTimeout(20_000);

const fake = (jest.requireMock("../services/dueRemindersDeps") as { fake: ReturnType<typeof createFakeScheduler> }).fake;

type Seen = {
  cards: ReturnType<typeof useCreditCards>;
  dues: ReturnType<typeof useCardsContext>;
  transactions: ReturnType<typeof useTransactionsData>;
};

const seen = {} as Seen;
function Probe() {
  Object.assign(seen, {
    cards: useCreditCards(),
    dues: useCardsContext(),
    transactions: useTransactionsData(),
  });
  return null;
}

const mounted: ReactTestRenderer[] = [];
const sleep = (ms: number) => act(async () => void (await new Promise((resolve) => setTimeout(resolve, ms))));
const settle = () => sleep(30);
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

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const cardOf = (name: string): CreditCardRow => {
  const view = seen.cards.views.find((item) => item.card.name === name);
  if (!view) throw new Error(`cartão ${name} não encontrado`);
  return view.card;
};

/** Cartão que fecha no fim do mês (31 vale o último dia): uma compra de hoje sempre cai numa fatura ainda aberta. */
const addOpenCard = async () => {
  await act(async () => {
    await seen.cards.saveCard(null, { name: "Nubank", closingDay: 31, dueDay: 5, limit: 1000 });
  });
  await settle();
};

beforeAll(async () => {
  mockState.db = await createSqlJsDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  fake.state.scheduled.clear();
  fake.state.permission = { granted: true, canAskAgain: true };
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
  jest.restoreAllMocks();
});

describe("cartões e faturas (painel + banco)", () => {
  it("compra parcelada fica fora do saldo e cada parcela vira uma fatura por pagar no painel", async () => {
    await mountApp();
    await addOpenCard();

    await act(async () => {
      const result = await seen.cards.addPurchase(cardOf("Nubank"), {
        description: "Notebook",
        amount: 900,
        date: new Date(),
        category: "Outros",
        installments: 3,
      });
      expect(result).toEqual({ ok: true });
    });
    await settle();

    expect(seen.transactions.totalExpense).toBe(0);
    expect(seen.dues.invoiceDues.map((due) => due.amount)).toEqual([300, 300, 300]);
    expect(seen.cards.views[0].usage).toMatchObject({ used: 900, available: 100 });
  });

  it("dá para pagar uma fatura ainda aberta: vira despesa no saldo e a fatura deixa de receber compras", async () => {
    await mountApp();
    await addOpenCard();
    await act(async () => {
      await seen.cards.addPurchase(cardOf("Nubank"), { description: "Mercado", amount: 50, date: new Date(), category: "Alimentação", installments: 1 });
    });
    await settle();
    const [invoice] = seen.cards.views[0].invoices.filter((item) => item.total > 0);

    expect(invoice.status).toBe("open");

    let result: unknown;
    await act(async () => {
      result = await seen.cards.payInvoice(cardOf("Nubank"), invoice);
    });
    await settle();

    expect(result).toEqual({ ok: true });
    expect(seen.transactions.totalExpense).toBe(50);
    expect(seen.dues.invoiceDues).toEqual([]);

    // Paga, a fatura não recebe mais compras; desfazendo o pagamento ela volta a receber.
    const again = { description: "Outra", amount: 10, date: new Date(), category: "Lazer", installments: 1 };
    let blocked: unknown;
    await act(async () => {
      blocked = await seen.cards.addPurchase(cardOf("Nubank"), again);
    });
    expect(blocked).toMatchObject({ ok: false, error: expect.stringContaining("já está paga") });

    const paid = seen.cards.views[0].invoices.find((item) => item.status === "paid")!;
    await act(async () => {
      await seen.cards.undoPayment(cardOf("Nubank"), paid);
    });
    await settle();
    let allowed: unknown;
    await act(async () => {
      allowed = await seen.cards.addPurchase(cardOf("Nubank"), again);
    });
    expect(allowed).toEqual({ ok: true });
    expect(seen.transactions.totalExpense).toBe(0);
  });

  it("pagar a fatura vencida cria a despesa no saldo do painel e tira o aviso; desfazer devolve tudo", async () => {
    await mountApp();
    await act(async () => {
      await seen.cards.saveCard(null, { name: "Inter", closingDay: 10, dueDay: 20, limit: null });
    });
    await settle();
    await act(async () => {
      await seen.cards.addPurchase(cardOf("Inter"), { description: "TV", amount: 1200, date: daysAgo(90), category: "Outros", installments: 1 });
    });
    await settle();
    expect(seen.dues.invoiceDues).toHaveLength(1);
    expect(seen.dues.invoiceDues[0].status).toBe("overdue");

    const invoice = seen.cards.views[0].invoices.find((item) => item.total > 0)!;
    await act(async () => {
      expect(await seen.cards.payInvoice(cardOf("Inter"), invoice)).toEqual({ ok: true });
    });
    await settle();

    // A despesa entra no mês da fatura (data do fechamento), não no dia em que foi paga.
    const [expense] = await getAllTransactions();
    expect(expense).toMatchObject({ amount: 1200, category_id: "Cartão de crédito", date: invoice.closingDate });
    expect(expense.date).not.toBe(formatDateToString(new Date()));
    expect((await getAllCardPayments())[0].paid_date).toBe(formatDateToString(new Date()));
    expect(seen.dues.invoiceDues).toEqual([]);
    expect(seen.cards.views[0].usage.used).toBe(0);

    // Fatura paga não aceita mexer nas compras dela.
    const paid = seen.cards.views[0].invoices.find((item) => item.status === "paid")!;
    let edit: unknown;
    await act(async () => {
      edit = await seen.cards.removePurchase(paid.purchases[0]);
    });
    expect(edit).toMatchObject({ ok: false });

    await act(async () => {
      expect(await seen.cards.undoPayment(cardOf("Inter"), paid)).toEqual({ ok: true });
    });
    await settle();

    expect(await getAllTransactions()).toEqual([]);
    expect(seen.dues.invoiceDues).toHaveLength(1);
  });

  it("ao abrir o painel, um pagamento antigo (despesa no dia em que foi pago) vai para o mês da fatura, uma vez só", async () => {
    const { setMeta } = jest.requireActual<typeof import("../database/appMeta")>("../database/appMeta");
    await setMeta("card_payment_dates_aligned", "0");
    const { createCreditCard, getAllCreditCards, payInvoice } = jest.requireActual<typeof import("../database/creditCards")>("../database/creditCards");
    await createCreditCard({ name: "Inter", closingDay: 10, dueDay: 20, limit: null });
    const [card] = await getAllCreditCards();
    await payInvoice({ cardId: card.id, cardName: "Inter", ref: "2026-01", amount: 300, paidDate: "05/02/2026" });
    expect((await getAllTransactions())[0].date).toBe("05/02/2026");

    await mountApp();

    expect((await getAllTransactions())[0].date).toBe("10/01/2026");
    expect((await getAllCardPayments())[0].paid_date).toBe("05/02/2026");
  });

  it("apagar uma compra parcelada leva só as parcelas ainda não pagas", async () => {
    await mountApp();
    await act(async () => {
      await seen.cards.saveCard(null, { name: "Inter", closingDay: 10, dueDay: 20, limit: null });
    });
    await settle();
    await act(async () => {
      await seen.cards.addPurchase(cardOf("Inter"), { description: "Sofá", amount: 900, date: daysAgo(90), category: "Moradia", installments: 3 });
    });
    await settle();
    const [first, second] = seen.cards.views[0].invoices.filter((invoice) => invoice.total > 0);
    await act(async () => {
      await seen.cards.payInvoice(cardOf("Inter"), first);
    });
    await settle();

    let result: unknown;
    await act(async () => {
      result = await seen.cards.removeInstallments(second.purchases[0]);
    });
    await settle();

    expect(result).toEqual({ ok: true });
    const left = seen.cards.views[0].invoices.flatMap((invoice) => invoice.purchases);
    expect(left.map((purchase) => purchase.installment_number)).toEqual([1]);
    expect(seen.cards.views[0].usage.used).toBe(0);
  });

  it("mudar a data de uma compra à vista muda a fatura dela", async () => {
    await mountApp();
    await act(async () => {
      await seen.cards.saveCard(null, { name: "Inter", closingDay: 10, dueDay: 20, limit: null });
    });
    await settle();
    const card = cardOf("Inter");
    await act(async () => {
      await seen.cards.addPurchase(card, { description: "Mercado", amount: 50, date: new Date(2026, 8, 5), category: "Alimentação", installments: 1 });
    });
    await settle();
    const purchase = seen.cards.views[0].invoices.flatMap((invoice) => invoice.purchases)[0];
    expect(purchase.invoice_ref).toBe("2026-09");

    await act(async () => {
      await seen.cards.editPurchase(purchase, card, { description: "Mercado", amount: 50, date: new Date(2026, 8, 15), category: "Alimentação" });
    });
    await settle();

    const edited = seen.cards.views[0].invoices.flatMap((invoice) => invoice.purchases)[0];
    expect(edited).toMatchObject({ date: "15/09/2026", invoice_ref: "2026-10" });
  });

  it("excluir a fatura inteira apaga todas as compras dela de uma vez e deixa as outras faturas", async () => {
    await mountApp();
    await addOpenCard();
    const card = cardOf("Nubank");
    await act(async () => {
      await seen.cards.addPurchase(card, { description: "Notebook", amount: 900, date: new Date(), category: "Outros", installments: 3 });
      await seen.cards.addPurchase(card, { description: "Mercado", amount: 50, date: new Date(), category: "Alimentação", installments: 1 });
      await seen.cards.addPurchase(card, { description: "Padaria", amount: 20, date: new Date(), category: "Alimentação", installments: 1 });
    });
    await settle();
    const [first] = seen.cards.views[0].invoices.filter((item) => item.total > 0);
    expect(first.purchases).toHaveLength(3); // 1ª parcela + Mercado + Padaria

    let result: unknown;
    await act(async () => {
      result = await seen.cards.removeInvoice(first);
    });
    await settle();

    expect(result).toEqual({ ok: true });
    const left = seen.cards.views[0].invoices.flatMap((invoice) => invoice.purchases);
    expect(left.map((purchase) => [purchase.description, purchase.installment_number])).toEqual([
      ["Notebook", 2],
      ["Notebook", 3],
    ]);
    expect(seen.dues.invoiceDues).toHaveLength(2);
  });

  it("fatura paga não pode ser excluída inteira (desfaça o pagamento antes); a despesa do pagamento fica no saldo", async () => {
    await mountApp();
    await addOpenCard();
    const card = cardOf("Nubank");
    await act(async () => {
      await seen.cards.addPurchase(card, { description: "Mercado", amount: 50, date: new Date(), category: "Alimentação", installments: 1 });
    });
    await settle();
    const invoice = seen.cards.views[0].invoices.find((item) => item.total > 0)!;
    await act(async () => {
      await seen.cards.payInvoice(card, invoice);
    });
    await settle();
    const paid = seen.cards.views[0].invoices.find((item) => item.status === "paid")!;

    let result: unknown;
    await act(async () => {
      result = await seen.cards.removeInvoice(paid);
    });

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Desfaça o pagamento") });
    expect(seen.transactions.transactions[0]).toMatchObject({ amount: 50, category_id: "Cartão de crédito", description: expect.stringContaining("Fatura Nubank") });
  });

  it("apagar o cartão tira as faturas do painel", async () => {
    await mountApp();
    await addOpenCard();
    await act(async () => {
      await seen.cards.addPurchase(cardOf("Nubank"), { description: "Mercado", amount: 50, date: new Date(), category: "Alimentação", installments: 1 });
    });
    await settle();
    expect(seen.dues.invoiceDues).toHaveLength(1);

    await act(async () => {
      await seen.cards.removeCard(cardOf("Nubank").id);
    });
    await settle();

    expect(seen.cards.views).toEqual([]);
    expect(seen.dues.invoiceDues).toEqual([]);
  });
});

describe("lembretes da fatura", () => {
  const turnOn = async () => {
    const { setMeta } = jest.requireActual<typeof import("../database/appMeta")>("../database/appMeta");
    await setMeta(REMINDER_META.enabled, "1");
  };

  it("uma fatura por vencer agenda o aviso; apagar a compra cancela", async () => {
    await turnOn();
    await mountApp();
    await addOpenCard();

    await act(async () => {
      await seen.cards.addPurchase(cardOf("Nubank"), { description: "Mercado", amount: 50, date: new Date(), category: "Alimentação", installments: 1 });
    });
    await waitForSync();

    const [reminder] = [...fake.state.scheduled.values()];
    expect(fake.state.scheduled.size).toBe(1);
    expect(reminder.title).toContain("Fatura Nubank vence");
    expect(reminder.body).toContain("R$ 50,00");

    await act(async () => {
      await seen.cards.removePurchase(seen.cards.views[0].invoices.flatMap((invoice) => invoice.purchases)[0]);
    });
    await waitForSync();

    expect(fake.state.scheduled.size).toBe(0);
  });
});
