import Animated, {
  useAnimatedScrollHandler,
} from "react-native-reanimated";

import { TransactionsHistoryList } from "../../components/TransactionsHistoryList";

import { useDashboardContext } from "../../context/DashboardContext";
import { styles } from "../../styles/dashboardStyles";

export default function DashboardHistoryScreen() {
  const {
    formattedTransactions,
    transactions,
    isLoadingTransactions,
    searchText,
    setSearchText,
    handleOpenEditTransaction,
    handleDeleteTransaction,
    handleDeleteAllTransactions,
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
      <TransactionsHistoryList
        transactions={formattedTransactions}
        hasAnyTransactions={transactions.length > 0}
        isLoading={isLoadingTransactions}
        searchText={searchText}
        setSearchText={setSearchText}
        onEditTransaction={handleOpenEditTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onDeleteAll={handleDeleteAllTransactions}
      />
    </Animated.ScrollView>
  );
}
