import { useEffect, useState } from "react";
import { ACCENT_COLORS } from "../constants/colors";
import { createAccount, DEFAULT_ACCOUNT_NAME, deleteAccount, getAllAccounts } from "../database/accounts";
import type { AccountRow } from "../types";
import { logError } from "../utils/logger";

/** Uma opção pra escolher conta: `id` null é a conta padrão implícita (nenhuma foi criada com esse nome ainda). */
export interface AccountOption {
  id: number | null;
  name: string;
  color: string;
}

/** As contas cadastradas, garantindo que a padrão sempre apareça como opção mesmo sem existir formalmente ainda. */
export function accountOptions(accounts: AccountRow[]): AccountOption[] {
  const hasDefault = accounts.some(
    (account) => account.name.trim().toLowerCase() === DEFAULT_ACCOUNT_NAME.toLowerCase(),
  );
  const options: AccountOption[] = accounts.map((account) => ({ id: account.id, name: account.name, color: account.color }));
  if (!hasDefault) options.unshift({ id: null, name: DEFAULT_ACCOUNT_NAME, color: ACCENT_COLORS.accent });
  return options;
}

/** Contas/carteiras cadastradas e as ações de criar/excluir (ver database/accounts). */
export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    try {
      setAccounts(await getAllAccounts());
    } catch (error) {
      logError("Erro ao buscar contas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getAllAccounts()
      .then((rows) => {
        if (!cancelled) setAccounts(rows);
      })
      .catch((error) => logError("Erro ao buscar contas:", error))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const create = async (name: string, color: string) => {
    await createAccount(name, color);
    await refresh();
  };

  const remove = async (id: number) => {
    await deleteAccount(id);
    await refresh();
  };

  return { accounts, options: accountOptions(accounts), isLoading, create, remove, refresh };
}
