import type { TransactionType } from "../../types";
import type { ImportedTransaction } from "./importCsv";
import {
  guessCategory,
  isInternalTransfer,
  normalizeText,
  parseSignedAmount,
} from "./statementParsing";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

// Cabeçalho da tabela da conta corrente (a da poupança não tem "Nº Documento").
const MOVEMENT_HEADER = /^data descricao n.{0,2} documento movimento/;
const END_OF_MOVEMENTS = /^saldos por periodo/;
// "agosto/2026", sozinho ou depois de "Resumo -".
const STATEMENT_MONTH = new RegExp(`(?:^|\\s)(${MONTHS.join("|")})/(\\d{4})$`);
// Linhas repetidas a cada página, que caem no meio da tabela.
const PAGE_NOISE = [
  /^extrato_pf/,
  /^balp_/,
  /^pagina:/,
  /^extrato consolidado/,
  STATEMENT_MONTH,
  MOVEMENT_HEADER,
];
// Conta da mesma agência (poupança): "PARA: 0000.60.000000-0" / "DE: ...".
const OWN_ACCOUNT = /\b(?:PARA|DE):\s*\d{4}\.\d{2}\.\d{6}-\d\b/;
const LEADING_DATE = /^(\d{2})\/(\d{2})\s+/;
// Valor do lançamento (débito termina em "-") e, às vezes, o saldo do dia.
const TRAILING_AMOUNTS =
  /(\d{1,3}(?:\.\d{3})*,\d{2})(-)?(?:\s+\d{1,3}(?:\.\d{3})*,\d{2}-?)?\s*$/;

interface Row {
  day: number;
  month: number;
  amount: string;
  debit: boolean;
  title: string;
  details: string[];
}

function cleanDescription(parts: string[]): string {
  return parts
    .join(" ")
    .replace(/\b\d{7,}-?/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:|.]+|[\s\-–—:|.]+$/g, "")
    .slice(0, 80);
}

/** Mês e ano do extrato ("agosto/2026"), usados pra completar as datas DD/MM. */
function findStatementMonth(lines: string[]): { month: number; year: number } | null {
  for (const line of lines) {
    const match = normalizeText(line).match(STATEMENT_MONTH);
    if (match) return { month: MONTHS.indexOf(match[1]) + 1, year: Number(match[2]) };
  }
  return null;
}

/**
 * Lê a conta corrente do "Extrato Consolidado Inteligente" do Santander (PDF).
 * A data só aparece na primeira linha de cada dia, o débito vem com "-" depois
 * do valor e o nome do Pix vem na linha de baixo. Só a tabela da conta corrente
 * é lida: a poupança e os comprovantes repetem os mesmos lançamentos. Devolve
 * null se o texto não tiver esse formato, pra quem chama usar outro leitor.
 */
export function parseSantanderLines(
  lines: string[],
  today: Date = new Date(),
): {
  transactions: ImportedTransaction[];
  invalid: number;
  totalRows: number;
  ignoredTransfers: number;
} | null {
  const rows: Row[] = [];
  let inMovements = false;
  let current: Row | null = null;
  let day = 0;
  let month = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    const normalized = normalizeText(line);

    if (MOVEMENT_HEADER.test(normalized)) {
      inMovements = true;
      continue;
    }
    if (!inMovements) continue;
    if (END_OF_MOVEMENTS.test(normalized)) break;
    if (!line || PAGE_NOISE.some((noise) => noise.test(normalized))) continue;

    const dated = line.match(LEADING_DATE);
    const body = dated ? line.slice(dated[0].length) : line;
    if (normalizeText(body).startsWith("saldo")) {
      current = null;
      continue;
    }

    const amounts = body.match(TRAILING_AMOUNTS);
    if (!amounts || amounts.index === undefined) {
      // Sem valor: é o complemento (nome do Pix, conta de destino) do lançamento de cima.
      if (current) current.details.push(body);
      continue;
    }

    if (dated) {
      day = Number(dated[1]);
      month = Number(dated[2]);
    }
    if (day === 0) continue;

    current = {
      day,
      month,
      amount: amounts[1],
      debit: amounts[2] === "-",
      // Tira o "-" de "sem documento" e o número do documento antes do valor.
      title: body.slice(0, amounts.index).replace(/(?:\s+(?:-|\d+))+\s*$/, "").trim(),
      details: [],
    };
    rows.push(current);
  }

  if (!inMovements) return null;

  const statement = findStatementMonth(lines);
  const transactions: ImportedTransaction[] = [];
  let invalid = 0;
  let totalRows = 0;
  let ignoredTransfers = 0;

  rows.forEach((row) => {
    const isOwnAccount = row.details.some((detail) => OWN_ACCOUNT.test(detail));
    const description = cleanDescription([row.title, ...row.details]);
    if (isOwnAccount || isInternalTransfer(description)) {
      ignoredTransfers++;
      return;
    }

    totalRows++;
    const parsed = parseSignedAmount(row.amount);
    if (!parsed) {
      invalid++;
      return;
    }

    // Sem o mês do extrato, assume o ano de hoje; mês depois do do extrato é do ano anterior.
    const baseYear = statement?.year ?? today.getFullYear();
    const baseMonth = statement?.month ?? today.getMonth() + 1;
    const year = row.month > baseMonth ? baseYear - 1 : baseYear;

    const type: TransactionType = row.debit ? "expense" : "income";
    const title = description || "Sem título";
    transactions.push({
      amount: parsed.amount,
      date: `${String(row.day).padStart(2, "0")}/${String(row.month).padStart(2, "0")}/${year}`,
      description: title,
      type,
      category: guessCategory(title, type),
    });
  });

  return { transactions, invalid, totalRows, ignoredTransfers };
}
