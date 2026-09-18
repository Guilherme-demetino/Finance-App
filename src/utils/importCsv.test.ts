import type { TransactionRow } from "../types";
import { buildTransactionsCsv } from "./export";
import { parseCsv, planCsvImport } from "./importCsv";

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

const HEADER = "Data;Descrição;Categoria;Tipo;Valor";

describe("parseCsv", () => {
  it("separa por ; e ignora o BOM e linhas vazias", () => {
    expect(parseCsv("﻿a;b;c\n1;2;3\n\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("aceita CRLF", () => {
    expect(parseCsv("a;b\r\n1;2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("respeita campos entre aspas com ; e aspas duplas", () => {
    expect(parseCsv('x;"a;b";"diz ""oi"""')).toEqual([
      ["x", "a;b", 'diz "oi"'],
    ]);
  });
});

describe("planCsvImport", () => {
  it("importa o que foi exportado pelo próprio app", () => {
    const csv = buildTransactionsCsv([
      makeTransaction(),
      makeTransaction({
        id: 2,
        type: "income",
        amount: 3000,
        description: "Salário; setembro",
        category_id: "Salário",
        date: "05/09/2026",
      }),
    ]);

    const result = planCsvImport(csv, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.toImport).toEqual([
      {
        amount: 150.5,
        date: "15/03/2026",
        description: "Supermercado",
        type: "expense",
        category: "Alimentação",
      },
      {
        amount: 3000,
        date: "05/09/2026",
        description: "Salário; setembro",
        type: "income",
        category: "Salário",
      },
    ]);
    expect(result.plan.duplicates).toBe(0);
    expect(result.plan.invalid).toBe(0);
  });

  it("pula o que já existe no app", () => {
    const csv = buildTransactionsCsv([makeTransaction()]);
    const result = planCsvImport(csv, [makeTransaction({ id: 99 })]);
    expect(result.ok && result.plan.toImport).toEqual([]);
    expect(result.ok && result.plan.duplicates).toBe(1);
  });

  it("conta repetidas uma a uma: já tendo 1 de 2 iguais, importa só a outra", () => {
    const csv = buildTransactionsCsv([
      makeTransaction({ id: 1 }),
      makeTransaction({ id: 2 }),
    ]);
    const result = planCsvImport(csv, [makeTransaction({ id: 99 })]);
    expect(result.ok && result.plan.toImport).toHaveLength(1);
    expect(result.ok && result.plan.duplicates).toBe(1);
  });

  it("ignora linhas com data, tipo ou valor inválidos", () => {
    const csv = [
      HEADER,
      "31/02/2026;Data impossível;Geral;Despesa;10,00",
      "10/03/2026;Tipo estranho;Geral;Outro;10,00",
      "10/03/2026;Sem valor;Geral;Despesa;abc",
      "10/03/2026;Valor zero;Geral;Despesa;0,00",
      "10/03/2026;Ok;Geral;Despesa;10,00",
    ].join("\n");

    const result = planCsvImport(csv, []);
    expect(result.ok && result.plan.invalid).toBe(4);
    expect(result.ok && result.plan.toImport).toHaveLength(1);
  });

  it("entende valores com milhar e símbolo, e normaliza a data", () => {
    const csv = [HEADER, "5/3/2026;Reforma;Moradia;Despesa;R$ 1.234,56"].join(
      "\n",
    );
    const result = planCsvImport(csv, []);
    expect(result.ok && result.plan.toImport[0]).toMatchObject({
      date: "05/03/2026",
      amount: 1234.56,
    });
  });

  it("usa 'Sem título' e 'Geral' quando título e categoria vêm vazios", () => {
    const csv = [HEADER, "10/03/2026;;;Receita;50,00"].join("\n");
    const result = planCsvImport(csv, []);
    expect(result.ok && result.plan.toImport[0]).toMatchObject({
      description: "Sem título",
      category: "Geral",
    });
  });

  it("recusa arquivo sem o cabeçalho esperado", () => {
    const result = planCsvImport("nome;idade\nAna;30", []);
    expect(result.ok).toBe(false);
  });
});
