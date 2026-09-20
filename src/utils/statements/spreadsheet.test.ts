/**
 * @jest-environment node
 */
import * as XLSX from "xlsx";
import { isSpreadsheetBytes } from "./spreadsheet";
import { planImportFromBytes } from "./statementImport";

// Dados fictícios. As planilhas são geradas aqui mesmo, como o Excel salva:
// datas são números (série) com formato de data, e valores são números.
type Cell = string | number | { date: [number, number, number] } | null;

function dateSerial([day, month, year]: [number, number, number]): number {
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000;
}

function buildSheet(rows: Cell[][]): XLSX.WorkSheet {
  const sheet: XLSX.WorkSheet = {};
  rows.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value === null) return;
      const ref = XLSX.utils.encode_cell({ r, c });
      if (typeof value === "object") {
        sheet[ref] = { t: "n", v: dateSerial(value.date), z: "dd/mm/yyyy" };
      } else if (typeof value === "number") {
        sheet[ref] = { t: "n", v: value, z: "#,##0.00" };
      } else {
        sheet[ref] = { t: "s", v: value };
      }
    }),
  );
  sheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length - 1, c: Math.max(...rows.map((r) => r.length)) - 1 },
  });
  return sheet;
}

function buildWorkbook(
  sheets: Record<string, Cell[][]>,
  bookType: XLSX.BookType = "xlsx",
): Uint8Array {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) =>
    XLSX.utils.book_append_sheet(workbook, buildSheet(rows), name),
  );
  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType }));
}

const BANK_ROWS: Cell[][] = [
  ["Extrato da conta - NOME DO TITULAR"],
  ["Período: 01/03/2026 a 31/03/2026"],
  [],
  ["Data", "Descrição", "Valor", "Saldo"],
  [{ date: [5, 3, 2026] }, "Compra no débito Mercado Extra", -152.3, 847.7],
  [{ date: [6, 3, 2026] }, "Pix recebido Maria Souza Lima", 200, 1047.7],
  [{ date: [7, 3, 2026] }, "Aplicação RDB", -500, 547.7],
  [{ date: [8, 3, 2026] }, "Uber *Trip", -18.4, 529.3],
];

describe("planilha do Excel", () => {
  it("lê .xlsx: data em série, valores numéricos e linhas de título antes do cabeçalho", async () => {
    const result = await planImportFromBytes(buildWorkbook({ Extrato: BANK_ROWS }), []);
    if (!result.ok) throw new Error(result.error);

    expect(result.plan.source).toBe("xlsx");
    expect(result.plan.ignoredTransfers).toBe(1);
    expect(result.plan.toImport).toEqual([
      {
        amount: 152.3,
        date: "05/03/2026",
        description: "Compra no débito Mercado Extra",
        type: "expense",
        category: "Alimentação",
      },
      {
        amount: 200,
        date: "06/03/2026",
        description: "Pix recebido Maria Souza Lima",
        type: "income",
        category: "Pix",
      },
      {
        amount: 18.4,
        date: "08/03/2026",
        description: "Uber *Trip",
        type: "expense",
        category: "Transporte",
      },
    ]);
  });

  it("lê o .xls antigo", async () => {
    const result = await planImportFromBytes(
      buildWorkbook({ Extrato: BANK_ROWS }, "biff8"),
      [],
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.toImport.map((t) => [t.date, t.type, t.amount])).toEqual([
      ["05/03/2026", "expense", 152.3],
      ["06/03/2026", "income", 200],
      ["08/03/2026", "expense", 18.4],
    ]);
  });

  it("aceita data e valor escritos como texto", async () => {
    const rows: Cell[][] = [
      ["Data", "Histórico", "Valor"],
      ["10/03/2026", "Pagamento Netflix", "-R$ 1.039,90"],
      ["11/03/2026", "Salário", "R$ 3.500,00"],
    ];
    const result = await planImportFromBytes(buildWorkbook({ Plan1: rows }), []);
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.toImport.map((t) => [t.date, t.type, t.amount])).toEqual([
      ["10/03/2026", "expense", 1039.9],
      ["11/03/2026", "income", 3500],
    ]);
  });

  it("aceita colunas separadas de débito e crédito", async () => {
    const rows: Cell[][] = [
      ["Data", "Descrição", "Débito", "Crédito"],
      [{ date: [2, 4, 2026] }, "Farmácia Exemplo", 45.5, null],
      [{ date: [3, 4, 2026] }, "Transferência recebida Joao Pereira Alves", null, 300],
    ];
    const result = await planImportFromBytes(buildWorkbook({ Plan1: rows }), []);
    if (!result.ok) throw new Error(result.error);
    expect(
      result.plan.toImport.map((t) => [t.type, t.amount, t.category]),
    ).toEqual([
      ["expense", 45.5, "Saúde"],
      ["income", 300, "Pix"],
    ]);
  });

  it("lê o backup do app salvo como Excel, mantendo a categoria", async () => {
    const rows: Cell[][] = [
      ["Data", "Descrição", "Categoria", "Tipo", "Valor"],
      [{ date: [12, 3, 2026] }, "Aluguel", "Moradia", "Despesa", 1200],
      [{ date: [13, 3, 2026] }, "Freela", "Investimentos", "Receita", 450.75],
    ];
    const result = await planImportFromBytes(buildWorkbook({ Backup: rows }), []);
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.source).toBe("xlsx");
    expect(result.plan.toImport).toEqual([
      { amount: 1200, date: "12/03/2026", description: "Aluguel", type: "expense", category: "Moradia" },
      { amount: 450.75, date: "13/03/2026", description: "Freela", type: "income", category: "Investimentos" },
    ]);
  });

  it("procura as transações em todas as abas", async () => {
    const result = await planImportFromBytes(
      buildWorkbook({
        Resumo: [["Total de entradas", 200], ["Total de saídas", 170.7]],
        Extrato: BANK_ROWS,
      }),
      [],
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.toImport).toHaveLength(3);
  });

  it("ignora o que já existe no app", async () => {
    const result = await planImportFromBytes(buildWorkbook({ Extrato: BANK_ROWS }), [
      {
        id: 1,
        amount: 18.4,
        date: "08/03/2026",
        description: "Uber *Trip",
        type: "expense",
        category_id: "Transporte",
      },
    ]);
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.duplicates).toBe(1);
    expect(result.plan.toImport).toHaveLength(2);
  });

  it("avisa quando a planilha não tem data e valor", async () => {
    const result = await planImportFromBytes(
      buildWorkbook({ Plan1: [["Nome", "Idade"], ["Ana", 30]] }),
      [],
    );
    expect(result.ok).toBe(false);
  });

  it("avisa quando o arquivo parece ZIP mas não é uma planilha", async () => {
    const fakeZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6]);
    const result = await planImportFromBytes(fakeZip, []);
    expect(result.ok).toBe(false);
  });
});

describe("isSpreadsheetBytes", () => {
  it("reconhece .xlsx e .xls e não confunde com CSV ou PDF", () => {
    expect(isSpreadsheetBytes(buildWorkbook({ A: BANK_ROWS }))).toBe(true);
    expect(isSpreadsheetBytes(buildWorkbook({ A: BANK_ROWS }, "biff8"))).toBe(true);
    expect(isSpreadsheetBytes(new TextEncoder().encode("Data;Valor\n"))).toBe(false);
    expect(isSpreadsheetBytes(new TextEncoder().encode("%PDF-1.4"))).toBe(false);
    expect(isSpreadsheetBytes(new Uint8Array([]))).toBe(false);
  });
});
