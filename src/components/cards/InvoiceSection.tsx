import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";

import { Text, makeStyles, useTheme } from "../../theme";
import type { CardPurchaseRow } from "../../types";
import { INVOICE_STATUS_LABELS, type Invoice, type InvoiceStatus } from "../../utils/creditCards";
import { formatCurrency } from "../../utils/currency";

interface InvoiceSectionProps {
  cardName: string;
  invoice: Invoice;
  expanded: boolean;
  onToggle: () => void;
  onPay: () => void;
  onUndoPayment: () => void;
  onEditPurchase: (purchase: CardPurchaseRow) => void;
  onDeletePurchase: (purchase: CardPurchaseRow) => void;
  onDeleteInvoice: () => void;
}

function purchaseTitle(purchase: CardPurchaseRow): string {
  const hasNumber = /\(\d+\/\d+\)\s*$/.test(purchase.description);
  return purchase.installment_number && purchase.installment_total && !hasNumber
    ? `${purchase.description} (${purchase.installment_number}/${purchase.installment_total})`
    : purchase.description;
}

/** Uma fatura do cartão: resumo numa linha e, aberta, as compras, o total por categoria e pagar/desfazer. */
export function InvoiceSection({
  cardName,
  invoice,
  expanded,
  onToggle,
  onPay,
  onUndoPayment,
  onEditPurchase,
  onDeletePurchase,
  onDeleteInvoice,
}: InvoiceSectionProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  const statusColor: Record<InvoiceStatus, string> = {
    open: colors.textSecondary,
    closed: colors.accent,
    overdue: colors.expense,
    paid: colors.income,
    empty: colors.textMuted,
    settled: colors.income,
  };
  const tint = statusColor[invoice.status];
  const statusLabel = INVOICE_STATUS_LABELS[invoice.status];
  const isPaid = invoice.status === "paid";
  const canPay = invoice.status === "open" || invoice.status === "closed" || invoice.status === "overdue";

  return (
    <View style={styles.box}>
      <TouchableOpacity
        onPress={onToggle}
        style={styles.summary}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Fatura ${cardName} ${invoice.label}, ${statusLabel}, ${formatCurrency(invoice.total)}`}
      >
        <View style={styles.summaryText}>
          <Text style={styles.invoiceLabel}>{invoice.label}</Text>
          <Text style={styles.small}>Vence em {invoice.dueDate}</Text>
          {invoice.credits > 0 ? <Text style={styles.small}>Compras {formatCurrency(invoice.spend)}</Text> : null}
        </View>
        <View style={styles.summaryRight}>
          <Text style={styles.total}>{formatCurrency(invoice.total)}</Text>
          <View style={[styles.badge, { backgroundColor: `${tint}26`, borderColor: tint }]}>
            <Text style={[styles.badgeText, { color: tint }]}>{statusLabel}</Text>
          </View>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.details}>
          <Text style={styles.small}>
            Compras de {invoice.periodStart} a {invoice.closingDate} (dia do fechamento)
          </Text>

          {invoice.purchases.length === 0 ? (
            <Text style={[styles.small, styles.spaced]}>Nenhuma compra nessa fatura.</Text>
          ) : (
            invoice.purchases.map((purchase) => (
              <View key={purchase.id} style={styles.purchaseRow}>
                <View style={styles.purchaseText}>
                  <Text style={styles.purchaseTitle}>{purchaseTitle(purchase)}</Text>
                  <Text style={styles.small}>
                    {purchase.date} · {purchase.category}
                  </Text>
                </View>
                <Text style={styles.purchaseAmount}>{formatCurrency(purchase.amount)}</Text>
                {!isPaid ? (
                  <View style={styles.purchaseActions}>
                    {purchase.amount > 0 ? (
                      <TouchableOpacity
                        onPress={() => onEditPurchase(purchase)}
                        style={styles.iconButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Editar compra ${purchase.description}`}
                      >
                        <Ionicons name="pencil" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      onPress={() => onDeletePurchase(purchase)}
                      style={styles.iconButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Excluir compra ${purchase.description}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.expense} />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))
          )}

          {invoice.credits > 0 ? (
            <Text style={[styles.small, styles.spaced]}>
              Compras {formatCurrency(invoice.spend)} − créditos {formatCurrency(invoice.credits)} (pagamento recebido, estorno) ={" "}
              {formatCurrency(invoice.total)} a pagar. Os créditos não entram nos gastos nem nas receitas.
            </Text>
          ) : null}

          {invoice.byCategory.length > 1 ? (
            <View style={styles.spaced}>
              <Text style={styles.smallStrong}>Por categoria</Text>
              {invoice.byCategory.map((item) => (
                <View key={item.category} style={styles.categoryRow}>
                  <Text style={styles.small}>{item.category}</Text>
                  <Text style={styles.small}>{formatCurrency(item.total)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {isPaid && invoice.payment ? (
            <View style={styles.spaced}>
              <Text style={styles.small}>
                Paga em {invoice.payment.paid_date}: {formatCurrency(invoice.payment.amount)}. O gasto já estava nas despesas, compra por compra.
              </Text>
              <TouchableOpacity
                onPress={onUndoPayment}
                style={styles.secondaryButton}
                accessibilityRole="button"
                accessibilityLabel={`Desfazer pagamento da fatura ${invoice.label}`}
              >
                <Text style={styles.secondaryText}>Desfazer pagamento</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {canPay ? (
            <TouchableOpacity
              onPress={onPay}
              style={styles.payButton}
              accessibilityRole="button"
              accessibilityLabel={`Pagar fatura ${invoice.label}`}
            >
              <Text style={styles.payText}>Pagar fatura · {formatCurrency(invoice.total)}</Text>
            </TouchableOpacity>
          ) : null}

          {!isPaid && invoice.purchases.length > 0 ? (
            <TouchableOpacity
              onPress={onDeleteInvoice}
              style={styles.deleteButton}
              accessibilityRole="button"
              accessibilityLabel={`Excluir fatura ${invoice.label} inteira`}
            >
              <Text style={styles.deleteText}>Excluir fatura inteira</Text>
            </TouchableOpacity>
          ) : null}

          {invoice.status === "open" ? (
            <Text style={[styles.small, styles.spaced]}>
              A fatura ainda está aberta e recebe compras até {invoice.closingDate}. Se marcar como paga agora, ela não recebe mais compras.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  box: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    marginTop: 8,
  },
  summary: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8 },
  summaryText: { flex: 1 },
  summaryRight: { alignItems: "flex-end", gap: 4 },
  invoiceLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  total: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  small: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  smallStrong: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  spaced: { marginTop: 10 },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  details: { paddingHorizontal: 12, paddingBottom: 12 },
  purchaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  purchaseText: { flex: 1 },
  purchaseTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  purchaseAmount: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  purchaseActions: { flexDirection: "row" },
  iconButton: { padding: 8 },
  categoryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  secondaryText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  payButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.accent,
    marginTop: 12,
  },
  deleteButton: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.expense,
    marginTop: 10,
  },
  deleteText: { color: colors.expense, fontSize: 14, fontWeight: "600" },
  payText: { color: colors.textOnColor, fontSize: 15, fontWeight: "700" },
}));
