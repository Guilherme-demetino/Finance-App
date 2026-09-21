import { useEffect } from "react";

import { useDebtsContext } from "../../context/DebtsContext";
import { useTransactionsData } from "../../context/TransactionsContext";
import { syncDueReminders } from "../../services/dueReminders";
import { realDueReminderDeps } from "../../services/dueRemindersDeps";
import { logError } from "../../utils/logger";

// Espera as mudanças assentarem (ex.: salvar uma série de parcelas recarrega várias vezes).
const SYNC_DELAY_MS = 1500;

/**
 * Mantém os lembretes de vencimento agendados iguais aos dados: roda quando o painel
 * abre e de novo sempre que dívidas ou transações mudam. Não desenha nada, e o serviço
 * lê o banco por conta própria (os dados do contexto só avisam que algo mudou).
 */
export function DueRemindersRunner() {
  const { pendingDebts } = useDebtsContext();
  const { transactions } = useTransactionsData();

  useEffect(() => {
    const timer = setTimeout(() => {
      syncDueReminders(realDueReminderDeps).catch((error) =>
        logError("Erro ao agendar os lembretes de vencimento:", error),
      );
    }, SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pendingDebts, transactions]);

  return null;
}
