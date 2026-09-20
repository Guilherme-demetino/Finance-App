import { useEffect } from "react";

import { useBudgetData } from "../../context/BudgetContext";
import { useTransactionsData } from "../../context/TransactionsContext";
import { runBudgetAlerts } from "../../services/budgetAlerts";
import { realBudgetAlertDeps } from "../../services/budgetAlertsDeps";
import { logError } from "../../utils/logger";

// Espera as mudanças assentarem (ex.: salvar uma série de parcelas recarrega várias vezes).
const CHECK_DELAY_MS = 1500;

/**
 * Confere os limites do mês (orçamento e metas por categoria) depois de qualquer mudança em
 * transações, metas ou orçamento, e avisa por notificação se algum chegou perto ou estourou.
 * Não desenha nada. O serviço lê o banco por conta própria e sempre olha o mês de hoje, mesmo
 * que você esteja navegando por outro mês: os dados do contexto só avisam que algo mudou.
 */
export function BudgetAlertsRunner() {
  const { transactions } = useTransactionsData();
  const { budget, categoryBudgets } = useBudgetData();

  useEffect(() => {
    const timer = setTimeout(() => {
      runBudgetAlerts(realBudgetAlertDeps).catch((error) =>
        logError("Erro ao conferir os alertas de orçamento:", error),
      );
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [transactions, budget, categoryBudgets]);

  return null;
}
