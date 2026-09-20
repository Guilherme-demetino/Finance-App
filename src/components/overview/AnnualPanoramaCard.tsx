import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";
import { useDashboardStyles } from "../../styles/dashboardStyles";
import { Text, useTheme } from "../../theme";

interface AnnualPanoramaCardProps {
  onPress: () => void;
}

export function AnnualPanoramaCard({ onPress }: AnnualPanoramaCardProps) {
  const { colors } = useTheme();
  const styles = useDashboardStyles();
  return (
    <TouchableOpacity
      style={[
        styles.chartCard,
        { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>Panorama anual</Text>
          <Text style={styles.chartSubtitle}>
            Toque para girar a tela e visualizar
          </Text>
        </View>
        <View
          style={{
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.textPrimary,
            borderRadius: 12,
            width: 40,
            height: 40,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons
            name="phone-portrait-outline"
            size={20}
            color={colors.textPrimary}
            style={{ transform: [{ rotate: "90deg" }] }}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}
