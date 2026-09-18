import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { colors } from "../constants/colors";
import type { AppAlert } from "../utils/alerts";

interface AlertsCardProps {
  alerts: AppAlert[];
}

export function AlertsCard({ alerts }: AlertsCardProps) {
  if (alerts.length === 0) return null;

  return (
    <View style={{ gap: 8, marginBottom: 16 }}>
      {alerts.map((alert) => {
        const isDanger = alert.level === "danger";
        const color = isDanger ? colors.expense : colors.categoryAmber;

        return (
          <View
            key={alert.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: `${color}1A`,
              borderWidth: 1,
              borderColor: color,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}
          >
            <Ionicons
              name={isDanger ? "alert-circle" : "warning"}
              size={20}
              color={color}
            />
            <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 13, lineHeight: 18 }}>
              {alert.message}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
