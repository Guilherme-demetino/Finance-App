import type { TransactionRow, TransactionType } from "../../types";

export interface ImportedTransaction {
  amount: number;
  date: string; // DD/MM/AAAA
  description: string;
  type: TransactionType;
  category: string;
}

export interface CsvImportPlan {
  /** De onde veio o arquivo: backup do próprio app, CSV de banco, extrato em PDF ou planilha do Excel. */
  source?: "backup" | "csv" | "pdf" | "xlsx";
  /** Transações novas, prontas pra serem gravadas. */
  toImport: ImportedTransaction[];
  /** Linhas de dados lidas do arquivo (sem o cabeçalho). */
  totalRows: number;
  /** Linhas que já existem no app (mesma data, título, categoria, tipo e valor). */
  duplicates: number;
  /** Linhas ignoradas por data, tipo ou valor inválidos. */
  invalid: number;
  /** Movimentações entre a conta e caixinhas/investimentos, que não viram receita nem despesa. */
  ignoredTransfers?: number;
  /** Pagamentos de fatura de cartão que o extrato trazia e ficaram de fora: a despesa entra ao pagar a fatura na aba Cartões. */
  cardPaymentsIgnored?: number;
}

export type CsvImportResult =
  | { ok: true; plan: CsvImportPlan }
  | { ok: false; error: string };

/** Lê um CSV (separado por `;` por padrão), com suporte a campos entre aspas (com o separador, aspas duplas e quebras de linha). */
export function parseCsv(text: string, delimiter = ";"): string[][] {
  const source = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function parseDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const isRealDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  if (!isRealDate) return null;

  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function parseType(raw: string): TransactionType | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "receita" || normalized === "income") return "income";
  if (normalized === "despesa" || normalized === "expense") return "expense";
  return null;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;

  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;

  return Math.round(value * 100) / 100;
}

function duplicateKey(
  date: string,
  description: string,
  category: string,
  type: TransactionType,
  amount: number,
): string {
  return [
    date,
    description.trim().toLowerCase(),
    category.trim().toLowerCase(),
    type,
    amount.toFixed(2),
  ].join("|");
}

/**
 * Separa o que é novo do que já existe no app. Linhas repetidas no arquivo
 * contam uma a uma: se o app já tem 1 de 2 iguais, só a outra é importada.
 */
export function buildImportPlan(
  candidates: ImportedTransaction[],
  existing: TransactionRow[],
  counts: { totalRows: number; invalid: number; ignoredTransfers?: number },
  source: CsvImportPlan["source"],
): CsvImportPlan {
  const remainingExisting = new Map<string, number>();
  existing.forEach((t) => {
    const key = duplicateKey(
      t.date,
      t.description || "",
      t.category_id || "",
      t.type,
      Number(t.amount),
    );
    remainingExisting.set(key, (remainingExisting.get(key) ?? 0) + 1);
  });

  const toImport: ImportedTransaction[] = [];
  let duplicates = 0;

  candidates.forEach((candidate) => {
    const key = duplicateKey(
      candidate.date,
      candidate.description,
      candidate.category,
      candidate.type,
      candidate.amount,
    );
    const available = remainingExisting.get(key) ?? 0;
    if (available > 0) {
      remainingExisting.set(key, available - 1);
      duplicates++;
      return;
    }
    toImport.push(candidate);
  });

  return {
    source,
    toImport,
    totalRows: counts.totalRows,
    duplicates,
    invalid: counts.invalid,
    ignoredTransfers: counts.ignoredTransfers,
  };
}

/**
 * Lê um CSV de backup (o mesmo formato gerado pela exportação) e separa o
 * que é novo do que já existe no app.
 */
export function planCsvImport(
  csvText: string,
  existing: TransactionRow[],
): CsvImportResult {
  return planBackupRowsImport(parseCsv(csvText), existing);
}

/** Mesma leitura do backup, a partir de linhas já separadas em colunas (ex: planilha do Excel). */
export function planBackupRowsImport(
  rows: string[][],
  existing: TransactionRow[],
  source: CsvImportPlan["source"] = "backup",
): CsvImportResult {
  const header = rows[0];

  if (
    !header ||
    header.length < 5 ||
    header[0].trim().toLowerCase() !== "data" ||
    header[4].trim().toLowerCase() !== "valor"
  ) {
    return {
      ok: false,
      error:
        "Esse arquivo não parece um backup exportado pelo app (cabeçalho Data;Descrição;Categoria;Tipo;Valor não encontrado).",
    };
  }

  const candidates: ImportedTransaction[] = [];
  let invalid = 0;
  const dataRows = rows.slice(1);

  dataRows.forEach((cols) => {
    const date = parseDate(cols[0] ?? "");
    const type = parseType(cols[3] ?? "");
    const amount = parseAmount(cols[4] ?? "");
    if (!date || !type || amount === null) {
      invalid++;
      return;
    }

    const description = (cols[1] ?? "").trim() || "Sem título";
    const category = (cols[2] ?? "").trim() || "Geral";
    candidates.push({ amount, date, description, type, category });
  });

  return {
    ok: true,
    plan: buildImportPlan(
      candidates,
      existing,
      { totalRows: dataRows.length, invalid },
      source,
    ),
  };
}
