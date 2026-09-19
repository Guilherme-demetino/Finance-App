import type { TransactionRow, TransactionType } from "../types";
import { parseBancoDoBrasilLines } from "./bankPdfBancoDoBrasil";
import {
  buildImportPlan,
  type CsvImportResult,
  type ImportedTransaction,
} from "./importCsv";
import {
  guessCategory,
  guessTypeFromDescription,
  isInternalTransfer,
  normalizeText,
  parseSignedAmount,
  type AmountSign,
} from "./statementParsing";

const MONTH_ABBREVIATIONS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

// Data numérica no começo da linha: DD/MM, DD/MM/AA ou DD/MM/AAAA.
const NUMERIC_DATE = /^\s*(\d{2})[/.-](\d{2})(?:[/.-](\d{4}|\d{2}))?(?![\d/])/;
// Data por extenso no começo da linha: "05 JAN", "5 de jan de 2025".
const NAMED_DATE =
  /^\s*(\d{1,2})\s*(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?(?:\s*(?:de\s+)?(\d{4}))?/i;
// Valor em reais com vírgula decimal, com sinal/R$/D/C opcionais em volta.
const MONEY =
  /(?:\(\s*)?[-−+]?\s*(?:R\$\s*)?[-−+]?\s*(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?!\d)(?:\s*[-−])?(?:\s*\))?(?:\s*[DC]\b)?/g;
const FULL_DATE = /\b(\d{2})[/.-](\d{2})[/.-](\d{4})\b/g;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isRealDate(day: number, month: number, year: number): boolean {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Data de referência do extrato: a última data completa (com ano) escrita no
 * documento, como o fim do período ou o vencimento. Serve pra descobrir o ano
 * de datas que vêm só como DD/MM. Sem nenhuma, usa hoje.
 */
function detectAnchorDate(lines: string[], today: Date): Date {
  const limit = today.getTime() + DAY_MS * 62;
  let anchor: Date | null = null;

  lines.forEach((line) => {
    for (const match of line.matchAll(FULL_DATE)) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      if (year < 2000 || !isRealDate(day, month, year)) continue;

      const date = new Date(year, month - 1, day);
      if (date.getTime() <= limit && (!anchor || date > anchor)) anchor = date;
    }
  });

  return anchor ?? today;
}

interface LineDate {
  date: string;
  rest: string;
}

/** Lê a data no começo da linha; sem ano escrito, deduz pelo ano da data de referência do extrato. */
function readLeadingDate(line: string, anchor: Date): LineDate | null {
  let day: number;
  let month: number;
  let explicitYear: number | null = null;
  let consumed: number;

  const numeric = line.match(NUMERIC_DATE);
  if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
    if (numeric[3]) {
      explicitYear =
        numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    }
    consumed = numeric[0].length;
  } else {
    const named = line.match(NAMED_DATE);
    if (!named) return null;
    day = Number(named[1]);
    month = MONTH_ABBREVIATIONS.indexOf(named[2].toLowerCase()) + 1;
    if (named[3]) explicitYear = Number(named[3]);
    consumed = named[0].length;
  }

  let year = explicitYear ?? anchor.getFullYear();
  if (!isRealDate(day, month, year)) return null;

  if (explicitYear === null) {
    // Sem ano escrito: fica no ano da referência, ou no anterior se a data
    // passaria de um mês depois dela (ex: compra de dezembro numa fatura de janeiro).
    const limit = new Date(anchor.getTime() + DAY_MS * 31);
    if (new Date(year, month - 1, day) > limit) year -= 1;
  }

  return {
    date: `${pad(day)}/${pad(month)}/${year}`,
    rest: line.slice(consumed),
  };
}

/** Tira uma segunda data colada logo depois da primeira (ex: data da compra + data do lançamento). */
function stripExtraLeadingDates(text: string): string {
  let result = text;
  for (let i = 0; i < 2; i++) {
    const next = result.replace(/^\s*\d{2}[/.-]\d{2}(?:[/.-](?:\d{4}|\d{2}))?(?![\d/])/, "");
    if (next === result) break;
    result = next;
  }
  return result;
}

