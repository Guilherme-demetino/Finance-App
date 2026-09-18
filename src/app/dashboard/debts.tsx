import Animated, {
  useAnimatedScrollHandler,
} from "react-native-reanimated";

import { DebtsList } from "../../components/DebtsList";

import { useDashboardContext } from "../../context/DashboardContext";
import { styles } from "../../styles/dashboardStyles";
import { formatCurrencyInput } from "../../utils/currency";

export default function DashboardDebtsScreen() {
  const {
    pendingDebts,
    settledDebts,
    totalToReceive,
    totalToPay,
    isLoadingDebts,
    handleAddDebt,
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
        onAddDebt={handleAddDebt}
        onSettleDebt={handleSettleDebt}
        onDeleteDebt={handleDeleteDebt}
        formatCurrency={formatCurrencyInput}
        today={`${currentDay}/${currentMonthNum}/${currentYearStr}`}
      />
    </Animated.ScrollView>
  );
}
