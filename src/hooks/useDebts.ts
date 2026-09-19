import { useEffect, useState } from "react";
import {
  createDebt,
  deleteDebt,
  getAllDebts,
  markDebtAsSettled,
  type DebtInput,
} from "../database/debts";
import type { DebtRow } from "../types";

/**
 * Dívidas/empréstimos entre você e outras pessoas — ficam fora do fluxo
 * normal de receita/despesa enquanto pendentes. Só entram no cálculo do
 * saldo quando quitadas (ver handleSettleDebt no DashboardContext, que
 * cria a transação correspondente nesse momento).
 */
export function useDebts() {
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [isLoadingDebts, setIsLoadingDebts] = useState(true);

  const refreshDebts = async () => {
    setIsLoadingDebts(true);
    try {
      const rows = await getAllDebts();
      setDebts(rows);
    } catch (error) {
      console.log("Erro ao buscar dívidas:", error);
    } finally {
      setIsLoadingDebts(false);
    }
  };

  useEffect(() => {
    // isLoadingDebts já começa true, então aqui só busca (sem setState síncrono).
    let cancelled = false;
    getAllDebts()
      .then((rows) => {
        if (!cancelled) setDebts(rows);
      })
      .catch((error) => console.log("Erro ao buscar dívidas:", error))
      .finally(() => {
        if (!cancelled) setIsLoadingDebts(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addDebt = async (data: DebtInput) => {
    await createDebt(data);
    await refreshDebts();
  };

  const settleDebt = async (id: number, settledDate: string) => {
    await markDebtAsSettled(id, settledDate);
    await refreshDebts();
  };

  const removeDebt = async (id: number) => {
    await deleteDebt(id);
    await refreshDebts();
  };

  const pendingDebts = debts.filter((d) => d.status === "pending");
  const settledDebts = debts.filter((d) => d.status === "settled");

  const totalToReceive = pendingDebts
    .filter((d) => d.type === "lent")
    .reduce((sum, d) => sum + d.amount, 0);

  const totalToPay = pendingDebts
    .filter((d) => d.type === "borrowed")
    .reduce((sum, d) => sum + d.amount, 0);

  return {
    pendingDebts,
    settledDebts,
    totalToReceive,
    totalToPay,
    isLoadingDebts,
    addDebt,
    settleDebt,
    removeDebt,
  };
}
