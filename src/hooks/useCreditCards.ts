import { useEffect, useState } from "react";

import { DEFAULT_EXPENSE_CATEGORIES, PIX_CATEGORY } from "../constants/categories";
import { getAllCategories } from "../database/categories";
import {
  addCardPurchases,
  createCreditCard,
  deleteCardPurchase,
  deleteCardPurchases,
  deleteCreditCard,
  getAllCardPayments,
  getAllCardPurchases,
  getAllCreditCards,
  importCardPurchases,
  payInvoice as payInvoiceInDb,
  undoInvoicePayment,
  updateCardPurchase,
  updateCreditCard,
  type CreditCardInput,
} from "../database/creditCards";
import { getAllTransactions } from "../database/transactions";
import { notifyCardsChanged } from "../services/cardsEvents";
import { pickFileBytes } from "../services/pickFileBytes";
import type { CardPaymentRow, CardPurchaseRow, CreditCardRow, TransactionRow } from "../types";
import type { CardImportPlan } from "../utils/cardImport";
import {
  cardUsage,
  invoiceRefFor,
  listInvoices,
  planPurchase,
  purchaseBlockedByPayment,
  validateCard,
  validatePurchase,
  type CardUsage,
  type Invoice,
} from "../utils/creditCards";
import { formatDateToString } from "../utils/dates";
import { logError } from "../utils/logger";
import { planImportFromBytes } from "../utils/statements/statementImport";
import type { ImportedTransaction } from "../utils/statements/importCsv";

export type ActionResult = { ok: true } | { ok: false; error: string };

const OK: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });

const PAID_INVOICE_MESSAGE = "Essa compra está numa fatura já paga. Desfaça o pagamento da fatura antes de mexer nela.";

export interface CardView {
  card: CreditCardRow;
  usage: CardUsage;
  /** Faturas do cartão: as por pagar primeiro (da mais próxima), depois as pagas (da mais recente). */
  invoices: Invoice[];
}

export interface PurchaseFormData {
  description: string;
  amount: number | null;
  date: Date;
  category: string;
  installments: number;
}

/** O que a leitura do arquivo da fatura devolveu. */
export type InvoiceFileRead =
  | { status: "cancelled" }
  | { status: "error"; error: string }
  | { status: "ready"; candidates: ImportedTransaction[]; transactions: TransactionRow[] };

interface Loaded {
  cards: CreditCardRow[];
  purchases: CardPurchaseRow[];
  payments: CardPaymentRow[];
}

// Fora do componente: o lint do React Compiler não aceita Date.now()/Math.random() direto num componente ou hook.
const newGroupId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date();

async function readAll(): Promise<Loaded> {
  const [cards, purchases, payments] = await Promise.all([getAllCreditCards(), getAllCardPurchases(), getAllCardPayments()]);
  return { cards, purchases, payments };
}

/** Categorias de despesa para uma compra no cartão: as padrão, as suas e "Outros". */
async function readCategoryOptions(): Promise<string[]> {
  const custom = (await getAllCategories()).filter((row) => row.type === "expense").map((row) => row.name);
  const all = [...DEFAULT_EXPENSE_CATEGORIES.filter((name) => name !== PIX_CATEGORY), ...custom, "Outros"];
  return [...new Set(all.filter((name) => name.trim() !== ""))];
}

function orderInvoices(invoices: Invoice[]): Invoice[] {
  const open = invoices.filter((invoice) => invoice.status !== "paid");
  const paid = invoices.filter((invoice) => invoice.status === "paid").reverse();
  return [...open, ...paid];
}

