import { Ionicons } from "@expo/vector-icons";
import { Image, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { colors } from "../constants/colors";
import { styles } from "../styles/dashboardStyles";

interface UserProfileHeaderProps {
  userName: string;
  userImage: string | null;
  selectedMonth: string;
  selectedYear: string;
  onOpenMonthModal: () => void;
  onOpenYearModal: () => void;
  onOpenMenu: () => void;
  /** Posição vertical do scroll da tela — usada pra suavizar a borda ao rolar. */
  scrollY?: SharedValue<number>;
}

// Distância de rolagem (em px) até a borda ficar totalmente visível.
const BORDER_FADE_DISTANCE = 24;
// Raio das bordas inferiores do cabeçalho — soft card em vez de corte reto.
const HEADER_RADIUS = 20;

export function UserProfileHeader({
  userName,
  userImage,
  selectedMonth,
  selectedYear,
  onOpenMonthModal,
  onOpenYearModal,
  onOpenMenu,
  scrollY,
}: UserProfileHeaderProps) {
  const animatedHeaderStyle = useAnimatedStyle(() => {
    const borderBottomColor = scrollY
      ? interpolateColor(
          scrollY.value,
          [0, BORDER_FADE_DISTANCE],
          ["transparent", colors.border],
        )
      : "transparent";
    return { borderBottomColor };
  });

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.surface,
          width: "100%",
          zIndex: 999, // Garante que o cabeçalho fique acima de tudo e receba o toque
          elevation: 5, // Necessário para o Android priorizar a camada de toque
          borderBottomLeftRadius: HEADER_RADIUS,
          borderBottomRightRadius: HEADER_RADIUS,
          borderBottomWidth: 1,
        },
        animatedHeaderStyle,
      ]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Olá,</Text>
          <Text style={styles.userName} numberOfLines={1}>
            {userName}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 6, marginHorizontal: 8 }}>
          <TouchableOpacity
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.textPrimary,
              borderRadius: 10,
              paddingVertical: 6,
              paddingHorizontal: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={onOpenMonthModal}
          >
            <Text
              style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "bold" }}
            >
              {selectedMonth}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.textPrimary,
              borderRadius: 10,
              paddingVertical: 6,
              paddingHorizontal: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={onOpenYearModal}
          >
            <Text
              style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "bold" }}
            >
              {selectedYear}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.profileButton} onPress={onOpenMenu}>
          {userImage ? (
            <Image
              source={{ uri: userImage }}
              style={{ width: 40, height: 40, borderRadius: 20 }}
            />
          ) : (
            <Ionicons name="person-circle-outline" size={40} color={colors.accent} />
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
