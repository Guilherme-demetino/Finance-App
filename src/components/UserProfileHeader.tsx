import { Ionicons } from "@expo/vector-icons";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { styles } from "../app/../styles/dashboardStyles";

interface UserProfileHeaderProps {
  userName: string;
  userImage: string | null;
  selectedMonth: string;
  selectedYear: string;
  onOpenMonthModal: () => void;
  onOpenYearModal: () => void;
  onOpenMenu: () => void;
}

export function UserProfileHeader({
  userName,
  userImage,
  selectedMonth,
  selectedYear,
  onOpenMonthModal,
  onOpenYearModal,
  onOpenMenu,
}: UserProfileHeaderProps) {
  return (
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
            backgroundColor: "#2A2A2A",
            borderWidth: 1,
            borderColor: "#FFFFFF",
            borderRadius: 10,
            paddingVertical: 6,
            paddingHorizontal: 10,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={onOpenMonthModal}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "bold" }}>
            {selectedMonth}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: "#2A2A2A",
            borderWidth: 1,
            borderColor: "#FFFFFF",
            borderRadius: 10,
            paddingVertical: 6,
            paddingHorizontal: 10,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={onOpenYearModal}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "bold" }}>
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
          <Ionicons name="person-circle-outline" size={40} color="#3B82F6" />
        )}
      </TouchableOpacity>
    </View>
  );
}
