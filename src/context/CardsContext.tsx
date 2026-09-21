import { createContext, useEffect, useState, type ReactNode } from "react";

import { getAllCardPayments, getAllCardPurchases, getAllCreditCards, reconcileCardTransactions } from "../database/creditCards";
import { subscribeToCardChanges } from "../services/cardsEvents";
import { unpaidInvoiceDues, type InvoiceDue } from "../utils/creditCards";
import { logError } from "../utils/logger";
import { useTransactionsMutations } from "./TransactionsContext";
import { useRequiredContext } from "./useRequiredContext";

interface CardsContextValue {
  /** Faturas de cartão por pagar, da que vence primeiro para a que vence depois. */
  invoiceDues: InvoiceDue[];
}

const CardsContext = createContext<CardsContextValue | null>(null);

async function readInvoiceDues(): Promise<InvoiceDue[]> {
  const [cards, purchases, payments] = await Promise.all([getAllCreditCards(), getAllCardPurchases(), getAllCardPayments()]);
  return unpaidInvoiceDues({ cards, purchases, payments, today: new Date() });
}

/**
 * As faturas por pagar, para os avisos do Início e os lembretes. A tela de cartões fica fora do painel:
 * quando ela grava algo, este provider relê as faturas e as transações (cada compra do cartão é uma despesa).
 */
export function CardsProvider({ children }: { children: ReactNode }) {
  const { refreshTransactions } = useTransactionsMutations();
  const [invoiceDues, setInvoiceDues] = useState<InvoiceDue[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      readInvoiceDues()
        .then((dues) => {
          if (!cancelled) setInvoiceDues(dues);
        })
        .catch((error) => logError("Erro ao ler as faturas de cartão:", error));

    load();
    // Deixa as despesas coerentes com as compras do cartão (compras antigas ganham a despesa, o pagamento de fatura de
    // uma versão anterior perde a dele) e relê as transações se algo mudou.
    reconcileCardTransactions()
      .then((changed) => {
        if (changed > 0) {
          load();
          return refreshTransactions();
        }
      })
      .catch((error) => logError("Erro ao conciliar as compras do cartão com as despesas:", error));
    const unsubscribe = subscribeToCardChanges(() => {
      load();
      refreshTransactions().catch((error) => logError("Erro ao atualizar as transações após mexer nos cartões:", error));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refreshTransactions]);

  return <CardsContext.Provider value={{ invoiceDues }}>{children}</CardsContext.Provider>;
}

export function useCardsContext() {
  return useRequiredContext(CardsContext, "useCardsContext", "CardsProvider");
}
