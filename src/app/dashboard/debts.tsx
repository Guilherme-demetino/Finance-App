import Animated, {
  useAnimatedScrollHandler,
} from "react-native-reanimated";

import { DebtsList } from "../../components/DebtsList";

import { useDashboardContext } from "../../context/DashboardContext";
import { styles } from "../../styles/dashboardStyles";

export default function DashboardDebtsScreen() {
  const {
    pendingDebts,
    settledDebts,
    totalToReceive,
    totalToPay,
    isLoadingDebts,
    setIsDebtModalOpen,
    handleSettleDebt,
    handleDeleteDebt,
    currentDay,
    currentMonthNum,
    currentYearStr,
    scrollY,
  } = useDashboardContext();

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  return (
    <Animated.ScrollView
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.scrollContent, { paddingTop: 10 }]}
    >
      <DebtsList
        pendingDebts={pendingDebts}
        settledDebts={settledDebts}
        totalToReceive={totalToReceive}
        totalToPay={totalToPay}
        isLoading={isLoadingDebts}
        onOpenAddDebt={() => setIsDebtModalOpen(true)}
        onSettleDebt={handleSettleDebt}
        onDeleteDebt={handleDeleteDebt}
        today={`${currentDay}/${currentMonthNum}/${currentYearStr}`}
      />
    </Animated.ScrollView>
  );
}
