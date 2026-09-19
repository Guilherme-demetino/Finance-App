import type { CellObject, WorkSheet } from "xlsx";

// Máximo de linhas lidas por aba, pra uma planilha gigante não travar o aparelho.
const MAX_ROWS = 20000;

/**
 * Planilhas do Excel: .xlsx (e .ods) são um ZIP ("PK\x03\x04"); o .xls antigo
 * usa o contêiner OLE2 (D0 CF 11 E0 A1 B1 1A E1).
 */
export function isSpreadsheetBytes(bytes: Uint8Array): boolean {
  const startsWith = (signature: number[]) =>
    bytes.length >= signature.length &&
    signature.every((byte, index) => bytes[index] === byte);

  return (
    startsWith([0x50, 0x4b, 0x03, 0x04]) ||
    startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Texto de uma célula, no formato que os leitores de extrato já entendem:
 * datas viram DD/MM/AAAA, números usam vírgula decimal e o resto vai como está.
 */
function cellToText(
  cell: CellObject | undefined,
  XLSX: typeof import("xlsx"),
  date1904: boolean,
): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";

  if (cell.t === "d" && cell.v instanceof Date) {
    const d = cell.v;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  if (cell.t === "n" && typeof cell.v === "number") {
    // Data no Excel é só um número com formato de data; sem olhar o formato
    // ela viraria "46000". A conversão pela série evita problema de fuso horário.
    if (cell.z && XLSX.SSF.is_date(String(cell.z))) {
      const parts = XLSX.SSF.parse_date_code(cell.v, { date1904 });
      if (parts) return `${pad(parts.d)}/${pad(parts.m)}/${parts.y}`;
    }
    if (Number.isInteger(cell.v)) return String(cell.v);
    return String(Math.round(cell.v * 100) / 100).replace(".", ",");
  }

  if (cell.t === "e") return "";
  if (cell.t === "b") return cell.v ? "VERDADEIRO" : "FALSO";
  return String(cell.v).trim();
}

function sheetToRows(
  sheet: WorkSheet,
  XLSX: typeof import("xlsx"),
  date1904: boolean,
): string[][] {
  if (!sheet["!ref"]) return [];
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const lastRow = Math.min(range.e.r, range.s.r + MAX_ROWS - 1);
  const rows: string[][] = [];

  for (let r = range.s.r; r <= lastRow; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as CellObject | undefined;
      row.push(cellToText(cell, XLSX, date1904));
    }
    while (row.length > 0 && row[row.length - 1] === "") row.pop();
    // Linhas em branco (comuns entre o título e o cabeçalho) só atrapalham a busca do cabeçalho.
    if (row.length > 0) rows.push(row);
  }

  return rows;
}

/** Erro específico pra planilha protegida por senha. */
export class SpreadsheetPasswordError extends Error {
  constructor() {
    super("Planilha protegida por senha");
    this.name = "SpreadsheetPasswordError";
  }
}

/**
 * Lê uma planilha (.xlsx, .xls ou .ods) e devolve as linhas de cada aba que
 * tem conteúdo, como texto. A biblioteca é carregada só agora: é pesada e a
 * maioria dos usos é CSV ou PDF.
 */
export function readSpreadsheetSheets(bytes: Uint8Array): string[][][] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx");

  let workbook;
  try {
    workbook = XLSX.read(bytes, {
      type: "array",
      cellNF: true,
      cellText: false,
      cellDates: false,
    });
  } catch (error) {
    if (/password|encrypt/i.test(String((error as Error)?.message))) {
      throw new SpreadsheetPasswordError();
    }
    throw error;
  }

  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
  return workbook.SheetNames.map((name) =>
    sheetToRows(workbook.Sheets[name], XLSX, date1904),
  ).filter((rows) => rows.length > 0);
}
