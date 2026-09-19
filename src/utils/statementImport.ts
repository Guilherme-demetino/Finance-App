import type { TransactionRow } from "../types";
import { planBankCsvImport, planBankRowsImport } from "./bankCsv";
import { planPdfImport } from "./bankPdf";
import { decodeText, isPdfBytes } from "./fileText";
import {
  planBackupRowsImport,
  planCsvImport,
  type CsvImportResult,
} from "./importCsv";
import {
  isSpreadsheetBytes,
  readSpreadsheetSheets,
  SpreadsheetPasswordError,
} from "./spreadsheet";
import { logError } from "./logger";

/**
 * Planilha do Excel: tenta cada aba com conteúdo, primeiro como backup do
 * app e depois como extrato de banco, e fica com a primeira que tiver
 * transações. Sem nenhuma, devolve a primeira leitura bem-sucedida (vazia) ou o erro.
 */
function planSpreadsheetImport(
  bytes: Uint8Array,
  existing: TransactionRow[],
): CsvImportResult {
  let sheets: string[][][];
  try {
    sheets = readSpreadsheetSheets(bytes);
  } catch (error) {
    if (error instanceof SpreadsheetPasswordError) {
      return {
        ok: false,
        error:
          "Essa planilha é protegida por senha. Remova a senha (ou exporte o extrato em CSV) e tente de novo.",
      };
    }
    logError("Erro ao ler a planilha:", error);
    return {
      ok: false,
      error:
        "Não consegui ler essa planilha. Exporte o extrato em CSV pelo app do banco e importe o CSV.",
    };
  }

  const results = sheets.flatMap((rows) => [
    planBackupRowsImport(rows, existing, "xlsx"),
    planBankRowsImport(rows, existing, "xlsx"),
  ]);

  const withTransactions = results.find((r) => r.ok && r.plan.totalRows > 0);
  if (withTransactions) return withTransactions;

  const empty = results.find((r) => r.ok);
  if (empty) return empty;

  return {
    ok: false,
    error:
      "Não encontrei data e valor nessa planilha. Confira se as transações estão numa aba com cabeçalho (Data, Descrição, Valor).",
  };
}

/**
 * Lê o arquivo escolhido e monta o plano de importação:
 * - PDF: extrai o texto e interpreta as linhas do extrato;
 * - Excel (.xlsx/.xls): lê as abas e interpreta como backup do app ou extrato de banco;
 * - CSV: se for o backup do próprio app, usa o formato exato; senão trata
 *   como CSV de banco (colunas detectadas automaticamente).
 */
export async function planImportFromBytes(
  bytes: Uint8Array,
  existing: TransactionRow[],
): Promise<CsvImportResult> {
  if (isPdfBytes(bytes)) {
    // Carregado só agora: o pdf.js é pesado e a maioria dos usos é CSV.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfText = require("./pdfText") as typeof import("./pdfText");
    const { extractPdfLines, PdfPasswordError } = pdfText;
    try {
      const lines = await extractPdfLines(bytes);
      return planPdfImport(lines, existing);
    } catch (error) {
      if (error instanceof PdfPasswordError) {
        return {
          ok: false,
          error:
            "Esse PDF é protegido por senha. Remova a senha (ou exporte o extrato em CSV) e tente de novo.",
        };
      }
      logError("Erro ao ler o PDF:", error);
      return {
        ok: false,
        error:
          "Não consegui ler esse PDF neste aparelho. Exporte o extrato em CSV pelo app do banco e importe o CSV.",
      };
    }
  }

  if (isSpreadsheetBytes(bytes)) return planSpreadsheetImport(bytes, existing);

  const text = decodeText(bytes);
  const backup = planCsvImport(text, existing);
  if (backup.ok) return backup;

  return planBankCsvImport(text, existing);
}
