import { createContext, useEffect, useState, type ReactNode } from "react";

import {
  applyDetectedPrice,
  createSubscription,
  deleteSubscription,
  getAllPriceChanges,
  getAllSubscriptions,
  ignoreDetectedPrice,
  setSubscriptionActive,
  updateSubscription,
} from "../database/subscriptions";
import { getAllTransactions } from "../database/transactions";
import type { SubscriptionPriceChangeRow, SubscriptionRow, TransactionRow } from "../types";
import { formatDateToString } from "../utils/dates";
import { logError } from "../utils/logger";
import {
  detectPriceChanges,
  summarizeSubscriptions,
  validateSubscription,
  type PriceAlert,
  type SubscriptionInput,
  type SubscriptionsSummary,
} from "../utils/subscriptions";
import { useTransactionsData } from "./TransactionsContext";
import { useRequiredContext } from "./useRequiredContext";

export type SubscriptionActionResult = { ok: true } | { ok: false; error: string };

interface SubscriptionsContextValue {
  subscriptions: SubscriptionRow[];
  priceChanges: SubscriptionPriceChangeRow[];
  summary: SubscriptionsSummary;
  /** Reajustes achados nas despesas: a cobrança mais recente veio diferente do valor cadastrado. */
  alerts: PriceAlert[];
  isLoading: boolean;
  saveSubscription: (id: number | null, input: SubscriptionInput) => Promise<SubscriptionActionResult>;
  removeSubscription: (id: number) => Promise<SubscriptionActionResult>;
  toggleActive: (subscription: SubscriptionRow) => Promise<SubscriptionActionResult>;
  /** Aceita o reajuste: o valor cadastrado passa a ser o da cobrança. */
  acceptPriceAlert: (alert: PriceAlert) => Promise<SubscriptionActionResult>;
  /** Ignora essa cobrança diferente (outro valor diferente alerta de novo). */
  ignorePriceAlert: (alert: PriceAlert) => Promise<SubscriptionActionResult>;
}

const SubscriptionsContext = createContext<SubscriptionsContextValue | null>(null);

interface Loaded {
  subscriptions: SubscriptionRow[];
  priceChanges: SubscriptionPriceChangeRow[];
  allTransactions: TransactionRow[];
}

const EMPTY: Loaded = { subscriptions: [], priceChanges: [], allTransactions: [] };

// Fora do componente: o lint do React Compiler não aceita `new Date()` direto na renderização.
const now = () => new Date();
const today = () => formatDateToString(now());

async function readAll(): Promise<Loaded> {
  const [subscriptions, priceChanges, allTransactions] = await Promise.all([getAllSubscriptions(), getAllPriceChanges(), getAllTransactions()]);
  return { subscriptions, priceChanges, allTransactions };
}

const OK: SubscriptionActionResult = { ok: true };
const fail = (error: string): SubscriptionActionResult => ({ ok: false, error });

/**
 * Assinaturas recorrentes e o alerta de reajuste. O alerta compara o valor cadastrado com a cobrança mais recente que
 * aparece nas despesas (cartão ou extrato), então relê tudo quando as transações do painel mudam.
 */
export function SubscriptionsProvider({ children }: { children: ReactNode }) {
  const { transactions } = useTransactionsData();
  const [data, setData] = useState<Loaded>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    readAll()
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch((error) => logError("Erro ao ler as assinaturas:", error))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [transactions]);

  const reload = async () => setData(await readAll());

  /** Roda uma gravação, relê tudo e devolve o erro em texto em vez de lançar. */
  const perform = async (write: () => Promise<void>, failure: string): Promise<SubscriptionActionResult> => {
    try {
      await write();
      await reload();
      return OK;
    } catch (error) {
      logError(failure, error);
      return fail(failure);
    }
  };

  const saveSubscription = async (id: number | null, input: SubscriptionInput): Promise<SubscriptionActionResult> => {
    const problem = validateSubscription(input);
    if (problem) return fail(problem);
    const payload = { ...input, amount: input.amount as number };
    return perform(async () => {
      if (id === null) await createSubscription(payload, today());
      else await updateSubscription(id, payload, today());
    }, "Não foi possível salvar a assinatura.");
  };

  const removeSubscription = (id: number) => perform(() => deleteSubscription(id), "Não foi possível excluir a assinatura.");

  const toggleActive = (subscription: SubscriptionRow) =>
    perform(() => setSubscriptionActive(subscription.id, subscription.active !== 1), "Não foi possível mudar a situação da assinatura.");

  const acceptPriceAlert = (alert: PriceAlert) =>
    perform(() => applyDetectedPrice(alert.subscriptionId, alert.newAmount, alert.chargeDate), "Não foi possível atualizar o valor.");

  const ignorePriceAlert = (alert: PriceAlert) =>
    perform(() => ignoreDetectedPrice(alert.subscriptionId, alert.newAmount), "Não foi possível ignorar o alerta.");

  const value: SubscriptionsContextValue = {
    subscriptions: data.subscriptions,
    priceChanges: data.priceChanges,
    summary: summarizeSubscriptions(data.subscriptions),
    alerts: detectPriceChanges(data.subscriptions, data.allTransactions, now()),
    isLoading,
    saveSubscription,
    removeSubscription,
    toggleActive,
    acceptPriceAlert,
    ignorePriceAlert,
  };

  return <SubscriptionsContext.Provider value={value}>{children}</SubscriptionsContext.Provider>;
}

export function useSubscriptionsContext() {
  return useRequiredContext(SubscriptionsContext, "useSubscriptionsContext", "SubscriptionsProvider");
}
