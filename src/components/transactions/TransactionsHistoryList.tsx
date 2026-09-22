import { Ionicons } from "@expo/vector-icons";
import { useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SortModal, type SortOption } from "./FilterModals";
import { SeriesManagerModal } from "./SeriesManagerModal";
import type { DisplayTransaction } from "../../types";
import { formatCurrency } from "../../utils/currency";
import { parseDateString } from "../../utils/dates";
import { Text, TextInput, useTheme } from "../../theme";

type TypeFilter = "all" | "income" | "expense";
type SortKey = "recent" | "oldest" | "highest" | "lowest";

const TYPE_FILTERS: {
  key: TypeFilter;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  /** Qual cor do tema o filtro usa quando está ativo. */
  activeColor: "accent" | "income" | "expense";
}[] = [
  { key: "all", label: "Todas", icon: "apps-outline", activeColor: "accent" },
  {
    key: "income",
    label: "Receitas",
    icon: "arrow-down-circle-outline",
    activeColor: "income",
  },
  {
    key: "expense",
    label: "Despesas",
    icon: "arrow-up-circle-outline",
    activeColor: "expense",
  },
];

const SORT_OPTIONS: SortOption<SortKey>[] = [
  { key: "recent", label: "Mais recente", icon: "time-outline" },
  { key: "oldest", label: "Mais antigo", icon: "hourglass-outline" },
  { key: "highest", label: "Maior valor", icon: "trending-up-outline" },
  { key: "lowest", label: "Menor valor", icon: "trending-down-outline" },
];

