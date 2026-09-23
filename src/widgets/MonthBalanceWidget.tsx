"use no memo";

import { FlexWidget, TextWidget } from "react-native-android-widget";

import type { MonthBalanceData } from "../utils/widgetData";
import { WIDGET_COLORS } from "./colors";

/**
 * Widget de tela inicial "Saldo do mês". Roda fora da árvore React (React Compiler não pode mexer aqui — daí o
 * "use no memo") e só usa os primitivos do react-native-android-widget: View/Text do React Native não funcionam.
 */
export function MonthBalanceWidget({ balanceText, incomeText, expenseText, isPositive }: MonthBalanceData) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: "myapp:///" }}
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        justifyContent: "center",
        backgroundColor: WIDGET_COLORS.surface,
        borderWidth: 1,
        borderColor: WIDGET_COLORS.border,
        borderRadius: 20,
        padding: 16,
      }}
    >
      <TextWidget
        text="SALDO DO MÊS"
        style={{ fontSize: 11, fontWeight: "bold", color: WIDGET_COLORS.textMuted }}
      />
      <TextWidget
        text={balanceText}
        style={{
          fontSize: 24,
          fontWeight: "bold",
          color: isPositive ? WIDGET_COLORS.income : WIDGET_COLORS.expense,
          marginTop: 4,
        }}
      />
      <FlexWidget style={{ flexDirection: "row", marginTop: 8, flexGap: 12 }}>
        <TextWidget text={`+ ${incomeText}`} style={{ fontSize: 12, color: WIDGET_COLORS.income }} />
        <TextWidget text={`- ${expenseText}`} style={{ fontSize: 12, color: WIDGET_COLORS.expense }} />
      </FlexWidget>
    </FlexWidget>
  );
}
