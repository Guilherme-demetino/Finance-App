import type { TransactionRow } from "../../types";
import { planBankCsvImport } from "./bankCsv";

function plan(csv: string, existing: TransactionRow[] = []) {
  const result = planBankCsvImport(csv, existing);
  if (!result.ok) throw new Error(result.error);
  return result.plan;
}

describe("planBankCsvImport", () => {
  it("lê extrato com título antes do cabeçalho e Histórico + Descrição (estilo Inter)", () => {
    const csv = [
      "Extrato Conta Corrente",
      "Período;01/03/2026 a 31/03/2026",
      "",
      "Data Lançamento;Histórico;Descrição;Valor;Saldo",
      '05/03/2026;Pix enviado;"João Silva";"-1.250,50";"3.000,00"',
      "06/03/2026;Pix recebido;Maria;200,00;3.200,00",
      "07/03/2026;SALDO DO DIA;;;3.200,00",
    ].join("\n");

    const p = plan(csv);
    expect(p.source).toBe("csv");
    expect(p.toImport).toEqual([
      {
        amount: 1250.5,
        date: "05/03/2026",
        description: "Pix enviado - João Silva",
        type: "expense",
        category: "Pix",
      },
      {
        amount: 200,
        date: "06/03/2026",
        description: "Pix recebido - Maria",
        type: "income",
        category: "Pix",
      },
    ]);
  });

  it("lê CSV da conta Nubank (vírgula, valor positivo = entrada)", () => {
    const csv = [
      "Data,Valor,Identificador,Descrição",
      "01/03/2026,-35.90,abc-1,Compra no débito - Padaria Central",
      "02/03/2026,2500.00,abc-2,Transferência recebida - Empresa",
    ].join("\n");

    const p = plan(csv);
    expect(p.toImport.map((t) => [t.type, t.amount, t.category])).toEqual([
      ["expense", 35.9, "Alimentação"],
      ["income", 2500, "Pix"],
    ]);
  });

  it("ignora aplicações e resgates de caixinha (Nubank) e marca Pix com a categoria Pix", () => {
    const csv = [
      "Data,Valor,Identificador,Descrição",
      "01/03/2026,-500.00,a1,Aplicação RDB",
      "02/03/2026,300.00,a2,Resgate RDB",
      "03/03/2026,1200.00,a3,Transferência recebida pelo Pix - Empresa",
      "04/03/2026,-20.00,a4,Compra no débito - Padaria",
    ].join("\n");

    const p = plan(csv);
    expect(p.ignoredTransfers).toBe(2);
    expect(p.toImport.map((t) => [t.description, t.type, t.category])).toEqual([
      ["Transferência recebida pelo Pix - Empresa", "income", "Pix"],
      ["Compra no débito - Padaria", "expense", "Alimentação"],
    ]);
  });

  it("inverte o sinal na fatura do cartão Nubank (compra vem positiva)", () => {
    const csv = [
      "date,category,title,amount",
      "2026-03-10,restaurante,Ifood,42.50",
      "2026-03-12,pagamento,Pagamento recebido,-500.00",
    ].join("\n");

    const p = plan(csv);
    expect(p.toImport.map((t) => [t.date, t.type, t.amount])).toEqual([
      ["10/03/2026", "expense", 42.5],
      ["12/03/2026", "income", 500],
    ]);
  });

  it("fatura do cartão Nubank sem a coluna de categoria (date,title,amount) também inverte o sinal", () => {
    const csv = [
      "date,title,amount",
      "2026-08-03,Uber,18.90",
      "2026-08-15,Pagamento recebido,-450.00",
      "2026-08-30,Fatura anterior,-1200.00",
    ].join("\n");

    const p = plan(csv);
    expect(p.toImport.map((t) => [t.date, t.description, t.type, t.amount])).toEqual([
      ["03/08/2026", "Uber", "expense", 18.9],
      ["15/08/2026", "Pagamento recebido", "income", 450],
      ["30/08/2026", "Fatura anterior", "income", 1200],
    ]);
  });

  it("lê colunas separadas de débito e crédito", () => {
    const csv = [
      "Data;Histórico;Débito;Crédito;Saldo",
      "01/04/2026;Tarifa;12,90;;100,00",
      "02/04/2026;Depósito;;300,00;400,00",
    ].join("\n");

    const p = plan(csv);
    expect(p.toImport.map((t) => [t.type, t.amount])).toEqual([
      ["expense", 12.9],
      ["income", 300],
    ]);
  });

  it("usa a coluna de tipo (D/C) com valores sempre positivos", () => {
    const csv = [
      "Data;Descrição;Valor;Tipo",
      "01/04/2026;Luz;90,00;Débito",
      "02/04/2026;Freela;500,00;Crédito",
    ].join("\n");

    expect(plan(csv).toImport.map((t) => t.type)).toEqual(["expense", "income"]);
  });

  it("adivinha as colunas quando não há cabeçalho", () => {
    const csv = [
      "10/05/2026;Uber trip;-23,40",
      "11/05/2026;Salário maio;4.000,00",
    ].join("\n");

    const p = plan(csv);
    expect(
      p.toImport.map((t) => [t.description, t.type, t.amount, t.category]),
    ).toEqual([
      ["Uber trip", "expense", 23.4, "Transporte"],
      ["Salário maio", "income", 4000, "Salário"],
    ]);
  });

  it("ignora transações que já existem e conta linhas inválidas", () => {
    const csv = [
      "Data;Descrição;Valor",
      "01/04/2026;Mercado;-50,00",
      "02/04/2026;Padaria;-10,00",
      "data ruim;Coisa;-5,00",
    ].join("\n");
    const existing: TransactionRow[] = [
      {
        id: 1,
        amount: 50,
        date: "01/04/2026",
        description: "Mercado",
        type: "expense",
        category_id: "Alimentação",
      },
    ];

    const p = plan(csv, existing);
    expect(p.duplicates).toBe(1);
    expect(p.invalid).toBe(1);
    expect(p.toImport).toHaveLength(1);
    expect(p.toImport[0].description).toBe("Padaria");
  });

  it("recusa arquivo sem coluna de data/valor", () => {
    const result = planBankCsvImport("nome;idade\nAna;30", []);
    expect(result.ok).toBe(false);
  });
});