interface TransactionsHistoryListProps {
  transactions: DisplayTransaction[];
  hasAnyTransactions?: boolean;
  isLoading?: boolean;
  searchText: string;
  setSearchText: (text: string) => void;
  /** Sob a busca: filtros avançados (botão, etiquetas e resumo). */
  filtersBar?: ReactNode;
  /** Esconde o "apagar tudo": com filtros ele apagaria o mês inteiro, não o que aparece na lista. */
  hideDeleteAll?: boolean;
  onEditTransaction: (item: DisplayTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onDeleteAll: () => void;
  onDeleteSeriesFromHere: (groupId: string, fromId: number) => void;
  onDeleteSeries: (groupId: string) => void;
}

export function TransactionsHistoryList({
  transactions,
  hasAnyTransactions = transactions.length > 0,
  isLoading = false,
  searchText,
  setSearchText,
  filtersBar = null,
  hideDeleteAll = false,
  onEditTransaction,
  onDeleteTransaction,
  onDeleteAll,
  onDeleteSeriesFromHere,
  onDeleteSeries,
}: TransactionsHistoryListProps) {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [seriesTransaction, setSeriesTransaction] =
    useState<DisplayTransaction | null>(null);
  const currentSortOption =
    SORT_OPTIONS.find((option) => option.key === sortBy) ?? SORT_OPTIONS[0];

  const filteredByType = transactions.filter((item) => {
    if (filter === "income") return item.type === "income";
    if (filter === "expense") return item.type === "expense";
    return true;
  });

  const sortedTransactions = [...filteredByType].sort((a, b) => {
    if (sortBy === "highest") return b.amount - a.amount;
    if (sortBy === "lowest") return a.amount - b.amount;

    const timeA = parseDateString(a.date).getTime();
    const timeB = parseDateString(b.date).getTime();

    if (timeA === timeB) {
      const idA = Number(a.id) || 0;
      const idB = Number(b.id) || 0;
      return sortBy === "oldest" ? idA - idB : idB - idA;
    }

    if (sortBy === "oldest") return timeA - timeB;
    return timeB - timeA;
  });

  return (
    <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "bold" }}>
          Histórico de Transações
        </Text>
        {transactions.length > 0 && !hideDeleteAll && (
          <TouchableOpacity
            onPress={onDeleteAll}
            accessibilityRole="button"
            accessibilityLabel="Apagar todas as transações do período"
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.textPrimary,
              borderRadius: 8,
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.expense} />
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={{
          backgroundColor: colors.surface,
          color: colors.textPrimary,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.surfaceAlt,
          marginBottom: 12,
        }}
        placeholder="Buscar por descrição ou categoria..."
        placeholderTextColor={colors.textPlaceholder}
        value={searchText}
        onChangeText={setSearchText}
      />

      {filtersBar}

      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.surfaceAlt,
          padding: 4,
          gap: 4,
          marginBottom: 10,
        }}
      >
        {TYPE_FILTERS.map((option) => {
          const isActive = filter === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => setFilter(option.key)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: isActive
                  ? `${colors[option.activeColor]}26`
                  : "transparent",
              }}
            >
              <Ionicons
                name={option.icon}
                size={16}
                color={isActive ? colors[option.activeColor] : colors.textMuted}
              />
              <Text
                style={{
                  color: isActive ? colors[option.activeColor] : colors.textMuted,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={() => setIsSortModalOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.surfaceAlt,
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons
            name="swap-vertical-outline"
            size={18}
            color={colors.textSecondary}
          />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Ordenar por{" "}
            <Text style={{ color: colors.textPrimary, fontWeight: "bold" }}>
              {currentSortOption.label}
            </Text>
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      <SortModal
        visible={isSortModalOpen}
        onClose={() => setIsSortModalOpen(false)}
        options={SORT_OPTIONS}
        selectedKey={sortBy}
        onSelect={setSortBy}
      />

      {isLoading ? (
        <Animated.View
          entering={FadeIn.duration(150)}
          style={{ paddingVertical: 40, alignItems: "center" }}
        >
          <ActivityIndicator size="small" color={colors.income} />
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 12 }}>
            Carregando transações...
          </Text>
        </Animated.View>
      ) : sortedTransactions.length === 0 ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{
            paddingVertical: 40,
            paddingHorizontal: 24,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons
              name={
                hasAnyTransactions ? "search-outline" : "receipt-outline"
              }
              size={32}
              color={colors.textFaint}
            />
          </View>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 15,
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: 4,
            }}
          >
            {hasAnyTransactions
              ? "Nenhuma transação encontrada"
              : "Nenhuma transação ainda"}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 13,
              textAlign: "center",
              lineHeight: 18,
            }}
          >
            {hasAnyTransactions
              ? "Tente ajustar a busca ou os filtros selecionados."
              : "Toque no botão + para registrar sua primeira receita ou despesa."}
          </Text>
        </Animated.View>
      ) : (
        sortedTransactions.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.duration(250).delay(Math.min(index, 8) * 40)}
            style={{
              backgroundColor: colors.surface,
              padding: 14,
              borderRadius: 12,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: colors.surfaceAlt,
            }}
          >
            {/* Linha 1: ícone, título e valor — título tem toda a largura livre. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  // Fundo translúcido na cor da categoria (não só receita/despesa),
                  // pra transações de categorias diferentes serem visualmente distintas.
                  backgroundColor: `${item.color}26`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={
                    item.type === "income"
                      ? "arrow-down-outline"
                      : "arrow-up-outline"
                  }
                  size={20}
                  color={item.color}
                />
              </View>

              <Text
                style={{
                  flex: 1,
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "500",
                }}
                numberOfLines={1}
              >
                {item.description}
              </Text>

              <Text
                style={{
                  color: item.type === "income" ? colors.income : colors.expense,
                  fontSize: 14,
                  fontWeight: "bold",
                }}
              >
                {formatCurrency(item.amount, {
                  forceSign: item.type === "income" ? "+" : "-",
                })}
              </Text>
            </View>

            {/* Linha 2: data e ações — fora da disputa de espaço com o título. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 10,
                paddingLeft: 52,
              }}
            >
              <Text
                style={{ color: colors.textMuted, fontSize: 12, flexShrink: 1 }}
                numberOfLines={1}
              >
                {item.account ? `${item.date} · ${item.account}` : item.date}
              </Text>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => onEditTransaction(item)}
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.textPrimary,
                    borderRadius: 8,
                    width: 34,
                    height: 34,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="pencil-outline" size={16} color={colors.textPrimary} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => onDeleteTransaction(item.id)}
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.textPrimary,
                    borderRadius: 8,
                    width: 34,
                    height: 34,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.expense} />
                </TouchableOpacity>

                {item.recurrenceType && (
                  <TouchableOpacity
                    onPress={() => setSeriesTransaction(item)}
                    style={{
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.textPrimary,
                      borderRadius: 8,
                      width: 34,
                      height: 34,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="repeat-outline"
                      size={16}
                      color={colors.accent}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>
        ))
      )}

      <SeriesManagerModal
        visible={!!seriesTransaction}
        transaction={seriesTransaction}
        onClose={() => setSeriesTransaction(null)}
        onDeleteOccurrence={onDeleteTransaction}
        onDeleteFromHere={onDeleteSeriesFromHere}
        onDeleteSeries={onDeleteSeries}
      />
    </View>
  );
}
