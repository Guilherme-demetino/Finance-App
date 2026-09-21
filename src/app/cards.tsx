import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CardFormModal } from "../components/cards/CardFormModal";
import { InvoiceImportModal } from "../components/cards/InvoiceImportModal";
import { InvoiceSection } from "../components/cards/InvoiceSection";
import { PurchaseFormModal } from "../components/cards/PurchaseFormModal";
import { ConfirmModal } from "../components/ConfirmModal";
import type { CreditCardInput } from "../database/creditCards";
import { useCreditCards, type ActionResult, type CardView, type PurchaseFormData } from "../hooks/useCreditCards";
import { makeStyles, Text, useTheme } from "../theme";
import type { CardPurchaseRow, CreditCardRow, TransactionRow } from "../types";
import { planCardImport } from "../utils/cardImport";
import type { ImportedTransaction } from "../utils/statements/importCsv";
import type { Invoice } from "../utils/creditCards";
import { formatRef } from "../utils/creditCards";
import { formatCurrency } from "../utils/currency";

type Confirmation =
  | { kind: "delete-card"; card: CreditCardRow }
  | { kind: "pay"; card: CreditCardRow; invoice: Invoice }
  | { kind: "undo"; card: CreditCardRow; invoice: Invoice }
  | { kind: "delete-purchase"; card: CreditCardRow; purchase: CardPurchaseRow };

type CardFormState = { card: CreditCardRow | null };
type PurchaseFormState = { card: CreditCardRow; purchase: CardPurchaseRow | null };
/** Fatura lida de um arquivo, esperando a conferência do usuário. `ref` é a fatura que ele escolheu (senão, a detectada). */
type ImportDraft = { card: CreditCardRow; candidates: ImportedTransaction[]; transactions: TransactionRow[]; ref: string | null };

function confirmationText(confirmation: Confirmation): { title: string; message: string; confirmLabel: string; destructive: boolean } {
  switch (confirmation.kind) {
    case "delete-card":
      return {
        title: "Excluir cartão",
        message: `Apagar o cartão ${confirmation.card.name}, as compras e os pagamentos dele? As despesas de faturas já pagas continuam no seu saldo.`,
        confirmLabel: "Excluir",
        destructive: true,
      };
    case "pay":
      return {
        title: "Pagar fatura",
        message: `Registrar o pagamento da fatura ${confirmation.invoice.label} do ${confirmation.card.name}: ${formatCurrency(confirmation.invoice.total)}. Uma despesa "Cartão de crédito" entra no seu saldo com a data de hoje.`,
        confirmLabel: "Pagar",
        destructive: false,
      };
    case "undo":
      return {
        title: "Desfazer pagamento",
        message: `A fatura ${confirmation.invoice.label} volta a ficar em aberto e a despesa do pagamento sai do seu saldo.`,
        confirmLabel: "Desfazer",
        destructive: true,
      };
    case "delete-purchase": {
      const isSeries = confirmation.purchase.installment_group_id !== null;
      return {
        title: "Excluir compra",
        message: isSeries
          ? `Apagar "${confirmation.purchase.description}" e as parcelas que ainda não foram pagas? As de faturas já pagas ficam.`
          : `Apagar "${confirmation.purchase.description}" da fatura?`,
        confirmLabel: "Excluir",
        destructive: true,
      };
    }
  }
}

