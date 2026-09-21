import { TouchableOpacity, View } from "react-native";

import { Text, makeStyles } from "../../theme";
import type { CardImportPlan } from "../../utils/cardImport";
import { formatRef } from "../../utils/creditCards";
import { formatCurrency } from "../../utils/currency";
import { TopFormSheet } from "../forms/TopFormSheet";

interface InvoiceImportModalProps {
  visible: boolean;
  cardName: string;
  /** A leitura do arquivo; null com o modal fechado. */
  plan: CardImportPlan | null;
  onSelectRef: (ref: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  isBusy?: boolean;
  /** Erro vindo de fora (ex.: falha ao gravar). */
  errorMessage?: string | null;
}

const PREVIEW_LIMIT = 5;

/** Conferência da fatura lida de um PDF ou CSV: em qual fatura entra, o que é novo e o que já estava lançado. */
export function InvoiceImportModal({ visible, cardName, plan, onSelectRef, onConfirm, onClose, isBusy = false, errorMessage = null }: InvoiceImportModalProps) {
  const styles = useStyles();

  const rows = plan?.rows ?? [];
  const canConfirm = plan !== null && plan.blocked === null && rows.length > 0 && !isBusy;
  const ignored: string[] = [];
  if (plan && plan.duplicates > 0) ignored.push(`${plan.duplicates} já lançada${plan.duplicates === 1 ? "" : "s"}`);
  if (plan && plan.ignoredCredits > 0) ignored.push(`${plan.ignoredCredits} estorno/saldo`);

  const purchasesCount = plan?.purchasesCount ?? 0;
  const paymentsCount = plan?.paymentsCount ?? 0;
  const purchasesText = `${purchasesCount} ${purchasesCount === 1 ? "compra" : "compras"}`;
  const paymentsText = `${paymentsCount} ${paymentsCount === 1 ? "pagamento" : "pagamentos"}`;
  const importText = paymentsCount === 0 ? purchasesText : purchasesCount === 0 ? paymentsText : `${purchasesText} e ${paymentsText}`;

  const confirmLabel =
    rows.length > 0 ? `Importar ${importText}` : "Nada novo para importar";
  const shownError = errorMessage ?? plan?.blocked ?? null;

  return (
    <TopFormSheet visible={visible} onClose={onClose} title={`Importar fatura do ${cardName}`}>
      {plan ? (
        <>
          <Text style={styles.summary}>
            {purchasesCount} {purchasesCount === 1 ? "compra nova" : "compras novas"} ({formatCurrency(plan.purchasesTotal)})
            {paymentsCount > 0
              ? `, ${paymentsCount} ${paymentsCount === 1 ? "pagamento antecipado" : "pagamentos antecipados"} (− ${formatCurrency(plan.paymentsTotal)})`
              : ""}
            {ignored.length > 0 ? `. Ignoradas: ${ignored.join(", ")}` : ""}.
          </Text>
          {paymentsCount > 0 ? (
            <Text style={styles.match}>
              Os pagamentos recebidos antes do fechamento descontam do total: a fatura fica em {formatCurrency(plan.invoiceTotal)}.
            </Text>
          ) : null}

          <Text style={styles.label}>Entra na fatura de</Text>
          <View style={styles.chipRow}>
            {plan.refOptions.map((ref) => {
              const selected = ref === plan.ref;
              return (
                <TouchableOpacity
                  key={ref}
                  onPress={() => onSelectRef(ref)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Fatura ${formatRef(ref)}`}
                >
                  <Text style={styles.chipText}>{formatRef(ref)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>Todas as linhas do arquivo entram nessa fatura. Troque se o app escolheu a errada.</Text>

          {rows.length > 0 ? (
            <View style={styles.preview}>
              {rows.slice(0, PREVIEW_LIMIT).map((row, index) => (
                <Text key={`${row.date}-${row.description}-${index}`} style={styles.previewLine}>
                  {row.date.slice(0, 5)}  {row.description}
                  {row.installment_number ? ` (${row.installment_number}/${row.installment_total})` : ""}  {formatCurrency(row.amount)}
                </Text>
              ))}
              {rows.length > PREVIEW_LIMIT ? <Text style={styles.previewLine}>… e mais {rows.length - PREVIEW_LIMIT}</Text> : null}
            </View>
          ) : null}

          <Text style={styles.hint}>
            As compras ficam fora do seu saldo até a fatura ser paga. Confira os valores antes de importar.
          </Text>
        </>
      ) : null}

      {shownError ? <Text style={styles.error}>{shownError}</Text> : null}

      <TouchableOpacity
        onPress={onConfirm}
        disabled={!canConfirm}
        style={[styles.confirmButton, !canConfirm && styles.disabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canConfirm }}
        accessibilityLabel={confirmLabel}
      >
        <Text style={styles.confirmText}>{confirmLabel}</Text>
      </TouchableOpacity>
    </TopFormSheet>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  summary: { color: colors.textPrimary, fontSize: 15, fontWeight: "600", marginBottom: 14, lineHeight: 21 },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
    minHeight: 44,
    justifyContent: "center",
  },
  chipSelected: { borderColor: colors.accent, backgroundColor: `${colors.accent}26` },
  chipText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 14 },
  preview: { backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 12, marginBottom: 14 },
  previewLine: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  match: { color: colors.textPrimary, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  error: { color: colors.expense, fontSize: 13, marginBottom: 12 },
  confirmButton: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  disabled: { opacity: 0.4 },
  confirmText: { color: colors.textPrimary, fontWeight: "bold", fontSize: 16 },
}));
