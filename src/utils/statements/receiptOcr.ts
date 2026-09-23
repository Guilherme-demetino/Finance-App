import { formatDateToString } from "../dates";
import { guessCategory, normalizeText, parseFlexibleDate, parseSignedAmount } from "./statementParsing";

/**
 * Lê o texto reconhecido (OCR) de uma foto de recibo/cupom fiscal e chuta valor, data, descrição e
 * categoria — reaproveitando as mesmas heurísticas de data/valor/categoria usadas nos extratos em PDF
 * (ver statementParsing.ts). Um recibo não tem colunas fixas como um extrato de banco, então a leitura
 * aqui é por palavras-chave e "o maior valor da página" em vez de uma linha por lançamento.
 */
export interface ParsedReceipt {
  amount: number | null;
  date: string; // DD/MM/AAAA — hoje, se nenhuma data foi encontrada no recibo
  description: string | null;
  category: string | null;
}

// Contém "subtotal" tem prioridade zero: é sempre menor que o total e não pode ser confundido com ele.
const TOTAL_KEYWORDS = ["total a pagar", "valor total", "total geral", "total r$", "total"];

const MONEY_TOKEN = /\d{1,3}(?:[.,]\d{3})*[.,]\d{2}/g;

/** O último valor com cara de dinheiro (R$ 1.234,56, 45,90...) numa linha; null se não achar nenhum. */
function lastAmountInLine(line: string): number | null {
  const matches = line.match(MONEY_TOKEN);
  if (!matches || matches.length === 0) return null;
  const parsed = parseSignedAmount(matches[matches.length - 1]);
  return parsed?.amount ?? null;
}

/** Prioriza uma linha com "total" (e não "subtotal"); sem isso, assume que o total é o maior valor da página. */
function findAmount(lines: string[]): number | null {
  for (const line of lines) {
    const norm = normalizeText(line);
    if (norm.includes("subtotal")) continue;
    if (TOTAL_KEYWORDS.some((keyword) => norm.includes(keyword))) {
      const amount = lastAmountInLine(line);
      if (amount !== null) return amount;
    }
  }

  let largest: number | null = null;
  for (const line of lines) {
    const amount = lastAmountInLine(line);
    if (amount !== null && (largest === null || amount > largest)) largest = amount;
  }
  return largest;
}

/** A primeira data (DD/MM/AAAA, DD/MM/AA...) encontrada em qualquer lugar de qualquer linha. */
function findDate(lines: string[]): string | null {
  for (const line of lines) {
    const match = line.match(/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/);
    if (!match) continue;
    const parsed = parseFlexibleDate(match[0]);
    if (parsed) return parsed;
  }
  return null;
}

/** A primeira linha com cara de nome de loja: nem vazia, nem só números (evita CNPJ, chave de acesso...). */
function findDescription(lines: string[]): string | null {
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;
    if (/^[\d\s./-]+$/.test(trimmed)) continue;
    return trimmed;
  }
  return null;
}

export function parseReceiptText(rawText: string, today: Date = new Date()): ParsedReceipt {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const amount = findAmount(lines);
  const date = findDate(lines) ?? formatDateToString(today);
  const description = findDescription(lines);
  const category = description ? guessCategory(description, "expense") : null;

  return { amount, date, description, category };
}
