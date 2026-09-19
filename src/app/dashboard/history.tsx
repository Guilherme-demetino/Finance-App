import { useState } from "react";
import Animated, {
  useAnimatedScrollHandler,
} from "react-native-reanimated";

import { TransactionsHistoryList } from "../../components/TransactionsHistoryList";

import { useDashboardContext } from "../../context/DashboardContext";
import { useTransactionActions } from "../../context/TransactionFormContext";
import { styles } from "../../styles/dashboardStyles";

export default function DashboardHistoryScreen() {
  const {
    formattedTransactions,
    transactions,
    isLoadingTransactions,
    handleDeleteTransaction,
    handleDeleteAllTransactions,
    handleDeleteSeriesFromId,
    handleDeleteSeries,
    scrollY,
  } = useDashboardContext();
  const { handleOpenEditTransaction } = useTransactionActions();

  // A busca só afeta esta tela; guardar o texto aqui evita re-renderizar o resto do dashboard a cada tecla.
  const [searchText, setSearchText] = useState("");
  const searchLower = searchText.toLowerCase();
  const visibleTransactions = formattedTransactions.filter(
    (item) =>
      item.description.toLowerCase().includes(searchLower) ||
      (item.category && item.category.toLowerCase().includes(searchLower)),
  );

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  return (
    <Animated.ScrollView
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.scrollContent, { paddingTop: 10 }]}
    >
      <TransactionsHistoryList
        transactions={visibleTransactions}
        hasAnyTransactions={transactions.length > 0}
        isLoading={isLoadingTransactions}
        searchText={searchText}
        setSearchText={setSearchText}
        onEditTransaction={handleOpenEditTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onDeleteAll={handleDeleteAllTransactions}
        onDeleteSeriesFromHere={handleDeleteSeriesFromId}
        onDeleteSeries={handleDeleteSeries}
      />
    </Animated.ScrollView>
  );
}
