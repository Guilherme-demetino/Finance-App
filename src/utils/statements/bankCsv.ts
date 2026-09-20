import type { TransactionRow, TransactionType } from "../../types";
import {
  buildImportPlan,
  parseCsv,
  type CsvImportResult,
  type ImportedTransaction,
} from "./importCsv";
import {
  guessCategory,
  isInternalTransfer,
  normalizeText,
  parseFlexibleDate,
  parseSignedAmount,
} from "./statementParsing";

const DELIMITERS = [";", ",", "\t", "|"];
const MAX_HEADER_SEARCH_ROWS = 20;

/** Escolhe o separador que mais aparece nas primeiras linhas do arquivo (`;` ganha empates). */
function detectDelimiter(text: string): string {
  const sample = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .slice(0, 10);

  let best = ";";
  let bestScore = 0;
  DELIMITERS.forEach((delimiter) => {
    const score = sample.reduce(
      (total, line) => total + line.split(delimiter).length - 1,
      0,
    );
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  });
  return best;
}

interface ColumnMap {
  date: number;
  description: number[];
  amount: number | null;
  debit: number | null;
  credit: number | null;
  type: number | null;
  /** Nubank (fatura do cartão) manda compras como positivo — precisa inverter. */
  invertSign: boolean;
}

const DATE_HEADER = /^(data|date|dt)\b/;
const DESCRIPTION_HEADER =
  /(descricao|historico|lancamento|title|titulo|estabelecimento|memo|detalhe|beneficiario|favorecido)/;
const AMOUNT_HEADER = /^(valor|amount|quantia|montante)/;
const DEBIT_HEADER = /^(debito|saida|saidas|debit)/;
const CREDIT_HEADER = /^(credito|entrada|entradas|credit)/;
const TYPE_HEADER =
  /(^tipo\b|natureza|^d\/c$|^c\/d$|credito\/debito|debito\/credito|^dc$)/;
const IGNORED_HEADER = /(saldo|balance|identificador|^id$)/;

/** Procura o cabeçalho nas primeiras linhas (alguns bancos mandam um título e o período antes). */
function findColumnMap(rows: string[][]): { map: ColumnMap; headerIndex: number } | null {
  const limit = Math.min(rows.length, MAX_HEADER_SEARCH_ROWS);

  for (let index = 0; index < limit; index++) {
    const headers = rows[index].map((cell) => normalizeText(cell));
    const date = headers.findIndex((h) => DATE_HEADER.test(h));
    if (date === -1) continue;

    const usable = headers.map((h) => !IGNORED_HEADER.test(h));
    const find = (pattern: RegExp, exclude: number[] = []) =>
      headers.findIndex(
        (h, i) => usable[i] && i !== date && !exclude.includes(i) && pattern.test(h),
      );

    const type = find(TYPE_HEADER);
    const amount = find(AMOUNT_HEADER);
    const debit = type === -1 ? find(DEBIT_HEADER) : -1;
    const credit = type === -1 ? find(CREDIT_HEADER) : -1;
    if (amount === -1 && debit === -1 && credit === -1) continue;

    const description = headers
      .map((h, i) => (usable[i] && i !== date && DESCRIPTION_HEADER.test(h) ? i : -1))
      .filter((i) => i !== -1)
      .slice(0, 2);

    const isNubankCard =
      headers.includes("category") &&
      headers.includes("title") &&
      headers.includes("amount");

    return {
      headerIndex: index,
      map: {
        date,
        description,
        amount: amount === -1 ? null : amount,
        debit: debit === -1 ? null : debit,
        credit: credit === -1 ? null : credit,
        type: type === -1 ? null : type,
        invertSign: isNubankCard,
      },
    };
  }

  return null;
}

/** Sem cabeçalho: descobre as colunas pelo conteúdo (data, valor e o texto mais longo). */
function guessColumnMap(rows: string[][]): ColumnMap | null {
  const sample = rows.slice(0, 30);
  const width = Math.max(...sample.map((r) => r.length), 0);
  if (width < 2) return null;

  const score = (column: number, test: (cell: string) => boolean) =>
    sample.filter((row) => test(row[column] ?? "")).length;

  let date = -1;
  let dateScore = 0;
  for (let c = 0; c < width; c++) {
    const s = score(c, (cell) => parseFlexibleDate(cell) !== null);
    if (s > dateScore) {
      date = c;
      dateScore = s;
    }
  }
  if (date === -1) return null;

  let amount = -1;
  let amountScore = 0;
  for (let c = 0; c < width; c++) {
    if (c === date) continue;
    const s = score(c, (cell) => /\d/.test(cell) && parseSignedAmount(cell) !== null);
    if (s > amountScore) {
      amount = c;
      amountScore = s;
    }
  }
  if (amount === -1) return null;

  let description = -1;
  let longest = 0;
  for (let c = 0; c < width; c++) {
    if (c === date || c === amount) continue;
    const total = sample.reduce(
      (sum, row) => (/[a-zA-Z]/.test(row[c] ?? "") ? sum + (row[c] ?? "").length : sum),
      0,
    );
    if (total > longest) {
      description = c;
      longest = total;
    }
  }

  return {
    date,
    description: description === -1 ? [] : [description],
    amount,
    debit: null,
    credit: null,
    type: null,
    invertSign: false,
  };
}

