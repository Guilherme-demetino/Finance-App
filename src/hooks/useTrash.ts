import { useCallback, useEffect, useState } from "react";
import {
  getDeletedTransactions,
  permanentlyDeleteTransaction,
  restoreTransaction,
} from "../database/transactions";
import type { TransactionRow } from "../types";
import { logError } from "../utils/logger";
import { notifyCardsChanged } from "../services/cardsEvents";

/** As transações na Lixeira (excluídas, dentro do prazo) e as ações de restaurar/apagar de vez. */
export function useTrash() {
  const [items, setItems] = useState<TransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setItems(await getDeletedTransactions());
    } catch (error) {
      logError("Erro ao ler a Lixeira de transações:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carga inicial: sem chamar `refresh` (ela liga o "carregando" na hora, de novo — o estado já começa assim).
  useEffect(() => {
    let cancelled = false;
    getDeletedTransactions()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((error) => logError("Erro ao ler a Lixeira de transações:", error))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const restore = async (id: number) => {
    await restoreTransaction(id);
    await refresh();
    notifyCardsChanged();
  };

  const removeForever = async (id: number) => {
    await permanentlyDeleteTransaction(id);
    await refresh();
    notifyCardsChanged();
  };

  return { items, isLoading, refresh, restore, removeForever };
}
