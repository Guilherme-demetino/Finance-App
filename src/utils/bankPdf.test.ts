import { parseStatementLines, planPdfImport } from "./bankPdf";

const TODAY = new Date(2026, 5, 15); // 15/06/2026

describe("parseStatementLines", () => {
  it("lê linhas 'data descrição valor saldo' de extrato de conta", () => {
    const lines = [
      "Extrato da conta - Período 01/03/2026 a 31/03/2026",
      "Data Descrição Valor Saldo",
      "SALDO ANTERIOR 1.000,00",
      "05/03/2026 Compra no débito Mercado Extra -152,30 847,70",
      "06/03/2026 Pix recebido João Silva 200,00 1.047,70",
      "07/03/2026 SALDO DO DIA 1.047,70",
    ];

    const { transactions, invalid } = parseStatementLines(lines, TODAY);
    expect(invalid).toBe(0);
    expect(transactions).toEqual([
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
        description: "Pix recebido João Silva",
        type: "income",
        category: "Salário",
      },
    ]);
  });

  it("ignora aplicação e resgate de caixinha", () => {
    const lines = [
      "01/03/2026 Aplicação RDB -500,00",
      "02/03/2026 Resgate RDB 300,00",
      "03/03/2026 Compra Padaria -20,00",
    ];
    const result = parseStatementLines(lines, TODAY);
    expect(result.ignoredTransfers).toBe(2);
    expect(result.transactions).toHaveLength(1);
  });

  it("usa D/C e parênteses para decidir o tipo", () => {
    const lines = [
      "10/03/2026 Tarifa mensal 29,90 D",
      "11/03/2026 Rendimento 5,12 C",
      "12/03/2026 Seguro (89,00)",
    ];
    const types = parseStatementLines(lines, TODAY).transactions.map(
      (t) => t.type,
    );
    expect(types).toEqual(["expense", "income", "expense"]);
  });

  it("completa o ano de datas DD/MM pelo período do extrato", () => {
    const lines = [
      "Fatura de 10/12/2025 a 09/01/2026",
      "15/12 Netflix 39,90",
      "02/01 Uber 18,40",
    ];
    const dates = parseStatementLines(lines, new Date(2026, 0, 20)).transactions.map(
      (t) => t.date,
    );
    expect(dates).toEqual(["15/12/2025", "02/01/2026"]);
  });

  it("recua um ano quando a data sem ano cairia no futuro", () => {
    const lines = ["20/12 Compra Loja 100,00"];
    const [t] = parseStatementLines(lines, new Date(2026, 0, 10)).transactions;
    expect(t.date).toBe("20/12/2025");
  });

  it("aceita mês por extenso e ignora a segunda data colada", () => {
    const lines = ["05 JAN Spotify 21,90", "12/03/2026 10/03/2026 Uber *Trip 30,00"];
    const { transactions } = parseStatementLines(lines, new Date(2026, 5, 15));
    expect(transactions[0].date).toBe("05/01/2026");
    expect(transactions[1]).toMatchObject({
      date: "12/03/2026",
      description: "Uber *Trip",
      amount: 30,
    });
  });

  it("ignora linhas sem data ou sem valor", () => {
    const lines = ["Olá, Fulano", "05/03/2026 Descrição sem valor", "Total 100,00"];
    expect(parseStatementLines(lines, TODAY).transactions).toHaveLength(0);
  });
});

describe("extrato de conta do Itaú", () => {
  const ITAU = [
    "NOME DO TITULAR 000.000.000-00 agência: 0000 conta: 000000-0",
    "R$ -194,25 R$ 180,00 R$ 0,00 R$ 180,00",
    "período de visualização: 12/08/2026 até 11/09/2026 emitido em: 11/09/2026 18:18:50",
    "data lançamentos valor (R$) saldo (R$)",
    "09/09/2026 SALDO DO DIA -194,25",
    "08/09/2026 FATURA PAGA ITAU + PLATI -1.049,00",
    "08/09/2026 TED 001.0000.TITULAR D 5.888,04",
    "08/09/2026 PIX TRANSF Titular08/09 -5.800,00",
    "08/09/2026 PIX TRANSF Amigo05/09 2.000,00",
    "08/09/2026 SALDO DO DIA -194,25",
    "02/09/2026 IOF -0,51",
    "26/08/2026 PIX TRANSF Titular26/08 16,56",
    "11/08/2026 SALDO DO DIA -194,05",
    "Aviso!",
  ];

  it("trata valor sem sinal como receita e com '-' como despesa", () => {
    const { transactions, totalRows } = parseStatementLines(
      ITAU,
      new Date(2026, 8, 19),
    );
    expect(totalRows).toBe(6);
    expect(
      transactions.map((t) => [t.date, t.description, t.type, t.amount]),
    ).toEqual([
      ["08/09/2026", "FATURA PAGA ITAU + PLATI", "expense", 1049],
      ["08/09/2026", "TED 001.0000.TITULAR D", "income", 5888.04],
      ["08/09/2026", "PIX TRANSF Titular", "expense", 5800],
      ["08/09/2026", "PIX TRANSF Amigo", "income", 2000],
      ["02/09/2026", "IOF", "expense", 0.51],
      ["26/08/2026", "PIX TRANSF Titular", "income", 16.56],
    ]);
    expect(transactions.filter((t) => t.type === "income").every((t) => t.category === "Salário")).toBe(true);
  });

  it("mantém a parcela 'COMPRA 03/10' na descrição", () => {
    const lines = ["05/03/2026 Loja X COMPRA 03/10 -50,00", "06/03/2026 Loja Y -10,00"];
    expect(parseStatementLines(lines, TODAY).transactions[0].description).toBe(
      "Loja X COMPRA 03/10",
    );
  });
});

describe("planPdfImport", () => {
  it("avisa quando não encontra nenhuma transação", () => {
    const result = planPdfImport(["texto qualquer"], []);
    expect(result.ok).toBe(false);
  });

  it("marca a origem como pdf e ignora duplicatas", () => {
    const lines = ["05/03/2026 Padaria -10,00", "06/03/2026 Padaria -10,00"];
    const result = planPdfImport(
      lines,
      [
        {
          id: 1,
          amount: 10,
          date: "05/03/2026",
          description: "Padaria",
          type: "expense",
          category_id: "Alimentação",
        },
      ],
      TODAY,
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.source).toBe("pdf");
    expect(result.plan.duplicates).toBe(1);
    expect(result.plan.toImport).toHaveLength(1);
  });
});
