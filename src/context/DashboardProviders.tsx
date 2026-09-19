import type { ReactNode } from "react";

import { AlertProvider } from "./AlertContext";
import { BudgetProvider } from "./BudgetContext";
import { DashboardUiProvider } from "./DashboardUiContext";
import { DebtsProvider } from "./DebtsContext";
import { PeriodProvider } from "./PeriodContext";
import { ProfileProvider } from "./ProfileContext";
import { SavingsProvider } from "./SavingsContext";
import { TransactionFormProvider } from "./TransactionFormContext";
import { TransactionsProvider } from "./TransactionsContext";

/**
 * Estado do dashboard dividido por domínio. A ordem importa: cada provider
 * só lê os de fora dele (alerta → período → transações → orçamento/dívidas/
 * metas/perfil → formulário). Assim uma mudança num domínio só re-renderiza
 * quem consome aquele domínio.
 */
export function DashboardProviders({ children }: { children: ReactNode }) {
  return (
    <AlertProvider>
      <PeriodProvider>
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
    </AlertProvider>
  );
}
