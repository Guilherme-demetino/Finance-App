import type { TransactionType } from "../../types";
import type { ImportedTransaction } from "./importCsv";
import {
  guessCategory,
  isInternalTransfer,
  normalizeText,
  parseSignedAmount,
} from "./statementParsing";

const MONEY = String.raw`(?:R\$\s*)?-?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}`;
// "01/09/2026 Voce recebeu um Pix de Fulano 88250398513 150,00 1.650,00":
// data, descrição, ID da operação, valor (com "-" nas saídas) e saldo.
const ROW = new RegExp(
  `^(\\d{2})[/-](\\d{2})[/-](\\d{4})\\s+(.+?)\\s+(\\d{6,})\\s+(${MONEY})\\s+${MONEY}\\s*$`,
);
const STATEMENT_HEADER = /^data descricao id da operacao valor saldo/;

/**
 * Lê o extrato de conta do Mercado Pago (PDF): tabela com data, descrição, ID
 * da operação, valor e saldo. Saída vem com "-" no valor, entrada sem sinal.
 * Devolve null se o texto não tiver esse formato, pra quem chama usar outro leitor.
 */
export function parseMercadoPagoLines(lines: string[]): {
  transactions: ImportedTransaction[];
  invalid: number;
  totalRows: number;
  ignoredTransfers: number;
} | null {
  const transactions: ImportedTransaction[] = [];
  let sawHeader = false;
  let matched = 0;
  let invalid = 0;
  let totalRows = 0;
  let ignoredTransfers = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (STATEMENT_HEADER.test(normalizeText(line))) {
      sawHeader = true;
      continue;
    }

    const match = line.match(ROW);
    if (!match) continue;
    matched++;

    const description = match[4].replace(/\s+/g, " ").trim().slice(0, 80);
    if (normalizeText(description).startsWith("saldo")) continue;

    if (isInternalTransfer(description)) {
      ignoredTransfers++;
      continue;
    }

    totalRows++;
    const parsed = parseSignedAmount(match[6].replace(/R\$/g, "").replace(/\s+/g, ""));
    if (!parsed) {
      invalid++;
      continue;
    }

    const type: TransactionType = parsed.sign === "negative" ? "expense" : "income";
    const title = description || "Sem título";
    transactions.push({
      amount: parsed.amount,
      date: `${match[1]}/${match[2]}/${match[3]}`,
      description: title,
      type,
      category: guessCategory(title, type),
    });
  }

  if (matched === 0 || (!sawHeader && matched < 2)) return null;

  return { transactions, invalid, totalRows, ignoredTransfers };
}
