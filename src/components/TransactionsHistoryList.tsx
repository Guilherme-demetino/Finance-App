import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface TransactionItem {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  category?: string;
  icon: string;
}

interface TransactionsHistoryListProps {
  transactions: TransactionItem[];
  searchText: string;
  setSearchText: (text: string) => void;
  onEditTransaction: (item: any) => void;
  onDeleteTransaction: (id: string) => void;
  onDeleteAll: () => void;
}

export function TransactionsHistoryList({
  transactions,
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
        <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "bold" }}>
          Histórico de Transações
        </Text>
        {transactions.length > 0 && (
          <TouchableOpacity
            onPress={onDeleteAll}
            style={{
              backgroundColor: "#2A2A2A",
              borderWidth: 1,
              borderColor: "#FFFFFF",
              borderRadius: 8,
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={{
          backgroundColor: "#1E1E1E",
          color: "#FFFFFF",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#2A2A2A",
          marginBottom: 12,
        }}
        placeholder="Buscar por descrição ou categoria..."
        placeholderTextColor="#666"
        value={searchText}
        onChangeText={setSearchText}
      />

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "#2A2A2A",
            borderWidth: 1,
            borderColor: "#FFFFFF",
            paddingVertical: 8,
            borderRadius: 8,
            alignItems: "center",
            opacity: filter === "all" ? 1 : 0.6,
          }}
          onPress={() => setFilter("all")}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "bold" }}>
            Todas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "#2A2A2A",
            borderWidth: 1,
            borderColor: "#FFFFFF",
            paddingVertical: 8,
            borderRadius: 8,
            alignItems: "center",
            opacity: filter === "income" ? 1 : 0.6,
          }}
          onPress={() => setFilter("income")}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "bold" }}>
            Receitas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "#2A2A2A",
            borderWidth: 1,
            borderColor: "#FFFFFF",
            paddingVertical: 8,
            borderRadius: 8,
            alignItems: "center",
            opacity: filter === "expense" ? 1 : 0.6,
          }}
          onPress={() => setFilter("expense")}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "bold" }}>
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
              backgroundColor: "#2A2A2A",
              borderWidth: 1,
              borderColor: "#FFFFFF",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              opacity: sortBy === "recent" ? 1 : 0.6,
            }}
            onPress={() => setSortBy("recent")}
          >
            <Text
              style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "bold" }}
            >
              Mais recente
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: "#2A2A2A",
              borderWidth: 1,
              borderColor: "#FFFFFF",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              opacity: sortBy === "oldest" ? 1 : 0.6,
            }}
            onPress={() => setSortBy("oldest")}
          >
            <Text
              style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "bold" }}
            >
              Mais antigo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: "#2A2A2A",
              borderWidth: 1,
              borderColor: "#FFFFFF",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              opacity: sortBy === "highest" ? 1 : 0.6,
            }}
            onPress={() => setSortBy("highest")}
          >
            <Text
              style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "bold" }}
            >
              Maior valor
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: "#2A2A2A",
              borderWidth: 1,
              borderColor: "#FFFFFF",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              opacity: sortBy === "lowest" ? 1 : 0.6,
            }}
            onPress={() => setSortBy("lowest")}
          >
            <Text
              style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "bold" }}
            >
              Menor valor
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {sortedTransactions.length === 0 ? (
        <View style={{ padding: 20, alignItems: "center" }}>
          <Text style={{ color: "#888", fontSize: 14 }}>
            Nenhuma transação encontrada.
          </Text>
        </View>
      ) : (
        sortedTransactions.map((item) => (
          <View
            key={item.id}
            style={{
              backgroundColor: "#1E1E1E",
              padding: 14,
              borderRadius: 12,
              marginBottom: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderWidth: 1,
              borderColor: "#2A2A2A",
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
                  color={item.type === "income" ? "#10B981" : "#EF4444"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "500" }}
                  numberOfLines={1}
                >
                  {item.description}
                </Text>
                <Text style={{ color: "#888", fontSize: 12, marginTop: 2 }}>
                  {item.date} {item.category ? `• ${item.category}` : ""}
                </Text>
              </View>
            </View>

            <View
              style={{ alignItems: "flex-end", flexDirection: "row", gap: 8 }}
            >
              <Text
                style={{
                  color: item.type === "income" ? "#10B981" : "#EF4444",
                  fontSize: 14,
                  fontWeight: "bold",
                  marginRight: 2,
                }}
              >
                {item.type === "income" ? "+ " : "- "}
                R${" "}
                {item.amount.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </Text>

              <TouchableOpacity
                onPress={() => onEditTransaction(item)}
                style={{
                  backgroundColor: "#2A2A2A",
                  borderWidth: 1,
                  borderColor: "#FFFFFF",
                  borderRadius: 8,
                  width: 34,
                  height: 34,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="pencil-outline" size={16} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onDeleteTransaction(item.id)}
                style={{
                  backgroundColor: "#2A2A2A",
                  borderWidth: 1,
                  borderColor: "#FFFFFF",
                  borderRadius: 8,
                  width: 34,
                  height: 34,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );
}
