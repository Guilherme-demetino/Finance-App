import { formatCurrency } from "../currency";
import type { CsvImportPlan } from "./importCsv";

const SOURCE_LABEL: Record<NonNullable<CsvImportPlan["source"]>, string> = {
  backup: "Backup do app",
  csv: "Extrato em CSV",
  pdf: "Extrato em PDF",
  xlsx: "Planilha do Excel",
};

const PREVIEW_LIMIT = 5;

/**
 * Texto da confirmação de importação: de onde veio o arquivo, quantas
 * transações entram (e quantas foram ignoradas) e uma prévia das primeiras,
 * pra o usuário conferir se a leitura fez sentido antes de gravar.
 */
export function describeImportPlan(plan: CsvImportPlan): string {
  const count = plan.toImport.length;
  const ignored: string[] = [];
  if (plan.duplicates > 0) ignored.push(`${plan.duplicates} já existem`);
  if (plan.invalid > 0) ignored.push(`${plan.invalid} linhas inválidas`);
  if (plan.ignoredTransfers)
    ignored.push(`${plan.ignoredTransfers} movimentações de caixinha/investimento`);

  const header = plan.source ? `${SOURCE_LABEL[plan.source]}: ` : "";
  const summary = `${header}${count} ${count === 1 ? "transação nova" : "transações novas"}${ignored.length > 0 ? ` (${ignored.join(", ")} ignoradas)` : ""}.`;

  const preview = plan.toImport.slice(0, PREVIEW_LIMIT).map((t) => {
    const value = formatCurrency(t.type === "income" ? t.amount : -t.amount);
    return `${t.date.slice(0, 5)}  ${t.description}  ${value}`;
  });
  const rest = count - preview.length;
  if (rest > 0) preview.push(`… e mais ${rest}`);

  const linked = plan.cardPaymentsLinked ?? 0;
  const linkedNote =
    linked > 0
      ? `\n${linked === 1 ? "1 pagamento de fatura de cartão marca" : `${linked} pagamentos de fatura de cartão marcam`} a fatura como paga, sem criar outra despesa.`
      : "";

  return `${summary}${linkedNote}\n\n${preview.join("\n")}\n\nConfira os valores e os tipos antes de importar.`;
}
