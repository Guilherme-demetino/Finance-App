"use no memo";

import { FlexWidget, TextWidget } from "react-native-android-widget";

import type { UpcomingBillItem } from "../utils/widgetData";
import { WIDGET_COLORS } from "./colors";

interface UpcomingBillsWidgetProps {
  items: UpcomingBillItem[];
}

/**
 * Widget de tela inicial "Próximas contas". Roda fora da árvore React (React Compiler não pode mexer aqui — daí o
 * "use no memo") e só usa os primitivos do react-native-android-widget: View/Text do React Native não funcionam.
 */
export function UpcomingBillsWidget({ items }: UpcomingBillsWidgetProps) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: "myapp:///" }}
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        backgroundColor: WIDGET_COLORS.surface,
        borderWidth: 1,
        borderColor: WIDGET_COLORS.border,
        borderRadius: 20,
        padding: 16,
      }}
    >
      <TextWidget
        text="PRÓXIMAS CONTAS"
        style={{ fontSize: 11, fontWeight: "bold", color: WIDGET_COLORS.textMuted, marginBottom: 8 }}
      />

      {items.length === 0 ? (
        <TextWidget text="Nenhuma conta a vencer" style={{ fontSize: 13, color: WIDGET_COLORS.textMuted }} />
      ) : (
        items.map((item) => (
          <FlexWidget
            key={item.id}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              width: "match_parent",
              marginBottom: 6,
            }}
          >
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget
                text={item.label}
                maxLines={1}
                truncate="END"
                style={{ fontSize: 13, color: WIDGET_COLORS.textPrimary }}
              />
            </FlexWidget>
            <TextWidget
              text={`${item.amountText} · ${item.whenText}`}
              style={{
                fontSize: 12,
                color: item.isReceivable ? WIDGET_COLORS.income : WIDGET_COLORS.expense,
                marginLeft: 8,
              }}
            />
          </FlexWidget>
        ))
      )}
    </FlexWidget>
  );
}
