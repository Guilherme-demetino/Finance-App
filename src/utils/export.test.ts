import type { TransactionRow } from "../types";
import { buildTransactionsCsv, buildTransactionsHtmlReport } from "./export";

function makeTransaction(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 1,
    amount: 150.5,
    date: "15/03/2026",
    description: "Supermercado",
    type: "expense",
    category_id: "Alimentação",
    ...overrides,
  };
}

describe("buildTransactionsCsv", () => {
  it("começa com o BOM UTF-8 seguido do cabeçalho", () => {
    const csv = buildTransactionsCsv([makeTransaction()]);
    expect(csv.startsWith("﻿Data;Descrição;Categoria;Tipo;Valor")).toBe(
      true,
    );
  });

  it("usa ; como separador e vírgula decimal no valor", () => {
    const csv = buildTransactionsCsv([makeTransaction({ amount: 1234.5 })]);
    const [, row] = csv.split("\n");
    expect(row).toBe("15/03/2026;Supermercado;Alimentação;Despesa;1234,50");
  });

  it("marca receitas como 'Receita'", () => {
    const csv = buildTransactionsCsv([makeTransaction({ type: "income" })]);
    expect(csv).toContain(";Receita;");
  });

  it("usa 'Sem descrição' e 'Geral' como fallback quando vazios", () => {
    const csv = buildTransactionsCsv([
      makeTransaction({ description: "", category_id: "" }),
    ]);
    expect(csv).toContain("Sem descrição");
    expect(csv).toContain("Geral");
  });

  it("envolve em aspas e escapa campos com ; dentro do valor", () => {
    const csv = buildTransactionsCsv([
      makeTransaction({ description: "Mercado; Padaria" }),
    ]);
    expect(csv).toContain('"Mercado; Padaria"');
  });

  it("escapa aspas duplas duplicando-as, conforme o padrão CSV", () => {
    const csv = buildTransactionsCsv([
      makeTransaction({ description: 'Nota "importante"' }),
    ]);
    expect(csv).toContain('"Nota ""importante"""');
  });

  it("gera uma linha por transação, na mesma ordem recebida", () => {
    const csv = buildTransactionsCsv([
      makeTransaction({ id: 1, description: "Primeira" }),
      makeTransaction({ id: 2, description: "Segunda" }),
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // header + 2 linhas
    expect(lines[1]).toContain("Primeira");
    expect(lines[2]).toContain("Segunda");
  });

  it("retorna só o cabeçalho quando não há transações", () => {
    const csv = buildTransactionsCsv([]);
    expect(csv).toBe("﻿Data;Descrição;Categoria;Tipo;Valor");
  });
});

describe("buildTransactionsHtmlReport", () => {
  it("inclui usuário, período e totais formatados no HTML", () => {
    const html = buildTransactionsHtmlReport({
      userName: "Guilherme",
      selectedMonth: "Março",
      selectedYear: "2026",
      totalIncome: 5000,
      totalExpense: 1200.5,
      totalBalance: 3799.5,
      transactions: [makeTransaction()],
    });

    expect(html).toContain("Guilherme");
    expect(html).toContain("Março de 2026");
    expect(html).toContain("R$ 5.000,00");
    expect(html).toContain("R$ 1.200,50");
    expect(html).toContain("Supermercado");
  });

  it("não quebra ao gerar o relatório sem nenhuma transação", () => {
    const html = buildTransactionsHtmlReport({
      userName: "Guilherme",
      selectedMonth: "Março",
      selectedYear: "2026",
      totalIncome: 0,
      totalExpense: 0,
      totalBalance: 0,
      transactions: [],
    });

    expect(html).toContain("<table>");
    expect(html).toContain("R$ 0,00");
  });
});
