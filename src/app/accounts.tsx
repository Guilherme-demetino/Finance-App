import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AccountModal } from "../components/forms/AccountModal";
import { ConfirmModal } from "../components/ConfirmModal";
import { TransferModal } from "../components/TransferModal";
import { useAccounts } from "../hooks/useAccounts";
import { notifyCardsChanged } from "../services/cardsEvents";
import { makeStyles, Text, useTheme } from "../theme";
import type { AccountRow } from "../types";

/** Gerenciar contas/carteiras: criar, ver e excluir (ver hooks/useAccounts). */
export default function AccountsScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { accounts, isLoading, remove, refresh } = useAccounts();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AccountRow | null>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/dashboard");
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    await remove(target.id);
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
          Contas
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Contas ajudam a separar o saldo (ex: carteira, poupança, outro banco). Toda transação e cartão de crédito
          pertence a uma conta — sem escolher, cai na Conta principal.
        </Text>

        {!isLoading && accounts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Nenhuma conta cadastrada ainda além da Conta principal. Crie uma para começar a separar o saldo.
            </Text>
          </View>
        ) : (
          accounts.map((account) => (
            <View key={account.id} style={styles.card}>
              <View style={styles.nameGroup}>
                <View style={[styles.dot, { backgroundColor: account.color }]} />
                <Text style={styles.name} numberOfLines={1}>
                  {account.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPendingDelete(account)}
                accessibilityRole="button"
                accessibilityLabel={`Excluir a conta ${account.name}`}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={20} color={colors.expense} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsCreateOpen(true)}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={18} color={colors.textPrimary} />
          <Text style={styles.addText}>Nova conta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.addButton, styles.transferButton]}
          onPress={() => setIsTransferOpen(true)}
          accessibilityRole="button"
        >
          <Ionicons name="swap-horizontal-outline" size={18} color={colors.accent} />
          <Text style={[styles.addText, { color: colors.accent }]}>Transferir entre contas</Text>
        </TouchableOpacity>
      </ScrollView>

      <AccountModal
        visible={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSave={() => {
          setIsCreateOpen(false);
          refresh();
        }}
      />

      <TransferModal
        visible={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        onDone={() => {
          setIsTransferOpen(false);
          // A tela de contas fica fora do painel (como a Lixeira): avisa para o painel reler as transações.
          notifyCardsChanged();
        }}
      />

      <ConfirmModal
        visible={pendingDelete !== null}
        title="Excluir conta"
        message={
          pendingDelete
            ? `Excluir a conta "${pendingDelete.name}"? As transações e cartões já registrados nela continuam existindo, só deixam de aparecer atrelados a essa conta.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
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
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 16 },
  emptyState: { alignItems: "center", padding: 32, gap: 12 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nameGroup: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, marginRight: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: "600", flexShrink: 1 },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    marginTop: 8,
  },
  transferButton: { borderColor: colors.accent, marginTop: 12 },
  addText: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
}));
