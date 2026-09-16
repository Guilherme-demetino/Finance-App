import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import { styles } from "../app/../styles/dashboardStyles";

interface AnnualPanoramaCardProps {
  onPress: () => void;
}

export function AnnualPanoramaCard({ onPress }: AnnualPanoramaCardProps) {
  return (
    <TouchableOpacity
      style={[
        styles.chartCard,
        { backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#333333" },
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
            backgroundColor: "#2A2A2A",
            borderWidth: 1,
            borderColor: "#FFFFFF",
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
            color="#FFFFFF"
            style={{ transform: [{ rotate: "90deg" }] }}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}
