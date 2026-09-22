import { useState } from "react";
import Animated, {
  useAnimatedScrollHandler,
} from "react-native-reanimated";

import { AdvancedFiltersModal } from "../../components/transactions/AdvancedFiltersModal";
import { HistoryFiltersBar } from "../../components/transactions/HistoryFiltersBar";
import { TransactionsHistoryList } from "../../components/transactions/TransactionsHistoryList";

import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../../constants/categories";
import { useAccountFilter } from "../../context/AccountFilterContext";
import { useScrollY } from "../../context/DashboardUiContext";
import { useTransactionsData } from "../../context/TransactionsContext";
import { useTransactionActions } from "../../context/TransactionFormContext";
import { useAccounts } from "../../hooks/useAccounts";
import { useCategoryNames } from "../../hooks/useCategoryNames";
import { useHistoryRange } from "../../hooks/useHistoryRange";
import { useDashboardStyles } from "../../styles/dashboardStyles";
import {
  applyHistoryFilters,
  clearFilter,
  EMPTY_HISTORY_FILTERS,
  hasActiveFilters,
  summarizeTransactions,
  type HistoryFilters,
} from "../../utils/historyFilters";

export default function DashboardHistoryScreen() {
  const styles = useDashboardStyles();
  const {
    formattedTransactions,
    transactions,
    isLoadingTransactions,
    handleDeleteTransaction,
    handleDeleteAllTransactions,
    handleDeleteSeriesFromId,
    handleDeleteSeries,
    handleDeleteTransferGroup,
  } = useTransactionsData();
  const scrollY = useScrollY();
  const { selectedAccount } = useAccountFilter();
  const { handleOpenEditTransaction } = useTransactionActions();

  // A busca e os filtros só afetam esta tela; guardar o estado aqui evita re-renderizar o resto do dashboard a cada tecla.
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_HISTORY_FILTERS);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Com período personalizado a lista vem do banco (pode atravessar meses e anos); sem ele, é o mês do painel.
  // O período personalizado busca direto no banco (todas as contas): a conta em foco é aplicada aqui.
  const range = useHistoryRange(filters.period, transactions);
  const registeredCategories = useCategoryNames(transactions);
  const { options: registeredAccounts } = useAccounts();
  const periodSource = filters.period ? range.items : formattedTransactions;
  const source = selectedAccount
    ? periodSource.filter((item) => item.account === selectedAccount)
    : periodSource;

  const searchLower = searchText.toLowerCase();
  const visibleTransactions = applyHistoryFilters(
    source.filter(
      (item) =>
        item.description.toLowerCase().includes(searchLower) ||
        (item.category && item.category.toLowerCase().includes(searchLower)),
    ),
    filters,
  );

  // As categorias para marcar: as cadastradas, as padrão do app e as que aparecem nas transações listadas
  // (sem as padrão, não daria para marcar uma categoria que só existe em meses fora do período mostrado).
  const categoryOptions = [
    ...new Map(
      [
        ...registeredCategories,
        ...source.map((item) => item.category ?? ""),
        ...DEFAULT_EXPENSE_CATEGORIES,
        ...DEFAULT_INCOME_CATEGORIES,
      ]
        .filter((name) => name.trim() !== "")
        .map((name) => [name.trim().toLowerCase(), name.trim()] as const),
    ).values(),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  // As contas para marcar: as cadastradas e as que aparecem nas transações listadas (mesma lógica das categorias).
  const accountOptions = [
    ...new Map(
      [...registeredAccounts.map((option) => option.name), ...source.map((item) => item.account ?? "")]
        .filter((name) => name.trim() !== "")
        .map((name) => [name.trim().toLowerCase(), name.trim()] as const),
    ).values(),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

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
        hasAnyTransactions={transactions.length > 0 || hasActiveFilters(filters)}
        isLoading={filters.period ? range.isLoading : isLoadingTransactions}
        searchText={searchText}
        setSearchText={setSearchText}
        hideDeleteAll={hasActiveFilters(filters)}
        filtersBar={
          <HistoryFiltersBar
            filters={filters}
            summary={summarizeTransactions(visibleTransactions)}
            hasError={range.hasError}
            onOpen={() => setIsFiltersOpen(true)}
            onClear={(kind) => setFilters(clearFilter(filters, kind))}
            onClearAll={() => setFilters(EMPTY_HISTORY_FILTERS)}
          />
        }
        onEditTransaction={handleOpenEditTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onDeleteAll={handleDeleteAllTransactions}
        onDeleteSeriesFromHere={handleDeleteSeriesFromId}
        onDeleteSeries={handleDeleteSeries}
        onDeleteTransferGroup={handleDeleteTransferGroup}
      />

      <AdvancedFiltersModal
        visible={isFiltersOpen}
        value={filters}
        categories={categoryOptions}
        accounts={accountOptions}
        onApply={(next) => {
          setFilters(next);
          setIsFiltersOpen(false);
        }}
        onClose={() => setIsFiltersOpen(false)}
      />
    </Animated.ScrollView>
  );
}
