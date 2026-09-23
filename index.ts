import "expo-router/entry";

import { Platform } from "react-native";
import { registerWidgetTaskHandler } from "react-native-android-widget";

import { widgetTaskHandler } from "./src/widgets/widgetTaskHandler";

// Os widgets de tela inicial (saldo do mês, próximas contas) só existem no Android.
if (Platform.OS === "android") {
  registerWidgetTaskHandler(widgetTaskHandler);
}
