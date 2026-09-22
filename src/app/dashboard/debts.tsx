import Animated, {
  useAnimatedScrollHandler,
} from "react-native-reanimated";

import { DebtsList } from "../../components/DebtsList";

import { useScrollY } from "../../context/DashboardUiContext";
import { useDebtsContext } from "../../context/DebtsContext";
import { useToday } from "../../context/PeriodContext";
import { useDashboardStyles } from "../../styles/dashboardStyles";

export default function DashboardDebtsScreen() {
  const styles = useDashboardStyles();
  const {
    pendingDebts,
    settledDebts,
    totalToReceive,
    totalToPay,
    isLoadingDebts,
    setIsDebtModalOpen,
    requestSettleDebt,
    handleDeleteDebt,
  } = useDebtsContext();
  const { currentDay, currentMonthNum, currentYearStr } = useToday();
  const scrollY = useScrollY();

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
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
        onSettleDebt={requestSettleDebt}
        onDeleteDebt={handleDeleteDebt}
        today={`${currentDay}/${currentMonthNum}/${currentYearStr}`}
      />
    </Animated.ScrollView>
  );
}
