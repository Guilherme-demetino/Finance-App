import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { categoryColors } from "./TransactionModal";

interface TransactionItem {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  category?: string;
  icon?: string;
}

interface TransactionsHistoryListProps {
  transactions: TransactionItem[];
  onEditTransaction: (transaction: TransactionItem) => void;
  onDeleteTransaction: (id: string) => void; // Nova função para apagar item unitário
  onDeleteAll: () => void;
}

export function TransactionsHistoryList({
  transactions,
  onEditTransaction,
  onDeleteTransaction,
  onDeleteAll,
}: TransactionsHistoryListProps) {
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">(
    "all",
  );
  const [sortOption, setSortOption] = useState<
    "newest" | "oldest" | "highest" | "lowest"
  >("newest");

  // Modais
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Modal de confirmação para excluir apenas UM item específico
  const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);

  // Ativa/Desativa modo de edição nos cards
  const [isEditModeActive, setIsEditModeActive] = useState(false);

  const formatCurrency = (val: number) =>
    `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const filteredTransactions = transactions.filter((item) => {
    const matchesSearch = item.description
      .toLowerCase()
      .includes(searchText.toLowerCase());
    const matchesType = typeFilter === "all" ? true : item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (sortOption === "newest") return Number(b.id) - Number(a.id);
    if (sortOption === "oldest") return Number(a.id) - Number(b.id);
    if (sortOption === "highest") return b.amount - a.amount;
    if (sortOption === "lowest") return a.amount - b.amount;
    return 0;
  });

  const typeLabel = { all: "Todos", income: "Receitas", expense: "Despesas" }[
    typeFilter
  ];
  const sortLabel = {
    newest: "Mais Recentes",
    oldest: "Mais Antigas",
    highest: "Maior Valor",
    lowest: "Menor Valor",
  }[sortOption];

  return (
    <View style={styles.container}>
      {/* Cabeçalho com Título, Botão de Edição e Lixeira Geral */}
      <View style={styles.headerRow}>
        <Text style={styles.mainTitle}>HISTÓRICO DE TRANSAÇÕES</Text>
        <View style={styles.headerButtonsGroup}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              isEditModeActive && styles.actionButtonActive,
            ]}
            onPress={() => setIsEditModeActive(!isEditModeActive)}
          >
            <Ionicons name="create-outline" size={14} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {isEditModeActive ? "Concluir" : "Editar"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => setIsDeleteConfirmOpen(true)}
          >
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de Pesquisa */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={18}
          color="#A1A1AA"
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar transação..."
          placeholderTextColor="#666666"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText("")}>
            <Ionicons name="close-circle" size={16} color="#A1A1AA" />
          </TouchableOpacity>
        )}
      </View>

      {/* Botões de Filtro */}
      <View style={styles.filtersRow}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setIsTypeModalOpen(true)}
        >
          <Ionicons name="filter-outline" size={14} color="#FFFFFF" />
          <Text style={styles.filterButtonText}>{typeLabel}</Text>
          <Ionicons name="chevron-down" size={12} color="#A1A1AA" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setIsSortModalOpen(true)}
        >
          <Ionicons name="swap-vertical-outline" size={14} color="#FFFFFF" />
          <Text style={styles.filterButtonText}>{sortLabel}</Text>
          <Ionicons name="chevron-down" size={12} color="#A1A1AA" />
        </TouchableOpacity>
      </View>

      {/* Aviso informativo */}
      {isEditModeActive && (
        <View style={styles.editModeBanner}>
          <Text style={styles.editModeBannerText}>
            Toque no lápis para editar ou na lixeira para excluir o item.
          </Text>
        </View>
      )}

      {/* Lista de Transações */}
      {sortedTransactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={36} color="#444444" />
          <Text style={styles.emptyText}>Nenhuma transação encontrada</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {sortedTransactions.map((item) => {
            const catColor = categoryColors[item.category || ""] || "#A1A1AA";
            const isIncome = item.type === "income";

            return (
              <View key={item.id} style={styles.transactionCard}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: `${catColor}20` },
                  ]}
                >
                  <Ionicons
                    name={
                      isIncome
                        ? "arrow-up-circle-outline"
                        : "arrow-down-circle-outline"
                    }
                    size={22}
                    color={catColor}
                  />
                </View>

                <View style={styles.infoContainer}>
                  <Text style={styles.descriptionText} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <View style={styles.subInfoRow}>
                    <Text style={styles.dateText}>{item.date}</Text>
                    {item.category && (
                      <View style={[styles.badge, { borderColor: catColor }]}>
                        <Text style={[styles.badgeText, { color: catColor }]}>
                          {item.category}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.rightContainer}>
                  <Text
                    style={[
                      styles.amountText,
                      { color: isIncome ? "#10B981" : "#EF4444" },
                    ]}
                  >
                    {isIncome ? "+ " : "- "}
                    {formatCurrency(item.amount)}
                  </Text>

                  {/* Ações de Edição e Lixeira Unitária quando o modo ativo estiver ligado */}
                  {isEditModeActive && (
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.itemEditButton}
                        onPress={() => onEditTransaction(item)}
                      >
                        <Ionicons name="pencil" size={13} color="#A1A1AA" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.itemDeleteButton}
                        onPress={() => setItemToDeleteId(item.id)}
                      >
                        <Ionicons name="trash" size={13} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Modal de Confirmação para Excluir UMA Transação Específica */}
      <Modal visible={itemToDeleteId !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Excluir Transação?</Text>
            <Text style={styles.modalSubtitle}>
              Tem certeza de que deseja apagar permanentemente este lançamento?
            </Text>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setItemToDeleteId(null)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  if (itemToDeleteId) {
                    onDeleteTransaction(itemToDeleteId);
                  }
                  setItemToDeleteId(null);
                }}
              >
                <Text style={styles.modalConfirmText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmação para Excluir Período Inteiro */}
      <Modal visible={isDeleteConfirmOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Excluir Todo o Período?</Text>
            <Text style={styles.modalSubtitle}>
              Tem certeza de que deseja apagar todas as transações deste mês?
              Esta ação não pode ser desfeita.
            </Text>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsDeleteConfirmOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  setIsDeleteConfirmOpen(false);
                  onDeleteAll();
                }}
              >
                <Text style={styles.modalConfirmText}>Excluir Tudo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Filtro por Tipo */}
      <Modal visible={isTypeModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filtrar por Tipo</Text>
            {[
              { label: "Todos", value: "all" },
              { label: "Receitas", value: "income" },
              { label: "Despesas", value: "expense" },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.modalOption,
                  typeFilter === opt.value && styles.modalOptionActive,
                ]}
                onPress={() => {
                  setTypeFilter(opt.value as any);
                  setIsTypeModalOpen(false);
                }}
              >
                <Text style={styles.modalOptionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Modal de Ordenação */}
      <Modal visible={isSortModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ordenar por</Text>
            {[
              { label: "Mais Recentes", value: "newest" },
              { label: "Mais Antigas", value: "oldest" },
              { label: "Maior Valor", value: "highest" },
              { label: "Menor Valor", value: "lowest" },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.modalOption,
                  sortOption === opt.value && styles.modalOptionActive,
                ]}
                onPress={() => {
                  setSortOption(opt.value as any);
                  setIsSortModalOpen(false);
                }}
              >
                <Text style={styles.modalOptionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  mainTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  headerButtonsGroup: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  actionButtonActive: {
    backgroundColor: "#2A2A2A",
    borderColor: "#555555",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 8,
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  editModeBanner: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#444444",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  editModeBannerText: {
    color: "#A1A1AA",
    fontSize: 11,
    textAlign: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  filterButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  listContainer: {
    gap: 10,
  },
  transactionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 14,
    padding: 12,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
  },
  descriptionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateText: {
    color: "#A1A1AA",
    fontSize: 10,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  rightContainer: {
    alignItems: "flex-end",
    gap: 6,
  },
  amountText: {
    fontSize: 13,
    fontWeight: "bold",
  },
  cardActionsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  itemEditButton: {
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#444444",
    borderRadius: 6,
    padding: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  itemDeleteButton: {
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#444444",
    borderRadius: 6,
    padding: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    backgroundColor: "#1E1E1E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#333333",
  },
  emptyText: {
    color: "#A1A1AA",
    fontSize: 12,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 16,
    width: "100%",
    maxWidth: 320,
    padding: 20,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalSubtitle: {
    color: "#A1A1AA",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444444",
  },
  modalCancelText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalConfirmText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  modalOptionActive: {
    backgroundColor: "#2A2A2A",
  },
  modalOptionText: {
    color: "#FFFFFF",
    fontSize: 13,
    textAlign: "center",
  },
});
