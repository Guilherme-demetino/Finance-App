import type { TransactionRow, TransactionType } from "../types";

interface ImportedTransaction {
  amount: number;
  date: string; // DD/MM/AAAA
  description: string;
  type: TransactionType;
  category: string;
}

export interface CsvImportPlan {
  /** Transações novas, prontas pra serem gravadas. */
  toImport: ImportedTransaction[];
  /** Linhas de dados lidas do arquivo (sem o cabeçalho). */
  totalRows: number;
  /** Linhas que já existem no app (mesma data, título, categoria, tipo e valor). */
  duplicates: number;
  /** Linhas ignoradas por data, tipo ou valor inválidos. */
  invalid: number;
}

type CsvImportResult =
  | { ok: true; plan: CsvImportPlan }
  | { ok: false; error: string };

/** Lê um CSV separado por `;`, com suporte a campos entre aspas (com `;`, aspas duplas e quebras de linha). */
export function parseCsv(text: string): string[][] {
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
    } else if (char === ";") {
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
 * Lê um CSV de backup (o mesmo formato gerado pela exportação) e separa o
 * que é novo do que já existe no app. Linhas repetidas no arquivo contam
 * uma a uma: se o app já tem 1 de 2 iguais, só a outra é importada.
 */
export function planCsvImport(
  csvText: string,
  existing: TransactionRow[],
): CsvImportResult {
  const rows = parseCsv(csvText);
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

    const key = duplicateKey(date, description, category, type, amount);
    const available = remainingExisting.get(key) ?? 0;
    if (available > 0) {
      remainingExisting.set(key, available - 1);
      duplicates++;
      return;
    }

    toImport.push({ amount, date, description, type, category });
  });

  return {
    ok: true,
    plan: { toImport, totalRows: dataRows.length, duplicates, invalid },
  };
}