function typeFromColumn(raw: string): TransactionType | null {
  const value = normalizeText(raw);
  if (!value) return null;
  if (/^(d|deb|debito|saida|despesa|expense|debit)\b/.test(value)) return "expense";
  if (/^(c|cred|credito|entrada|receita|income|credit)\b/.test(value)) return "income";
  return null;
}

function buildDescription(cols: string[], indexes: number[]): string {
  const parts: string[] = [];
  indexes.forEach((i) => {
    const value = (cols[i] ?? "").replace(/\s+/g, " ").trim();
    if (value && !parts.includes(value)) parts.push(value);
  });
  return parts.join(" - ").slice(0, 80);
}

/**
 * Lê o CSV de qualquer banco (extrato de conta ou fatura): detecta o
 * separador, acha o cabeçalho e descobre sozinho as colunas de data,
 * descrição e valor (ou débito/crédito). Valor negativo é despesa e
 * positivo é receita. Cada transação ganha uma categoria sugerida.
 */
export function planBankCsvImport(
  csvText: string,
  existing: TransactionRow[],
): CsvImportResult {
  return planBankRowsImport(parseCsv(csvText, detectDelimiter(csvText)), existing);
}

/** Mesma leitura do CSV de banco, a partir de linhas já separadas em colunas (ex: planilha do Excel). */
export function planBankRowsImport(
  rows: string[][],
  existing: TransactionRow[],
  source: "csv" | "xlsx" = "csv",
): CsvImportResult {

  const found = findColumnMap(rows);
  const map = found?.map ?? guessColumnMap(rows);
  if (!map) {
    return {
      ok: false,
      error:
        "Não consegui identificar as colunas de data e valor nesse arquivo. Confira se é um extrato em CSV.",
    };
  }

  const dataRows = found ? rows.slice(found.headerIndex + 1) : rows;
  const candidates: ImportedTransaction[] = [];
  let invalid = 0;
  let totalRows = 0;
  let ignoredTransfers = 0;

  dataRows.forEach((cols) => {
    if (cols.every((cell) => cell.trim() === "")) return;

    const description = buildDescription(cols, map.description) || "Sem título";
    // "Saldo anterior/final" não é transação.
    if (/^saldo\b/.test(normalizeText(description))) return;
    // Guardar/resgatar de caixinha ou investimento não é receita nem despesa.
    if (isInternalTransfer(description)) {
      ignoredTransfers++;
      return;
    }

    totalRows++;
    const date = parseFlexibleDate(cols[map.date] ?? "");
    if (!date) {
      invalid++;
      return;
    }

    let amount: number | null = null;
    let type: TransactionType | null = null;

    if (map.amount !== null) {
      const parsed = parseSignedAmount(cols[map.amount] ?? "");
      if (parsed) {
        amount = parsed.amount;
        const negative = parsed.sign === "negative";
        type = negative !== map.invertSign ? "expense" : "income";
      }
    } else {
      const debit = map.debit !== null ? parseSignedAmount(cols[map.debit] ?? "") : null;
      const credit = map.credit !== null ? parseSignedAmount(cols[map.credit] ?? "") : null;
      if (debit) {
        amount = debit.amount;
        type = "expense";
      } else if (credit) {
        amount = credit.amount;
        type = "income";
      }
    }

    if (map.type !== null) {
      const explicit = typeFromColumn(cols[map.type] ?? "");
      if (explicit) type = explicit;
    }

    if (amount === null || type === null) {
      invalid++;
      return;
    }

    candidates.push({
      amount,
      date,
      description,
      type,
      category: guessCategory(description, type),
    });
  });

  return {
    ok: true,
    plan: buildImportPlan(
      candidates,
      existing,
      { totalRows, invalid, ignoredTransfers },
      source,
    ),
  };
}
