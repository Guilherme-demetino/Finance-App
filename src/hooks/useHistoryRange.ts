import { useEffect, useState } from "react";

import { getAllCategories } from "../database/categories";
import { getTransactionsInRange } from "../database/transactions";
import type { DisplayTransaction } from "../types";
import type { DateRange } from "../utils/historyFilters";
import { logError } from "../utils/logger";
import { toDisplayTransaction } from "../utils/transactionDisplay";
import { enrichTransactions } from "./useTransactions";

interface Loaded {
  key: string;
  signal: unknown;
  items: DisplayTransaction[];
  failed: boolean;
}

/**
 * As transações de um período personalizado (que pode atravessar meses e anos e por isso não
 * vem do mês carregado pelo painel). Sem período, não faz nada. `reloadSignal` muda quando as
 * transações mudam (salvar, editar, excluir): o período é lido de novo.
 */
export function useHistoryRange(period: DateRange | null, reloadSignal: unknown) {
  const from = period?.from ?? null;
  const to = period?.to ?? null;
  const key = from !== null && to !== null ? `${from}|${to}` : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (from === null || to === null || key === null) return;
    let cancelled = false;
    Promise.all([getTransactionsInRange({ from, to }), getAllCategories()])
      .then(([rows, categories]) => {
        if (cancelled) return;
        setLoaded({
          key,
          signal: reloadSignal,
          items: enrichTransactions(rows, categories).map(toDisplayTransaction),
          failed: false,
        });
      })
      .catch((error) => {
        logError("Erro ao buscar transações do período:", error);
        if (!cancelled) setLoaded({ key, signal: reloadSignal, items: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, key, reloadSignal]);

  const isCurrent = key !== null && loaded !== null && loaded.key === key && loaded.signal === reloadSignal;
  return {
    items: key !== null && loaded !== null && loaded.key === key ? loaded.items : [],
    isLoading: key !== null && !isCurrent,
    hasError: isCurrent && loaded.failed,
  };
}
