import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConfirmModal } from "../components/ConfirmModal";
import { useTrash } from "../hooks/useTrash";
import { makeStyles, Text, useTheme } from "../theme";
import { formatCurrency } from "../utils/currency";
import { describeTimeLeft } from "../utils/trash";
import type { TransactionRow } from "../types";

/** Lixeira: transações excluídas dentro do prazo, com a chance de restaurar ou apagar de vez. */
export default function TrashScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { items, isLoading, restore, removeForever } = useTrash();
  const [pendingForever, setPendingForever] = useState<TransactionRow | null>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/dashboard");
  };

  const confirmForever = async () => {
    if (!pendingForever) return;
    const target = pendingForever;
    setPendingForever(null);
    await removeForever(target.id);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Lixeira
        </Text>
      </View>

      {!isLoading && items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="trash-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyText}>Nenhuma transação excluída no momento.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {items.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.description} numberOfLines={1}>
                  {item.description || "Sem título"}
                </Text>
                <Text
                  style={[
                    styles.amount,
                    { color: item.type === "income" ? colors.income : colors.expense },
                  ]}
                >
                  {formatCurrency(item.amount, { forceSign: item.type === "income" ? "+" : "-" })}
                </Text>
              </View>
              <Text style={styles.meta}>
                {item.category_id} · {item.date}
              </Text>
              <Text style={styles.timeLeft}>{describeTimeLeft(item.deleted_at ?? new Date().toISOString())}</Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.restoreButton}
                  onPress={() => restore(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Restaurar ${item.description || "transação"}`}
                >
                  <Text style={styles.restoreText}>Restaurar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => setPendingForever(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Excluir definitivamente ${item.description || "transação"}`}
                >
                  <Text style={styles.deleteText}>Excluir definitivamente</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <ConfirmModal
        visible={pendingForever !== null}
        title="Excluir definitivamente?"
        message={`"${pendingForever?.description || "Esta transação"}" vai sumir de vez, sem chance de desfazer.`}
        confirmLabel="Excluir de vez"
        destructive
        onConfirm={confirmForever}
        onCancel={() => setPendingForever(null)}
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 8, marginRight: 8 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  content: { padding: 16, paddingBottom: 48 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  description: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginRight: 12 },
  amount: { fontSize: 15, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  timeLeft: { color: colors.textMuted, fontSize: 11, marginTop: 6, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  restoreButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: `${colors.accent}26`,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  restoreText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  deleteButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.expense,
  },
  deleteText: { color: colors.expense, fontSize: 12, fontWeight: "700" },
}));
