import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { useAlertState } from "../context/AlertContext";
import { DashboardProviders } from "../context/DashboardProviders";
import { useTransactionsData } from "../context/TransactionsContext";
import { getAllCardPayments, getAllCardPurchases } from "../database/creditCards";
import { resetDatabase } from "../database/sqlite";
import { getAllTransactions } from "../database/transactions";
import { useCreditCards } from "../hooks/useCreditCards";
import { useDataTransfer } from "../hooks/useDataTransfer";
import { createSqlJsDatabase } from "../test/sqliteFake";
import type { CreditCardRow } from "../types";
import { planCardImport } from "../utils/cardImport";
import { invoiceDates, invoiceRefFor } from "../utils/creditCards";
import { formatDateToString } from "../utils/dates";

/**
 * Integração da leitura da fatura (CSV) e do extrato sem duplicar o pagamento: o painel, os hooks e o banco de
 * verdade. Só o seletor de arquivos e os módulos nativos são trocados.
 */
const mockState: { db: unknown } = { db: null };
const mockPick: { bytes: Uint8Array | null } = { bytes: null };

function mockDecodeUtf8(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(binary));
}

jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));
jest.mock("expo-file-system", () => {
  class File {
    static async pickFileAsync() {
      const bytes = mockPick.bytes;
      if (bytes === null) return { canceled: true, result: null };
      return {
        canceled: false,
        result: {
          arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          text: async () => mockDecodeUtf8(bytes),
        },
      };
    }
  }
  return { File, Paths: { cache: "cache" } };
});
jest.mock("expo-print", () => ({ printAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: async () => false, shareAsync: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
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

type Seen = {
  cards: ReturnType<typeof useCreditCards>;
  transfer: ReturnType<typeof useDataTransfer>;
  transactions: ReturnType<typeof useTransactionsData>;
  alert: ReturnType<typeof useAlertState>;
};

const seen = {} as Seen;
function Probe() {
  Object.assign(seen, {
    cards: useCreditCards(),
    transfer: useDataTransfer(),
    transactions: useTransactionsData(),
    alert: useAlertState(),
  });
  return null;
}

const mounted: ReactTestRenderer[] = [];
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

const bytesOf = (text: string) => {
  const binary = unescape(encodeURIComponent(text));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Fecha dia 10, vence dia 20. Compras de 90 dias atrás caem numa fatura que já venceu (sempre paga-se e concilia-se).
const PURCHASE_DAY = daysAgo(90);

/** A fatura em CSV do cartão (formato Nubank: valor positivo é compra, negativo é crédito ou pagamento). */
const invoiceCsv = () =>
  [
    "date,category,title,amount",
    `${iso(PURCHASE_DAY)},alimentação,Mercado,60.00`,
    `${iso(PURCHASE_DAY)},casa,Notebook - Parcela 2/5,40.00`,
    `${iso(PURCHASE_DAY)},pagamento,Pagamento recebido,-900.00`,
  ].join("\n");

/** O extrato da conta (formato Nubank de conta) com uma linha de débito na data dada. */
const statementCsv = (date: string, description: string, amount: string) =>
  ["Data,Valor,Identificador,Descrição", `${date},${amount},x1,${description}`].join("\n");

async function addCard(): Promise<CreditCardRow> {
  await act(async () => {
    await seen.cards.saveCard(null, { name: "Inter", closingDay: 10, dueDay: 20, limit: null });
  });
  await settle();
  return seen.cards.views[0].card;
}

async function importInvoiceFile(card: CreditCardRow, csv: string) {
  mockPick.bytes = bytesOf(csv);
  let read!: Awaited<ReturnType<typeof seen.cards.readInvoiceFile>>;
  await act(async () => {
    read = await seen.cards.readInvoiceFile();
  });
  if (read.status !== "ready") return { read, plan: null, result: null };
  const plan = planCardImport({
    candidates: read.candidates,
    card,
    purchases: seen.cards.purchases,
    payments: seen.cards.payments,
    transactions: read.transactions,
    today: new Date(),
  });
  let result!: Awaited<ReturnType<typeof seen.cards.importInvoice>>;
  await act(async () => {
    result = await seen.cards.importInvoice(card, plan);
  });
  await settle();
  return { read, plan, result };
}

const invoiceDue = (card: CreditCardRow) => formatDateToString(invoiceDates(invoiceRefFor(PURCHASE_DAY, card), card).due);

async function pickStatement(csv: string) {
  mockPick.bytes = bytesOf(csv);
  await act(async () => {
    await seen.transfer.handleImportFile();
  });
}

beforeAll(async () => {
  mockState.db = await createSqlJsDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  mockPick.bytes = null;
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
  jest.restoreAllMocks();
});

describe("importar a fatura do cartão (CSV)", () => {
  it("as compras entram no cartão, na fatura certa e fora do saldo; parcela e crédito são tratados", async () => {
    await mountApp();
    const card = await addCard();

    const { plan, result } = await importInvoiceFile(card, invoiceCsv());

    expect(result).toEqual({ ok: true });
    expect(plan!.ignoredCredits).toBe(1);
    const stored = await getAllCardPurchases();
    expect(stored.map((p) => [p.description, p.amount, p.installment_number, p.installment_total]).sort()).toEqual([
      ["Mercado", 60, null, null],
      ["Notebook", 40, 2, 5],
    ]);
    expect(new Set(stored.map((p) => p.invoice_ref)).size).toBe(1);
    expect(seen.transactions.totalExpense).toBe(0);
    expect(await getAllTransactions()).toEqual([]);
  });

  it("importar o mesmo arquivo de novo não duplica nada", async () => {
    await mountApp();
    const card = await addCard();
    await importInvoiceFile(card, invoiceCsv());

    const { plan, result } = await importInvoiceFile(card, invoiceCsv());

    expect(plan!.rows).toEqual([]);
    expect(plan!.duplicates).toBe(2);
    expect(result).toEqual({ ok: false, error: "Não há compras novas para importar." });
    expect(await getAllCardPurchases()).toHaveLength(2);
  });

  it("não duplica o que foi lançado à mão, e uma compra a mais no arquivo entra", async () => {
    await mountApp();
    const card = await addCard();
    await act(async () => {
      await seen.cards.addPurchase(card, { description: "mercado", amount: 60, date: PURCHASE_DAY, category: "Alimentação", installments: 1 });
    });
    await settle();

    const { plan } = await importInvoiceFile(card, invoiceCsv());

    expect(plan!.duplicates).toBe(1);
    expect((await getAllCardPurchases()).map((p) => p.description).sort()).toEqual(["Notebook", "mercado"]);
  });

  it("arquivo que não é fatura avisa e não grava", async () => {
    await mountApp();
    const card = await addCard();

    const { read } = await importInvoiceFile(card, "isso não é uma fatura");

    expect(read).toMatchObject({ status: "error" });
    expect(await getAllCardPurchases()).toEqual([]);
  });

  it("desistir do seletor não faz nada", async () => {
    await mountApp();
    await addCard();
    mockPick.bytes = null;

    let read!: Awaited<ReturnType<typeof seen.cards.readInvoiceFile>>;
    await act(async () => {
      read = await seen.cards.readInvoiceFile();
    });

    expect(read).toEqual({ status: "cancelled" });
  });

  it("uma fatura já paga não recebe compras do arquivo", async () => {
    await mountApp();
    const card = await addCard();
    await importInvoiceFile(card, invoiceCsv());
    const invoice = seen.cards.views[0].invoices.find((item) => item.total > 0)!;
    await act(async () => {
      await seen.cards.payInvoice(card, invoice);
    });
    await settle();
    const extra = `${invoiceCsv()}\n${iso(PURCHASE_DAY)},lazer,Cinema,30.00`;

    const { plan, result } = await importInvoiceFile(card, extra);

    expect(plan!.blocked).toContain("já está paga");
    expect(result).toMatchObject({ ok: false });
    expect(await getAllCardPurchases()).toHaveLength(2);
  });
});

describe("extrato e fatura sem lançar duas vezes", () => {
  it("o pagamento feito pelo app não entra de novo quando o extrato traz o mesmo débito", async () => {
    await mountApp();
    const card = await addCard();
    await importInvoiceFile(card, invoiceCsv());
    const invoice = seen.cards.views[0].invoices.find((item) => item.total > 0)!;
    await act(async () => {
      await seen.cards.payInvoice(card, invoice);
    });
    await settle();
    expect(await getAllTransactions()).toHaveLength(1);

    await mountApp(); // painel relido, como ao abrir o app
    const today = formatDateToString(new Date());
    await pickStatement(statementCsv(today, "Pagamento de fatura Inter", "-100.00"));

    expect(seen.transfer.pendingImport).toBeNull();
    expect(seen.alert.alertTitle).toBe("Nada para importar");
    expect(await getAllTransactions()).toHaveLength(1);
  });

  it("o pagamento que só está no extrato marca a fatura como paga, sem criar outra despesa avulsa", async () => {
    await mountApp();
    const card = await addCard();
    await importInvoiceFile(card, invoiceCsv());
    expect(seen.cards.views[0].invoices.find((item) => item.total > 0)!.status).toBe("overdue");

    await pickStatement(statementCsv(invoiceDue(card), "Pagamento de fatura Inter", "-100.00"));

    expect(seen.transfer.pendingImport?.cardPaymentsLinked).toBe(1);
    await act(async () => {
      await seen.transfer.confirmImport();
    });
    await settle();

    const [expense] = await getAllTransactions();
    expect(expense).toMatchObject({ amount: 100, type: "expense", category_id: "Cartão de crédito" });
    const [payment] = await getAllCardPayments();
    expect(payment).toMatchObject({ card_id: card.id, amount: 100, transaction_id: expense.id });

    // Importar o mesmo extrato outra vez não repete.
    await pickStatement(statementCsv(invoiceDue(card), "Pagamento de fatura Inter", "-100.00"));
    expect(seen.transfer.pendingImport).toBeNull();
    expect(await getAllTransactions()).toHaveLength(1);
  });

  it("um débito que não bate com a fatura entra como despesa comum", async () => {
    await mountApp();
    const card = await addCard();
    await importInvoiceFile(card, invoiceCsv());

    await pickStatement(statementCsv(invoiceDue(card), "Pagamento de fatura Inter", "-99.00"));
    await act(async () => {
      await seen.transfer.confirmImport();
    });
    await settle();

    expect(await getAllCardPayments()).toEqual([]);
    expect(await getAllTransactions()).toHaveLength(1);
  });

  it("extrato importado antes da fatura: ao ler a fatura, o pagamento é reconhecido e nada é duplicado", async () => {
    await mountApp();
    const card = await addCard();
    await pickStatement(statementCsv(invoiceDue(card), "Pagamento de fatura Inter", "-100.00"));
    await act(async () => {
      await seen.transfer.confirmImport();
    });
    await settle();
    expect(await getAllTransactions()).toHaveLength(1);

    const { plan, result } = await importInvoiceFile(card, invoiceCsv());

    expect(plan!.paymentMatch).toMatchObject({ amount: 100 });
    expect(result).toEqual({ ok: true });
    const [expense] = await getAllTransactions();
    expect((await getAllCardPayments())[0]).toMatchObject({ transaction_id: expense.id, amount: 100 });
    expect(await getAllTransactions()).toHaveLength(1);
    expect(seen.cards.views[0].invoices.find((item) => item.total > 0)!.status).toBe("paid");
  });
});
