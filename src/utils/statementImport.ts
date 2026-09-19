import type { TransactionRow } from "../types";
import { planBankCsvImport } from "./bankCsv";
import { planPdfImport } from "./bankPdf";
import { decodeText, isPdfBytes } from "./fileText";
import { planCsvImport, type CsvImportResult } from "./importCsv";

/**
 * Lê o arquivo escolhido e monta o plano de importação:
 * - PDF: extrai o texto e interpreta as linhas do extrato;
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
      console.log("Erro ao ler o PDF:", error);
      return {
        ok: false,
        error:
          "Não consegui ler esse PDF neste aparelho. Exporte o extrato em CSV pelo app do banco e importe o CSV.",
      };
    }
  }

  const text = decodeText(bytes);
  const backup = planCsvImport(text, existing);
  if (backup.ok) return backup;

  return planBankCsvImport(text, existing);
}
