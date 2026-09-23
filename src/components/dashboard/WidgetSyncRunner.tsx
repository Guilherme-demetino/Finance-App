import { useEffect } from "react";
import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";

import { useCardsContext } from "../../context/CardsContext";
import { useDebtsContext } from "../../context/DebtsContext";
import { useTransactionsData } from "../../context/TransactionsContext";
import { loadMonthBalance, loadUpcomingBills } from "../../services/widgetDataDeps";
import { logError } from "../../utils/logger";
import { MonthBalanceWidget } from "../../widgets/MonthBalanceWidget";
import { UpcomingBillsWidget } from "../../widgets/UpcomingBillsWidget";

// Espera as mudanças assentarem (ex.: salvar uma série de parcelas recarrega várias vezes).
const SYNC_DELAY_MS = 1500;

/**
 * Mantém os widgets de tela inicial (saldo do mês e próximas contas) iguais aos dados: roda quando o
 * painel abre e de nova sempre que dívidas, faturas de cartão ou transações mudam. Não desenha nada;
 * só Android tem widget de tela inicial.
 */
export function WidgetSyncRunner() {
  const { pendingDebts } = useDebtsContext();
  const { transactions } = useTransactionsData();
  const { invoiceDues } = useCardsContext();

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const timer = setTimeout(() => {
      requestWidgetUpdate({
        widgetName: "MonthBalance",
        renderWidget: async () => <MonthBalanceWidget {...(await loadMonthBalance())} />,
      }).catch((error) => logError("Erro ao atualizar o widget de saldo do mês:", error));

      requestWidgetUpdate({
        widgetName: "UpcomingBills",
        renderWidget: async () => <UpcomingBillsWidget items={await loadUpcomingBills()} />,
      }).catch((error) => logError("Erro ao atualizar o widget de próximas contas:", error));
    }, SYNC_DELAY_MS);

    return () => clearTimeout(timer);
  }, [pendingDebts, transactions, invoiceDues]);

  return null;
}
