import { decodeText } from "./fileText";

interface PdfTextItem {
  str: string;
  /** [a, b, c, d, x, y] — x/y da base do texto na página. */
  transform: number[];
  width: number;
}

// Itens cuja base fica a até essa distância (em pontos do PDF) estão na mesma linha.
const SAME_LINE_TOLERANCE = 3;
// Espaço horizontal (em pontos) entre dois trechos a partir do qual há um espaço/coluna.
const WORD_GAP = 1.5;
const COLUMN_GAP = 8;

/** Junta os trechos de texto de uma página em linhas, de cima pra baixo e da esquerda pra direita. */
export function groupItemsIntoLines(items: PdfTextItem[]): string[] {
  const positioned = items
    .filter((item) => item.str.trim() !== "")
    .map((item) => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: (typeof positioned)[] = [];
  positioned.forEach((item) => {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - item.y) <= SAME_LINE_TOLERANCE) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  });

  return rows.map((row) => {
    const sorted = [...row].sort((a, b) => a.x - b.x);
    let line = "";
    sorted.forEach((item, index) => {
      if (index > 0) {
        const previous = sorted[index - 1];
        const gap = item.x - (previous.x + previous.width);
        line += gap > COLUMN_GAP ? "  " : gap > WORD_GAP ? " " : "";
      }
      line += item.text;
    });
    return line.replace(/\s+/g, " ").trim();
  });
}

/**
 * O pdf.js precisa de `TextDecoder` (UTF-8, UTF-16 e Latin-1). Se o motor
 * JavaScript do aparelho não tiver, registra uma versão simples.
 */
function ensureTextDecoder(): void {
  const scope = globalThis as { TextDecoder?: unknown };
  if (typeof scope.TextDecoder !== "undefined") return;

  class SimpleTextDecoder {
    private readonly label: string;

    constructor(label = "utf-8") {
      this.label = String(label).toLowerCase();
    }

    decode(input?: ArrayBuffer | ArrayBufferView): string {
      if (!input) return "";
      const bytes =
        input instanceof ArrayBuffer
          ? new Uint8Array(input)
          : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);

      if (this.label.startsWith("utf-16") || this.label === "ucs-2") {
        const littleEndian = !this.label.endsWith("be");
        let text = "";
        for (let i = 0; i + 1 < bytes.length; i += 2) {
          text += String.fromCharCode(
            littleEndian ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1],
          );
        }
        return text;
      }

      if (this.label.startsWith("utf-8") || this.label === "utf8") {
        return decodeText(bytes);
      }

      let text = "";
      for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
      return text;
    }
  }

  scope.TextDecoder = SimpleTextDecoder;
}

/** Erro específico pra PDF protegido por senha (comum em extratos de banco). */
export class PdfPasswordError extends Error {
  constructor() {
    super("PDF protegido por senha");
    this.name = "PdfPasswordError";
  }
}

/**
 * Extrai o texto de um PDF, linha por linha, sem sair do celular. Usa o
 * pdf.js rodando na própria thread (sem Worker) e só é carregado quando o
 * usuário importa um PDF, pra não pesar na abertura do app.
 */
export async function extractPdfLines(bytes: Uint8Array): Promise<string[]> {
  ensureTextDecoder();
  const globals = globalThis as { pdfjsWorker?: unknown };
  if (!globals.pdfjsWorker) {
    // O pdf.js usa este objeto global no lugar de um Web Worker.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    globals.pdfjsWorker = require("pdfjs-dist/legacy/build/pdf.worker.js");
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");

  const task = pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
    useWorkerFetch: false,
    isOffscreenCanvasSupported: false,
    verbosity: 0,
  });

  let doc;
  try {
    doc = await task.promise;
  } catch (error) {
    if ((error as { name?: string })?.name === "PasswordException") {
      throw new PdfPasswordError();
    }
    throw error;
  }

  const lines: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      lines.push(...groupItemsIntoLines(content.items as PdfTextItem[]));
    }
  } finally {
    await doc.destroy();
  }

  return lines;
}