function cleanDescription(text: string): string {
  return text
    .replace(/R\$/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:|.]+|[\s\-–—:|.]+$/g, "")
    // Data do Pix colada no nome ("Fulano08/09"); "COMPRA 03/10" (parcela) fica.
    .replace(/([A-Za-zÀ-ÿ])\d{2}\/\d{2}$/, "$1")
    .slice(0, 80);
}

/**
 * Interpreta as linhas de texto de um extrato em PDF. Cada transação é uma
 * linha que começa com data e tem um valor em reais (o primeiro valor da
 * linha é o da transação; um segundo costuma ser o saldo). Sinal "-", "D" ou
 * parênteses = despesa; "+" ou "C" = receita; sem sinal, é receita em extrato
 * de conta que usa "-" nas despesas (estilo Itaú) e, senão, decide pela descrição. Linhas de saldo e totais são ignoradas.
 */
export function parseStatementLines(
  lines: string[],
  today: Date = new Date(),
): {
  transactions: ImportedTransaction[];
  invalid: number;
  totalRows: number;
  ignoredTransfers: number;
} {
  const bancoDoBrasil = parseBancoDoBrasilLines(lines);
  if (bancoDoBrasil) return bancoDoBrasil;

  const anchor = detectAnchorDate(lines, today);
  const parsedRows: {
    amount: number;
    sign: AmountSign;
    date: string;
    title: string;
  }[] = [];
  let invalid = 0;
  let totalRows = 0;
  let ignoredTransfers = 0;
  let sawBalanceRows = false;

  lines.forEach((rawLine) => {
    const line = rawLine.replace(/\s+/g, " ").trim();
    const leading = readLeadingDate(line, anchor);
    if (!leading) return;

    const rest = stripExtraLeadingDates(leading.rest);
    MONEY.lastIndex = 0;
    const firstMoney = MONEY.exec(rest);
    if (!firstMoney) return; // data sem valor: cabeçalho ou linha de continuação

    const description = cleanDescription(rest.slice(0, firstMoney.index));
    const normalized = normalizeText(description);
    if (/^(saldo|total|subtotal)\b/.test(normalized) || normalized.includes("saldo")) {
      if (normalized.includes("saldo")) sawBalanceRows = true;
      return;
    }

    if (isInternalTransfer(description)) {
      ignoredTransfers++;
      return;
    }

    totalRows++;
    const parsed = parseSignedAmount(firstMoney[0]);
    if (!parsed) {
      invalid++;
      return;
    }

    parsedRows.push({
      amount: parsed.amount,
      sign: parsed.sign,
      date: leading.date,
      title: description || "Sem título",
    });
  });

  // Extratos de conta como o do Itaú (têm linhas de "saldo do dia") marcam só
  // a despesa com "-" e mostram a receita sem sinal. Nesses, o que vier sem
  // sinal é receita. Em faturas de cartão, sem linhas de saldo, o "-" costuma
  // ser crédito e o resto compra, então decide pela descrição.
  const negatives = parsedRows.filter((r) => r.sign === "negative").length;
  const unsigned = parsedRows.filter((r) => r.sign === "none").length;
  const unsignedIsIncome =
    negatives > 0 && (sawBalanceRows || negatives > unsigned);

  const transactions: ImportedTransaction[] = parsedRows.map((row) => {
    const type: TransactionType =
      row.sign === "negative"
        ? "expense"
        : row.sign === "positive" || unsignedIsIncome
          ? "income"
          : guessTypeFromDescription(row.title);

    return {
      amount: row.amount,
      date: row.date,
      description: row.title,
      type,
      category: guessCategory(row.title, type),
    };
  });

  return { transactions, invalid, totalRows, ignoredTransfers };
}

export function planPdfImport(
  lines: string[],
  existing: TransactionRow[],
  today: Date = new Date(),
): CsvImportResult {
  const { transactions, invalid, totalRows, ignoredTransfers } =
    parseStatementLines(lines, today);

  if (transactions.length === 0 && totalRows === 0 && ignoredTransfers === 0) {
    return {
      ok: false,
      error:
        "Não encontrei transações nesse PDF. Ele pode ser um extrato escaneado (imagem) ou ter um formato que o app ainda não reconhece — nesse caso, tente exportar o extrato em CSV pelo app do banco.",
    };
  }

  return {
    ok: true,
    plan: buildImportPlan(
      transactions,
      existing,
      { totalRows, invalid, ignoredTransfers },
      "pdf",
    ),
  };
}
