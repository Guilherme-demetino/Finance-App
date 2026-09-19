/**
 * @jest-environment node
 */
import { planPdfImport } from "./bankPdf";
import { planImportFromBytes } from "./statementImport";
import { extractPdfLines, groupItemsIntoLines } from "./pdfText";

interface Cell {
  x: number;
  text: string;
}
interface Row {
  y: number;
  cells: Cell[];
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Monta um PDF mínimo de 1 página (Helvetica) com cada célula numa posição x/y. */
function buildPdf(rows: Row[]): Uint8Array {
  const content = rows
    .flatMap((row) =>
      row.cells.map(
        (cell) =>
          `BT /F1 10 Tf 1 0 0 1 ${cell.x} ${row.y} Tm (${escapePdfText(cell.text)}) Tj ET`,
      ),
    )
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

const STATEMENT: Row[] = [
  { y: 780, cells: [{ x: 40, text: "Extrato da conta corrente" }] },
  { y: 765, cells: [{ x: 40, text: "Periodo: 01/03/2026 a 31/03/2026" }] },
  {
    y: 740,
    cells: [
      { x: 40, text: "Data" },
      { x: 120, text: "Descricao" },
      { x: 400, text: "Valor" },
      { x: 480, text: "Saldo" },
    ],
  },
  {
    y: 720,
    cells: [
      { x: 40, text: "05/03/2026" },
      { x: 120, text: "Compra no debito Mercado Extra" },
      { x: 400, text: "-152,30" },
      { x: 480, text: "847,70" },
    ],
  },
  {
    y: 705,
    cells: [
      { x: 40, text: "06/03/2026" },
      { x: 120, text: "Pix recebido Joao Silva" },
      { x: 400, text: "200,00" },
      { x: 480, text: "1.047,70" },
    ],
  },
  {
    y: 690,
    cells: [
      { x: 40, text: "07/03/2026" },
      { x: 120, text: "Saldo do dia" },
      { x: 480, text: "1.047,70" },
    ],
  },
];

describe("groupItemsIntoLines", () => {
  it("agrupa por linha, ordena por x e separa colunas com espaço", () => {
    const lines = groupItemsIntoLines([
      { str: "Valor", transform: [1, 0, 0, 1, 400, 700], width: 25 },
      { str: "Data", transform: [1, 0, 0, 1, 40, 700.5], width: 20 },
      { str: "Rodapé", transform: [1, 0, 0, 1, 40, 50], width: 30 },
    ]);
    expect(lines).toEqual(["Data Valor", "Rodapé"]);
  });
});

describe("extractPdfLines (pdf.js de verdade)", () => {
  it("extrai o texto de um PDF linha por linha", async () => {
    const lines = await extractPdfLines(buildPdf(STATEMENT));
    expect(lines).toContain("Extrato da conta corrente");
    expect(lines).toContain("05/03/2026 Compra no debito Mercado Extra -152,30 847,70");
  });

  it("importa as transações do PDF de ponta a ponta", async () => {
    const result = await planImportFromBytes(buildPdf(STATEMENT), []);
    if (!result.ok) throw new Error(result.error);

    expect(result.plan.source).toBe("pdf");
    expect(result.plan.toImport).toEqual([
      {
        amount: 152.3,
        date: "05/03/2026",
        description: "Compra no debito Mercado Extra",
        type: "expense",
        category: "Alimentação",
      },
      {
        amount: 200,
        date: "06/03/2026",
        description: "Pix recebido Joao Silva",
        type: "income",
        category: "Salário",
      },
    ]);
  });

  it("um PDF sem texto vira erro amigável", async () => {
    const lines = await extractPdfLines(buildPdf([]));
    expect(lines).toEqual([]);
    expect(planPdfImport(lines, []).ok).toBe(false);
  });
});

describe("planImportFromBytes com CSV", () => {
  it("usa o leitor de CSV de banco e decodifica Latin-1", async () => {
    const csv = "Data;Descrição;Valor\n01/04/2026;Padaria;-10,00";
    const bytes = new Uint8Array(csv.length);
    for (let i = 0; i < csv.length; i++) bytes[i] = csv.charCodeAt(i) & 0xff; // ISO-8859-1

    const result = await planImportFromBytes(bytes, []);
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.source).toBe("csv");
    expect(result.plan.toImport[0]).toMatchObject({
      description: "Padaria",
      type: "expense",
      amount: 10,
    });
  });

  it("reconhece o backup do próprio app pelo cabeçalho", async () => {
    const csv = "Data;Descrição;Categoria;Tipo;Valor\n01/04/2026;Padaria;Alimentação;Despesa;10,00";
    const result = await planImportFromBytes(new TextEncoder().encode(csv), []);
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.source).toBe("backup");
  });
});
