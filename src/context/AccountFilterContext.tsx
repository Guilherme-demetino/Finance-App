import { createContext, useMemo, useState, type ReactNode } from "react";
import { useRequiredContext } from "./useRequiredContext";

interface AccountFilterContextValue {
  /** null = todas as contas juntas (o padrão). */
  selectedAccount: string | null;
  setSelectedAccount: (value: string | null) => void;
}

const AccountFilterContext = createContext<AccountFilterContextValue | null>(null);

/** Qual conta o painel está mostrando (Início, Orçamento e Histórico) — "todas" por padrão. */
export function AccountFilterProvider({ children }: { children: ReactNode }) {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const value = useMemo(
    () => ({ selectedAccount, setSelectedAccount }),
    [selectedAccount],
  );

  return <AccountFilterContext.Provider value={value}>{children}</AccountFilterContext.Provider>;
}

export function useAccountFilter() {
  return useRequiredContext(AccountFilterContext, "useAccountFilter", "AccountFilterProvider");
}