/** Cartões de crédito: limite usado, faturas (aberta, fechada, vencida, paga), compras parceladas e o pagamento da fatura. */
export default function CardsScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const cards = useCreditCards();

  const [cardForm, setCardForm] = useState<CardFormState | null>(null);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [importDraft, setImportDraft] = useState<ImportDraft | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showPaid, setShowPaid] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/dashboard");
  };

  const openCardForm = (card: CreditCardRow | null) => {
    setFormError(null);
    setCardForm({ card });
  };
  const openPurchaseForm = (card: CreditCardRow, purchase: CardPurchaseRow | null) => {
    setFormError(null);
    setPurchaseForm({ card, purchase });
  };

  /** Fecha o formulário se deu certo; senão deixa aberto com o erro à vista. */
  const finishForm = (result: ActionResult, close: () => void, success: string) => {
    if (result.ok) {
      setFormError(null);
      close();
      setNotice(success);
    } else {
      setFormError(result.error);
    }
  };

  const handleSaveCard = async (input: CreditCardInput) => {
    const editing = cardForm?.card ?? null;
    finishForm(await cards.saveCard(editing?.id ?? null, input), () => setCardForm(null), editing ? "Cartão atualizado." : "Cartão criado.");
  };

  const handleSavePurchase = async (form: PurchaseFormData) => {
    if (!purchaseForm) return;
    const { card, purchase } = purchaseForm;
    const result = purchase ? await cards.editPurchase(purchase, card, form) : await cards.addPurchase(card, form);
    finishForm(result, () => setPurchaseForm(null), purchase ? "Compra atualizada." : "Compra lançada.");
  };

  const importPlan = importDraft
    ? planCardImport({
        candidates: importDraft.candidates,
        card: importDraft.card,
        purchases: cards.purchases,
        payments: cards.payments,
        transactions: importDraft.transactions,
        today: new Date(),
        ref: importDraft.ref ?? undefined,
      })
    : null;

  const handleStartImport = async (card: CreditCardRow) => {
    setNotice(null);
    setFormError(null);
    const read = await cards.readInvoiceFile();
    if (read.status === "cancelled") return;
    if (read.status === "error") {
      setNotice(read.error);
      return;
    }
    setImportDraft({ card, candidates: read.candidates, transactions: read.transactions, ref: null });
  };

  const handleConfirmImport = async () => {
    if (!importDraft || !importPlan) return;
    setIsImporting(true);
    const result = await cards.importInvoice(importDraft.card, importPlan);
    setIsImporting(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    const count = importPlan.rows.length;
    const imported = count > 0 ? `${count} ${count === 1 ? "compra importada" : "compras importadas"} na fatura de ${formatRef(importPlan.ref)}.` : "";
    const paid = importPlan.paymentMatch ? " A fatura foi marcada como paga pelo pagamento que já estava no extrato." : "";
    setImportDraft(null);
    setNotice(`${imported}${paid}`.trim());
  };

  const handleConfirm = async () => {
    const current = confirmation;
    if (!current) return;
    setConfirmation(null);
    let result: ActionResult;
    let success: string;
    switch (current.kind) {
      case "delete-card":
        result = await cards.removeCard(current.card.id);
        success = "Cartão excluído.";
        break;
      case "pay":
        result = await cards.payInvoice(current.card, current.invoice);
        success = "Fatura paga. A despesa entrou no seu saldo.";
        break;
      case "undo":
        result = await cards.undoPayment(current.card, current.invoice);
        success = "Pagamento desfeito. A fatura voltou a ficar em aberto.";
        break;
      case "delete-purchase":
        result = await cards.removeInstallments(current.purchase);
        success = "Compra excluída.";
        break;
    }
    setNotice(result.ok ? success : result.error);
  };

  const visibleInvoices = (view: CardView) => (showPaid ? view.invoices : view.invoices.filter((invoice) => invoice.status !== "paid"));
  const paidCount = cards.views.reduce((sum, view) => sum + view.invoices.filter((invoice) => invoice.status === "paid").length, 0);
  const confirmText = confirmation ? confirmationText(confirmation) : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Cartões e faturas
        </Text>
        <TouchableOpacity onPress={() => openCardForm(null)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Adicionar cartão">
          <Ionicons name="add" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          As compras no cartão ficam fora do seu saldo até você pagar a fatura: aí o valor sai de uma vez, como despesa
          &quot;Cartão de crédito&quot;. Assim o mesmo gasto não é contado duas vezes.
        </Text>

        {notice !== null ? (
          <View style={styles.noticeBox} accessibilityRole="alert">
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {!cards.isLoading && cards.views.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nenhum cartão ainda</Text>
            <Text style={styles.hint}>
              Cadastre um cartão com os dias de fechamento e de vencimento para acompanhar a fatura, o limite e as
              parcelas.
            </Text>
            <TouchableOpacity onPress={() => openCardForm(null)} style={styles.primaryButton} accessibilityRole="button">
              <Text style={styles.primaryText}>Adicionar cartão</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {cards.views.map((view) => {
          const { card, usage } = view;
          const invoices = visibleInvoices(view);
          return (
            <View key={card.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>{card.name}</Text>
                  <Text style={styles.hint}>
                    Fecha dia {card.closing_day} · vence dia {card.due_day}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => openCardForm(card)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`Editar cartão ${card.name}`}>
                  <Ionicons name="pencil" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setConfirmation({ kind: "delete-card", card })}
                  style={styles.iconButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Excluir cartão ${card.name}`}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.expense} />
                </TouchableOpacity>
              </View>

              <View style={styles.usageRow}>
                <Text style={styles.usageText}>Usado {formatCurrency(usage.used)}</Text>
                {card.credit_limit !== null ? (
                  <Text style={styles.usageText}>
                    {usage.available !== null && usage.available < 0
                      ? `Passou ${formatCurrency(-usage.available)} do limite`
                      : `Disponível ${formatCurrency(usage.available ?? 0)}`}
                  </Text>
                ) : null}
              </View>
              {usage.ratio !== null ? (
                <View style={styles.barTrack} accessibilityLabel={`${Math.round(usage.ratio * 100)}% do limite usado`}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.round(usage.ratio * 100)}%`, backgroundColor: usage.ratio >= 1 ? colors.expense : colors.accent },
                    ]}
                  />
                </View>
              ) : (
                <Text style={styles.hint}>Sem limite definido.</Text>
              )}

              <TouchableOpacity
                onPress={() => openPurchaseForm(card, null)}
                style={styles.primaryButton}
                accessibilityRole="button"
                accessibilityLabel={`Nova compra no ${card.name}`}
              >
                <Text style={styles.primaryText}>Nova compra</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleStartImport(card)}
                style={[styles.secondaryButton, styles.importButton]}
                accessibilityRole="button"
                accessibilityLabel={`Importar fatura do ${card.name}`}
              >
                <Text style={styles.secondaryText}>Importar fatura (PDF ou CSV)</Text>
              </TouchableOpacity>

              {invoices.map((invoice) => {
                const key = `${card.id}-${invoice.ref}`;
                return (
                  <InvoiceSection
                    key={key}
                    cardName={card.name}
                    invoice={invoice}
                    expanded={expanded === key}
                    onToggle={() => setExpanded(expanded === key ? null : key)}
                    onPay={() => setConfirmation({ kind: "pay", card, invoice })}
                    onUndoPayment={() => setConfirmation({ kind: "undo", card, invoice })}
                    onEditPurchase={(purchase) => openPurchaseForm(card, purchase)}
                    onDeletePurchase={(purchase) => setConfirmation({ kind: "delete-purchase", card, purchase })}
                  />
                );
              })}
            </View>
          );
        })}

        {paidCount > 0 ? (
          <TouchableOpacity onPress={() => setShowPaid(!showPaid)} style={styles.secondaryButton} accessibilityRole="button">
            <Text style={styles.secondaryText}>{showPaid ? "Esconder faturas pagas" : `Mostrar faturas pagas (${paidCount})`}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <CardFormModal
        visible={cardForm !== null}
        card={cardForm?.card ?? null}
        onClose={() => setCardForm(null)}
        onSave={handleSaveCard}
        errorMessage={formError}
      />
      <PurchaseFormModal
        visible={purchaseForm !== null}
        card={purchaseForm?.card ?? null}
        purchase={purchaseForm?.purchase ?? null}
        categoryOptions={cards.categoryOptions}
        onClose={() => setPurchaseForm(null)}
        onSave={handleSavePurchase}
        errorMessage={formError}
      />
      <InvoiceImportModal
        visible={importDraft !== null}
        cardName={importDraft?.card.name ?? ""}
        plan={importPlan}
        onSelectRef={(ref) => setImportDraft((draft) => (draft ? { ...draft, ref } : draft))}
        onConfirm={handleConfirmImport}
        onClose={() => setImportDraft(null)}
        isBusy={isImporting}
        errorMessage={formError}
      />
      <ConfirmModal
        visible={confirmText !== null}
        title={confirmText?.title ?? ""}
        message={confirmText?.message ?? ""}
        confirmLabel={confirmText?.confirmLabel}
        destructive={confirmText?.destructive}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmation(null)}
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginLeft: 4 },
  iconButton: { padding: 8 },
  content: { padding: 16, paddingBottom: 48 },
  intro: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 16 },
  noticeBox: {
    backgroundColor: `${colors.accent}26`,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  cardHeaderText: { flex: 1 },
  cardTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "700" },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  usageRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, marginBottom: 6 },
  usageText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.accent,
    marginTop: 14,
  },
  primaryText: { color: colors.textOnColor, fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  importButton: { marginTop: 10 },
}));
