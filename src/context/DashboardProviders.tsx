import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { AlertProvider } from "./AlertContext";
import { BudgetProvider } from "./BudgetContext";
import { DashboardUiProvider } from "./DashboardUiContext";
import { DebtsProvider } from "./DebtsContext";
import { PeriodProvider } from "./PeriodContext";
import { ProfileProvider } from "./ProfileContext";
import { SavingsProvider } from "./SavingsContext";
import { TransactionFormProvider } from "./TransactionFormContext";
import { TransactionsProvider } from "./TransactionsContext";

const ReloadContext = createContext<(() => void) | null>(null);

/**
 * Estado do dashboard dividido por domínio. A ordem importa: cada provider
 * só lê os de fora dele (alerta → período → transações → orçamento/dívidas/
 * metas/perfil → formulário). Assim uma mudança num domínio só re-renderiza
 * quem consome aquele domínio.
 */
export function DashboardProviders({ children }: { children: ReactNode }) {
  // Trocar a chave desmonta e remonta tudo abaixo do aviso, então todos os
  // dados são lidos do banco de novo. Usado depois de restaurar um backup.
  const [epoch, setEpoch] = useState(0);
  const reload = useCallback(() => setEpoch((current) => current + 1), []);

  return (
    <AlertProvider>
      <ReloadContext.Provider value={reload}>
        <PeriodProvider key={epoch}>
          <TransactionsProvider>
            <BudgetProvider>
              <DebtsProvider>
                <SavingsProvider>
                  <ProfileProvider>
                    <DashboardUiProvider>
                      <TransactionFormProvider>
                        {children}
                      </TransactionFormProvider>
                    </DashboardUiProvider>
                  </ProfileProvider>
                </SavingsProvider>
              </DebtsProvider>
            </BudgetProvider>
          </TransactionsProvider>
        </PeriodProvider>
      </ReloadContext.Provider>
    </AlertProvider>
  );
}

/** Faz o painel ler tudo do banco de novo (o aviso em tela continua). */
export function useReloadDashboard() {
  const reload = useContext(ReloadContext);
  if (reload === null) {
    throw new Error(
      "useReloadDashboard deve ser usado dentro de DashboardProviders",
    );
  }
  return reload;
}
