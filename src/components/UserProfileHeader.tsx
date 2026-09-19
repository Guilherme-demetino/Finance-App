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
// Largura da coluna do perfil (foto + nome); o espaçador do lado oposto usa a mesma.
const PROFILE_COLUMN_WIDTH = 64;

const selectorButtonStyle = {
  backgroundColor: colors.surfaceAlt,
  borderWidth: 1,
  borderColor: colors.textPrimary,
  borderRadius: 12,
  paddingVertical: 10,
  paddingHorizontal: 14,
  alignItems: "center",
  justifyContent: "center",
} as const;

const selectorTextStyle = {
  color: colors.textPrimary,
  fontSize: 15,
  fontWeight: "bold",
} as const;

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
      <View style={[styles.header, { paddingHorizontal: 16 }]}>
        {/* Espaçador do mesmo tamanho do bloco do perfil, pra manter os
            seletores de mês/ano centralizados de verdade. */}
        <View style={{ width: PROFILE_COLUMN_WIDTH }} />

        <View style={{ flexDirection: "row", gap: 8, flexShrink: 1 }}>
          <TouchableOpacity
            style={selectorButtonStyle}
            onPress={onOpenMonthModal}
          >
            <Text style={selectorTextStyle} numberOfLines={1}>
              {selectedMonth}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={selectorButtonStyle}
            onPress={onOpenYearModal}
          >
            <Text style={selectorTextStyle} numberOfLines={1}>
              {selectedYear}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.profileButton, { width: PROFILE_COLUMN_WIDTH, alignItems: "center" }]}
          onPress={onOpenMenu}
        >
          {userImage ? (
            <Image
              source={{ uri: userImage }}
              style={{ width: 40, height: 40, borderRadius: 20 }}
            />
          ) : (
            <Ionicons name="person-circle-outline" size={40} color={colors.accent} />
          )}
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 12,
              fontWeight: "bold",
              marginTop: 2,
              maxWidth: "100%",
            }}
            numberOfLines={1}
          >
            {userName}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
