import { View } from "react-native";
import { UserProfileHeader } from "./UserProfileHeader";

interface DashboardStickyHeaderProps {
  userName: string;
  userImage: string | null;
  selectedMonth: string;
  selectedYear: string;
  onOpenMonthModal: () => void;
  onOpenYearModal: () => void;
  onOpenMenu: () => void;
}

export function DashboardStickyHeader({
  userName,
  userImage,
  selectedMonth,
  selectedYear,
  onOpenMonthModal,
  onOpenYearModal,
  onOpenMenu,
}: DashboardStickyHeaderProps) {
  return (
    <View
      style={{
        backgroundColor: "#121212",
        width: "100%",
        zIndex: 999, // Garante que o cabeçalho fique acima de tudo e receba o toque
        elevation: 5, // Necessário para o Android priorizar a camada de toque
      }}
    >
      <UserProfileHeader
        userName={userName}
        userImage={userImage}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onOpenMonthModal={onOpenMonthModal}
        onOpenYearModal={onOpenYearModal}
        onOpenMenu={onOpenMenu}
      />
    </View>
  );
}
