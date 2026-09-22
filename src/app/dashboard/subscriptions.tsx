import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";

import { ConfirmModal } from "../../components/ConfirmModal";
import { SubscriptionFormModal } from "../../components/subscriptions/SubscriptionFormModal";
import { useSubscriptionsContext, type SubscriptionActionResult } from "../../context/SubscriptionsContext";
import { makeStyles, Text, useTheme } from "../../theme";
import type { SubscriptionRow } from "../../types";
import { formatCurrency } from "../../utils/currency";
import { formatDateToString } from "../../utils/dates";
import {
  CYCLE_LABELS,
  daysUntilCharge,
  formatPercent,
  monthlyEquivalent,
  monthlyImpact,
  nextChargeDate,
  recentPriceChanges,
  type PriceAlert,
  type SubscriptionInput,
} from "../../utils/subscriptions";

// Fora do componente: o lint do React Compiler não aceita `new Date()` direto na renderização.
const now = () => new Date();

function chargeText(subscription: SubscriptionRow): string {
  const today = now();
  const days = daysUntilCharge(subscription, today);
  const date = formatDateToString(nextChargeDate(subscription, today)).slice(0, 5);
  const when = days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;
  return `Próxima cobrança: ${date} (${when})`;
}

/** Assinaturas recorrentes: total por mês, alertas de reajuste e a lista com próxima cobrança. */
export default function SubscriptionsScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { subscriptions, priceChanges, summary, alerts, isLoading, saveSubscription, removeSubscription, toggleActive, acceptPriceAlert, ignorePriceAlert } =
    useSubscriptionsContext();

  const [form, setForm] = useState<{ subscription: SubscriptionRow | null } | null>(null);
  const [toDelete, setToDelete] = useState<SubscriptionRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/dashboard");
  };

  const openForm = (subscription: SubscriptionRow | null) => {
    setFormError(null);
    setForm({ subscription });
  };

  const report = (result: SubscriptionActionResult, success: string) => setNotice(result.ok ? success : result.error);

  const handleSave = async (input: SubscriptionInput) => {
    const editing = form?.subscription ?? null;
    const result = await saveSubscription(editing?.id ?? null, input);
    if (result.ok) {
      setForm(null);
      setFormError(null);
      setNotice(editing ? "Assinatura atualizada." : "Assinatura criada.");
    } else {
      setFormError(result.error);
    }
  };

  const changesOf = (subscription: SubscriptionRow) => recentPriceChanges(priceChanges.filter((change) => change.subscription_id === subscription.id), now())[0];
  const cycleOf = (alert: PriceAlert) => subscriptions.find((subscription) => subscription.id === alert.subscriptionId)?.cycle ?? "monthly";

  const active = subscriptions.filter((subscription) => subscription.active === 1);
  const paused = subscriptions.filter((subscription) => subscription.active !== 1);

  const renderSubscription = (subscription: SubscriptionRow) => {
    const isActive = subscription.active === 1;
    const change = changesOf(subscription);
    const percent = change ? ((change.new_amount - change.old_amount) / change.old_amount) * 100 : 0;
    return (
      <View key={subscription.id} style={[styles.item, !isActive && styles.itemPaused]}>
        <View style={styles.itemHeader}>
          <View style={styles.itemText}>
            <Text style={styles.itemName}>{subscription.name}</Text>
            <Text style={styles.small}>
              {CYCLE_LABELS[subscription.cycle]} · {subscription.category}
            </Text>
          </View>
          <View style={styles.itemAmount}>
            <Text style={styles.itemValue}>{formatCurrency(subscription.amount)}</Text>
            <Text style={styles.small}>
              {subscription.cycle === "yearly" ? `${formatCurrency(monthlyEquivalent(subscription))}/mês` : "por mês"}
            </Text>
          </View>
        </View>

        {isActive ? <Text style={styles.small}>{chargeText(subscription)}</Text> : <Text style={styles.small}>Pausada: não entra no total.</Text>}
        {change ? (
          <Text style={[styles.small, { color: percent >= 0 ? colors.expense : colors.income }]}>
            Reajustada em {change.date}: de {formatCurrency(change.old_amount)} para {formatCurrency(change.new_amount)} ({formatPercent(percent)})
          </Text>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => openForm(subscription)}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel={`Editar assinatura ${subscription.name}`}
          >
            <Ionicons name="pencil" size={15} color={colors.textSecondary} />
            <Text style={styles.actionText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => report(await toggleActive(subscription), isActive ? "Assinatura pausada." : "Assinatura reativada.")}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel={`${isActive ? "Pausar" : "Reativar"} assinatura ${subscription.name}`}
          >
            <Ionicons name={isActive ? "pause" : "play"} size={15} color={colors.textSecondary} />
            <Text style={styles.actionText}>{isActive ? "Pausar" : "Reativar"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setToDelete(subscription)}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel={`Excluir assinatura ${subscription.name}`}
          >
            <Ionicons name="trash-outline" size={15} color={colors.expense} />
            <Text style={[styles.actionText, { color: colors.expense }]}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Assinaturas
          </Text>
          <TouchableOpacity onPress={() => openForm(null)} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Adicionar assinatura">
            <Ionicons name="add" size={20} color={colors.textPrimary} />
            <Text style={styles.addText}>Nova</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard} accessibilityLabel={`Total mensal das assinaturas: ${formatCurrency(summary.monthlyTotal)}`}>
          <Text style={styles.summaryLabel}>Você paga por mês</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.monthlyTotal)}</Text>
          <Text style={styles.small}>
            {formatCurrency(summary.yearlyTotal)} por ano · {summary.activeCount} {summary.activeCount === 1 ? "ativa" : "ativas"}
            {summary.pausedCount > 0 ? ` · ${summary.pausedCount} ${summary.pausedCount === 1 ? "pausada" : "pausadas"}` : ""}
          </Text>
        </View>

        {notice !== null ? (
          <View style={styles.noticeBox} accessibilityRole="alert">
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {alerts.map((alert) => {
          const up = alert.difference > 0;
          const impact = monthlyImpact(alert, cycleOf(alert));
          return (
            <View key={alert.subscriptionId} style={[styles.alertBox, { borderColor: up ? colors.expense : colors.income }]} accessibilityRole="alert">
              <Text style={styles.alertTitle}>
                {up ? "Reajuste" : "Redução"}: {alert.name}
              </Text>
              <Text style={styles.alertText}>
                A cobrança de {alert.chargeDate} veio {formatCurrency(alert.newAmount)}, e você tinha cadastrado {formatCurrency(alert.oldAmount)} ({formatPercent(alert.percent)}).
                {" "}
                No total, {impact >= 0 ? "+" : "-"}
                {formatCurrency(Math.abs(impact))} por mês.
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={async () => report(await acceptPriceAlert(alert), `Valor de ${alert.name} atualizado para ${formatCurrency(alert.newAmount)}.`)}
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Atualizar o valor de ${alert.name}`}
                >
                  <Text style={styles.actionText}>Atualizar para {formatCurrency(alert.newAmount)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => report(await ignorePriceAlert(alert), `Alerta de ${alert.name} ignorado.`)}
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Ignorar o alerta de ${alert.name}`}
                >
                  <Text style={styles.actionText}>Ignorar</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {!isLoading && subscriptions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.itemName}>Nenhuma assinatura ainda</Text>
            <Text style={styles.small}>
              Cadastre o que você paga todo mês (streaming, academia, software) para ver o total e ser avisado quando o valor subir.
            </Text>
            <TouchableOpacity onPress={() => openForm(null)} style={styles.primaryButton} accessibilityRole="button">
              <Text style={styles.primaryText}>Adicionar assinatura</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {active.map(renderSubscription)}
        {paused.length > 0 ? <Text style={styles.sectionTitle}>Pausadas</Text> : null}
        {paused.map(renderSubscription)}

        <Text style={styles.footnote}>
          Aqui é só o controle do que você paga: as cobranças entram nas despesas pelo cartão ou pelo extrato. Para avisar de reajuste,
          o app compara o valor com a cobrança mais recente que tenha o nome da assinatura (ou o texto que você definir).
        </Text>
      </ScrollView>

      <SubscriptionFormModal
        visible={form !== null}
        subscription={form?.subscription ?? null}
        onClose={() => setForm(null)}
        onSave={handleSave}
        errorMessage={formError}
      />
      <ConfirmModal
        visible={toDelete !== null}
        title="Excluir assinatura"
        message={toDelete ? `Excluir a assinatura ${toDelete.name} e o histórico de reajustes dela? As despesas já lançadas não mudam.` : ""}
        confirmLabel="Excluir"
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const target = toDelete;
          setToDelete(null);
          if (target) report(await removeSubscription(target.id), "Assinatura excluída.");
        }}
      />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 130 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  iconButton: { padding: 8, marginRight: 4 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: { color: colors.textMuted, fontSize: 13 },
  summaryValue: { color: colors.textPrimary, fontSize: 30, fontWeight: "800", marginVertical: 4 },
  noticeBox: {
    backgroundColor: `${colors.accent}26`,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  alertBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  alertTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 4 },
  alertText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  primaryButton: { borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: colors.accent, marginTop: 10 },
  primaryText: { color: colors.textOnColor, fontSize: 15, fontWeight: "700" },
  item: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  itemPaused: { opacity: 0.65 },
  itemHeader: { flexDirection: "row", alignItems: "center" },
  itemText: { flex: 1 },
  itemAmount: { alignItems: "flex-end" },
  itemName: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  itemValue: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  small: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  sectionTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: "700", marginTop: 8, marginBottom: 8 },
  footnote: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 8 },
}));
