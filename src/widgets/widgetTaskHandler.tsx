import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import { loadMonthBalance, loadUpcomingBills } from "../services/widgetDataDeps";
import { logError } from "../utils/logger";
import { MonthBalanceWidget } from "./MonthBalanceWidget";
import { UpcomingBillsWidget } from "./UpcomingBillsWidget";

const REFRESH_ACTIONS = new Set(["WIDGET_ADDED", "WIDGET_UPDATE", "WIDGET_RESIZED"]);

/**
 * Roda fora do app (tarefa headless do Android, sem a árvore React montada) sempre que o sistema cria,
 * atualiza periodicamente ou redimensiona um widget. Cada widget lê o banco por conta própria.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (!REFRESH_ACTIONS.has(props.widgetAction)) return;

  try {
    if (props.widgetInfo.widgetName === "MonthBalance") {
      props.renderWidget(<MonthBalanceWidget {...(await loadMonthBalance())} />);
    } else if (props.widgetInfo.widgetName === "UpcomingBills") {
      props.renderWidget(<UpcomingBillsWidget items={await loadUpcomingBills()} />);
    }
  } catch (error) {
    logError("Erro ao atualizar o widget da tela inicial:", error);
  }
}
