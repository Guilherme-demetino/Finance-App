import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors } from "../constants/colors";
import type { DisplayTransaction } from "../types";
import { formatCurrency } from "../utils/currency";

interface TransactionsHistoryListProps {
  transactions: DisplayTransaction[];
  hasAnyTransactions?: boolean;
  isLoading?: boolean;
  searchText: string;
  setSearchText: (text: string) => void;
  onEditTransaction: (item: DisplayTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onDeleteAll: () => void;
}

export function TransactionsHistoryList({
  transactions,
  hasAnyTransactions = transactions.length > 0,
  isLoading = false,
  searchText,
  setSearchText,
  onEditTransaction,
  onDeleteTransaction,
  onDeleteAll,
}: TransactionsHistoryListProps) {
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [sortBy, setSortBy] = useState<
    "recent" | "oldest" | "highest" | "lowest"
  >("recent");

  const filteredByType = transactions.filter((item) => {
    if (filter === "income") return item.type === "income";
    if (filter === "expense") return item.type === "expense";
    return true;
  });

  const sortedTransactions = [...filteredByType].sort((a, b) => {
    if (sortBy === "highest") return b.amount - a.amount;
    if (sortBy === "lowest") return a.amount - b.amount;

    const parseDate = (dateStr: string) => {
      if (!dateStr) return 0;
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        const day = Number(parts[0]);
        const month = Number(parts[1]);
        const year = Number(parts[2]);
        return new Date(year, month - 1, day).getTime();
      }
      return 0;
    };

    const timeA = parseDate(a.date);
    const timeB = parseDate(b.date);

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
        {transactions.length > 0 && (
          <TouchableOpacity
            onPress={onDeleteAll}
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

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.textPrimary,
            paddingVertical: 8,
            borderRadius: 8,
            alignItems: "center",
            opacity: filter === "all" ? 1 : 0.6,
          }}
          onPress={() => setFilter("all")}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "bold" }}>
            Todas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.textPrimary,
            paddingVertical: 8,
            borderRadius: 8,
            alignItems: "center",
            opacity: filter === "income" ? 1 : 0.6,
          }}
          onPress={() => setFilter("income")}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "bold" }}>
            Receitas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.textPrimary,
            paddingVertical: 8,
            borderRadius: 8,
            alignItems: "center",
            opacity: filter === "expense" ? 1 : 0.6,
          }}
          onPress={() => setFilter("expense")}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "bold" }}>
            Despesas
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 16 }}
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.textPrimary,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              opacity: sortBy === "recent" ? 1 : 0.6,
            }}
            onPress={() => setSortBy("recent")}
          >
            <Text
              style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "bold" }}
            >
              Mais recente
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.textPrimary,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              opacity: sortBy === "oldest" ? 1 : 0.6,
            }}
            onPress={() => setSortBy("oldest")}
          >
            <Text
              style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "bold" }}
            >
              Mais antigo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.textPrimary,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              opacity: sortBy === "highest" ? 1 : 0.6,
            }}
            onPress={() => setSortBy("highest")}
          >
            <Text
              style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "bold" }}
            >
              Maior valor
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.textPrimary,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              opacity: sortBy === "lowest" ? 1 : 0.6,
            }}
            onPress={() => setSortBy("lowest")}
          >
            <Text
              style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "bold" }}
            >
              Menor valor
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderWidth: 1,
              borderColor: colors.surfaceAlt,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flex: 1,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor:
                    item.type === "income"
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(239, 68, 68, 0.15)",
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
                  color={item.type === "income" ? colors.income : colors.expense}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "500" }}
                  numberOfLines={1}
                >
                  {item.description}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {item.date} {item.category ? `• ${item.category}` : ""}
                </Text>
              </View>
            </View>

            <View
              style={{ alignItems: "flex-end", flexDirection: "row", gap: 8 }}
            >
              <Text
                style={{
                  color: item.type === "income" ? colors.income : colors.expense,
                  fontSize: 14,
                  fontWeight: "bold",
                  marginRight: 2,
                }}
              >
                {formatCurrency(item.amount, {
                  forceSign: item.type === "income" ? "+" : "-",
                })}
              </Text>

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
            </View>
          </Animated.View>
        ))
      )}
    </View>
  );
}