/** Cartões de crédito, as faturas e as compras de cada um, e as ações da tela de cartões. */
export function useCreditCards() {
  const [data, setData] = useState<Loaded | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([...DEFAULT_EXPENSE_CATEGORIES, "Outros"]);

  useEffect(() => {
    let cancelled = false;
    readAll()
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch((error) => {
        logError("Erro ao ler os cartões:", error);
        if (!cancelled) setData({ cards: [], purchases: [], payments: [] });
      });
    readCategoryOptions()
      .then((names) => {
        if (!cancelled) setCategoryOptions(names);
      })
      .catch((error) => logError("Erro ao ler as categorias dos cartões:", error));
    return () => {
      cancelled = true;
    };
  }, []);

  const loaded = data ?? { cards: [], purchases: [], payments: [] };
  const today = now();
  const views: CardView[] = loaded.cards.map((card) => ({
    card,
    usage: cardUsage(card, loaded.purchases, loaded.payments),
    invoices: orderInvoices(listInvoices({ card, purchases: loaded.purchases, payments: loaded.payments, today })),
  }));

  /** Depois de gravar: relê tudo e avisa o painel (saldo e avisos do Início). */
  const afterWrite = async () => {
    setData(await readAll());
    notifyCardsChanged();
  };

  /** Roda uma gravação, devolvendo o erro em texto em vez de lançar. */
  const perform = async (write: () => Promise<void>, failure: string): Promise<ActionResult> => {
    try {
      await write();
      await afterWrite();
      return OK;
    } catch (error) {
      logError(failure, error);
      return fail(error instanceof Error && error.message === "Essa fatura já está paga." ? error.message : failure);
    }
  };

  const paidRefsOf = (cardId: number) =>
    new Set(loaded.payments.filter((payment) => payment.card_id === cardId).map((payment) => payment.invoice_ref));

  const saveCard = async (id: number | null, input: CreditCardInput): Promise<ActionResult> => {
    const problem = validateCard(input);
    if (problem) return fail(problem);
    return perform(async () => {
      if (id === null) await createCreditCard(input);
      else await updateCreditCard(id, input);
    }, "Não foi possível salvar o cartão.");
  };

  const removeCard = (id: number): Promise<ActionResult> =>
    perform(() => deleteCreditCard(id), "Não foi possível excluir o cartão.");

  const addPurchase = async (card: CreditCardRow, form: PurchaseFormData): Promise<ActionResult> => {
    const problem = validatePurchase({ description: form.description, amount: form.amount, installments: form.installments });
    if (problem) return fail(problem);
    const rows = planPurchase({
      card,
      description: form.description,
      totalAmount: form.amount as number,
      date: form.date,
      category: form.category,
      installments: form.installments,
      groupId: newGroupId(),
    });
    const blocked = purchaseBlockedByPayment(
      rows.map((row) => row.invoice_ref),
      loaded.payments,
      card.id,
    );
    if (blocked) return fail(blocked);
    return perform(() => addCardPurchases(rows), "Não foi possível salvar a compra.");
  };

  /** Edita uma compra (uma parcela é uma compra). A data só muda em compras à vista: parcelas ficam onde estão. */
  const editPurchase = async (
    purchase: CardPurchaseRow,
    card: CreditCardRow,
    form: { description: string; amount: number | null; date: Date; category: string },
  ): Promise<ActionResult> => {
    const problem = validatePurchase({ description: form.description, amount: form.amount, installments: 1 });
    if (problem) return fail(problem);
    const paid = paidRefsOf(card.id);
    if (paid.has(purchase.invoice_ref)) return fail(PAID_INVOICE_MESSAGE);

    const isInstallment = purchase.installment_group_id !== null;
    const date = isInstallment ? purchase.date : formatDateToString(form.date);
    const invoiceRef = isInstallment ? purchase.invoice_ref : invoiceRefFor(form.date, card);
    const blocked = purchaseBlockedByPayment([invoiceRef], loaded.payments, card.id);
    if (blocked) return fail(blocked);

    return perform(
      () =>
        updateCardPurchase(purchase.id, {
          description: form.description,
          amount: form.amount as number,
          date,
          category: form.category,
          invoiceRef,
        }),
      "Não foi possível salvar a compra.",
    );
  };

  const removePurchase = async (purchase: CardPurchaseRow): Promise<ActionResult> => {
    if (paidRefsOf(purchase.card_id).has(purchase.invoice_ref)) return fail(PAID_INVOICE_MESSAGE);
    return perform(() => deleteCardPurchase(purchase.id), "Não foi possível excluir a compra.");
  };

  /** Apaga as parcelas ainda não pagas de uma compra parcelada (as de faturas pagas ficam). */
  const removeInstallments = async (purchase: CardPurchaseRow): Promise<ActionResult> => {
    const groupId = purchase.installment_group_id;
    if (groupId === null) return removePurchase(purchase);
    const paid = paidRefsOf(purchase.card_id);
    const ids = loaded.purchases
      .filter((row) => row.installment_group_id === groupId && !paid.has(row.invoice_ref))
      .map((row) => row.id);
    if (ids.length === 0) return fail(PAID_INVOICE_MESSAGE);
    return perform(() => deleteCardPurchases(ids), "Não foi possível excluir as parcelas.");
  };

  /** A fatura (aberta, fechada ou vencida) vira uma despesa "Cartão de crédito" no saldo, na data de hoje. */
  const payInvoice = async (card: CreditCardRow, invoice: Invoice): Promise<ActionResult> => {
    if (invoice.status !== "open" && invoice.status !== "closed" && invoice.status !== "overdue") return fail("Não há o que pagar nessa fatura.");
    return perform(
      () =>
        payInvoiceInDb({
          cardId: card.id,
          cardName: card.name,
          ref: invoice.ref,
          amount: invoice.total,
          paidDate: formatDateToString(now()),
        }),
      "Não foi possível pagar a fatura.",
    );
  };

  const undoPayment = (card: CreditCardRow, invoice: Invoice): Promise<ActionResult> =>
    perform(() => undoInvoicePayment(card.id, invoice.ref), "Não foi possível desfazer o pagamento.");

  /** Escolhe o arquivo da fatura (PDF, CSV ou planilha) e lê as linhas dele. Nada é gravado aqui. */
  const readInvoiceFile = async (): Promise<InvoiceFileRead> => {
    try {
      const bytes = await pickFileBytes();
      if (bytes === null) return { status: "cancelled" };
      const result = await planImportFromBytes(bytes, []);
      if (!result.ok) return { status: "error", error: result.error };
      if (result.plan.toImport.length === 0) {
        return { status: "error", error: "Não encontrei nenhuma compra nesse arquivo. Confira se é a fatura do cartão (PDF ou CSV)." };
      }
      return { status: "ready", candidates: result.plan.toImport, transactions: await getAllTransactions() };
    } catch (error) {
      logError("Erro ao ler o arquivo da fatura:", error);
      return { status: "error", error: "Não foi possível ler o arquivo selecionado." };
    }
  };

  /** Grava o que a leitura montou (ver planCardImport); se um débito do extrato já pagou a fatura, marca-a como paga. */
  const importInvoice = async (card: CreditCardRow, plan: CardImportPlan): Promise<ActionResult> => {
    if (plan.blocked) return fail(plan.blocked);
    if (plan.rows.length === 0 && plan.paymentMatch === null) return fail("Não há compras novas para importar.");
    const match = plan.paymentMatch;
    return perform(
      () =>
        importCardPurchases(
          plan.rows,
          match ? { cardId: card.id, ref: plan.ref, transactionId: match.transactionId, paidDate: match.date, amount: match.amount } : null,
        ),
      "Não foi possível importar a fatura.",
    );
  };

  return {
    isLoading: data === null,
    views,
    purchases: loaded.purchases,
    payments: loaded.payments,
    categoryOptions,
    saveCard,
    removeCard,
    addPurchase,
    editPurchase,
    removePurchase,
    removeInstallments,
    payInvoice,
    undoPayment,
    readInvoiceFile,
    importInvoice,
  };
}
