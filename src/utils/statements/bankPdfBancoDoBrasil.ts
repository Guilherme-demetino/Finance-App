import type { TransactionType } from "../../types";
import type { ImportedTransaction } from "./importCsv";
import {
  guessCategory,
  isInternalTransfer,
  normalizeText,
  parseSignedAmount,
} from "./statementParsing";

// "08/09/2026 20000 22201 25,00 (-)": data, lote/documento/texto e valor com (+) ou (-).
const ROW =
  /^(\d{2}\/\d{2}\/\d{4})\s+(.*?)\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*\(([+-])\)\s*$/;
const STATEMENT_HEADER = /^dia lote documento/;
// Linhas repetidas no topo de cada página, que não fazem parte de nenhum lançamento.
const PAGE_NOISE = [
  /^extrato de conta/,
  /^cliente:/,
  /^periodo:/,
  /^agencia/,
  /^lancamentos$/,
  STATEMENT_HEADER,
];
const PIX_DETAIL = /^\d{2}\/\d{2} \d{2}:\d{2}\b/;
const END_OF_TRANSACTIONS = /^informacoes adicionais/;

interface Row {
  date: string;
  amount: string;
  sign: "+" | "-";
  /** Texto que o próprio PDF colocou na linha da data, depois de lote/documento. */
  inline: string;
  above: string[];
  below: string[];
}

function isBalanceRow(row: Row): boolean {
  const text = normalizeText(row.inline).replace(/\s/g, "");
  return text.startsWith("saldo");
}

function cleanDescription(parts: string[]): string {
  return (
    parts
      .join(" ")
      // Data e hora do Pix ("05/09 10:44"), CNPJ/CPF e números de documento.
      .replace(/\b\d{2}\/\d{2}\s+\d{2}:\d{2}\b/g, " ")
      .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, " ")
      .replace(/\b\d{7,}-?/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^[\s\-–—:|.]+|[\s\-–—:|.]+$/g, "")
      .slice(0, 80)
  );
}

/**
 * No extrato do Banco do Brasil o texto do histórico fica em várias linhas
 * centralizadas na linha da data: o título ("Pix - Enviado") sai antes dela e
 * o detalhe (nome, CNPJ) depois. As linhas soltas entre dois lançamentos são
 * divididas ao meio: a primeira metade é detalhe do lançamento de cima, a
 * segunda é título do de baixo. Linhas de saldo não têm histórico, então tudo
 * que fica ao lado delas pertence ao outro lançamento.
 */
function attachLooseLines(rows: Row[], gaps: string[][]): void {
  gaps.forEach((gap, index) => {
    const before = rows[index - 1];
    const after = rows[index];

    if (before && after) {
      let split = Math.floor(gap.length / 2);
      // Detalhe de Pix ("05/09 10:44 Nome") nunca é título do lançamento de baixo.
      gap.forEach((line, position) => {
        if (PIX_DETAIL.test(line)) split = Math.max(split, position + 1);
      });
      if (isBalanceRow(before)) split = 0;
      else if (isBalanceRow(after)) split = gap.length;
      before.below.push(...gap.slice(0, split));
      after.above.push(...gap.slice(split));
    } else if (before) {
      before.below.push(...gap);
    } else if (after) {
      after.above.push(...gap);
    }
  });
}

/**
 * Lê o extrato de conta corrente do Banco do Brasil (PDF): valor seguido de
 * "(+)" ou "(-)" e histórico espalhado em várias linhas. Devolve null se o
 * texto não tiver esse formato, pra quem chama usar o leitor genérico.
 */
export function parseBancoDoBrasilLines(lines: string[]): {
  transactions: ImportedTransaction[];
  invalid: number;
  totalRows: number;
  ignoredTransfers: number;
} | null {
  const rows: Row[] = [];
  const gaps: string[][] = [[]];
  let sawHeader = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    const normalized = normalizeText(line);
    if (STATEMENT_HEADER.test(normalized)) sawHeader = true;
    if (END_OF_TRANSACTIONS.test(normalized)) break;

    const match = line.match(ROW);
    if (match) {
      rows.push({
        date: match[1],
        amount: match[3],
        sign: match[4] as "+" | "-",
        // Tira lote e documento (números soltos no começo).
        inline: match[2].replace(/^(?:\d+(?:\s+|$)){1,2}/, "").trim(),
        above: [],
        below: [],
      });
      gaps.push([]);
      continue;
    }

    if (!line || PAGE_NOISE.some((noise) => noise.test(normalized))) continue;
    gaps[gaps.length - 1].push(line);
  }

  if (rows.length === 0 || (!sawHeader && rows.length < 2)) return null;

  attachLooseLines(rows, gaps);

  const transactions: ImportedTransaction[] = [];
  let invalid = 0;
  let totalRows = 0;
  let ignoredTransfers = 0;

  rows.forEach((row) => {
    if (isBalanceRow(row)) return;

    const description = cleanDescription([...row.above, row.inline, ...row.below]);
    if (isInternalTransfer(description)) {
      ignoredTransfers++;
      return;
    }

    totalRows++;
    const parsed = parseSignedAmount(row.amount);
    if (!parsed) {
      invalid++;
      return;
    }

    const type: TransactionType = row.sign === "+" ? "income" : "expense";
    const title = description || "Sem título";
    transactions.push({
      amount: parsed.amount,
      date: row.date,
      description: title,
      type,
      category: guessCategory(title, type),
    });
  });

  return { transactions, invalid, totalRows, ignoredTransfers };
}
