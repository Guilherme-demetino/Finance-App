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
        category: "Pix",
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
    expect(transactions.map((t) => t.category)).toEqual([
      "Geral",
      "Salário",
      "Pix",
      "Pix",
      "Geral",
      "Pix",
    ]);
  });

  it("mantém a parcela 'COMPRA 03/10' na descrição", () => {
    const lines = ["05/03/2026 Loja X COMPRA 03/10 -50,00", "06/03/2026 Loja Y -10,00"];
    expect(parseStatementLines(lines, TODAY).transactions[0].description).toBe(
      "Loja X COMPRA 03/10",
    );
  });
});

// Dados fictícios, na mesma ordem de linhas que o pdf.js entrega para o extrato
// do Banco do Brasil: título antes da linha da data, detalhe depois.
const BANCO_DO_BRASIL = [
  "Extrato de Conta Corrente",
  "Cliente: NOME DO TITULAR",
  "Período: 01 a 19/09/2026 Agência: 0000-0 Conta: 00000-0",
  "Lançamentos",
  "Dia Lote Documento Histórico Valor",
  "13/08/2026 Saldo Anterior 0,00 (+)",
  "Recebimento de Proventos",
  "08/09/2026 10000 11111 00.000.000/0001-00 EMPRESA EXEMPLO 3.000,00 (+)",
  "LTDA",
  "Pix - Enviado",
  "08/09/2026 20000 22201 25,00 (-)",
  "05/09 10:44 Maria Souza Lima",
  "Pix - Enviado",
  "08/09/2026 20000 22202 1.500,00 (-)",
  "05/09 10:45 Joao Pereira Alves",
  "Pgto BB Consig Em Folha",
  "08/09/2026 20100 333444555666777 400,00 (-)",
  "123456789- BB CREDITO CONSIGNACAO",
  "BB Rende Fácil",
  "08/09/2026 9903 2,40 (-)",
  "Rende Facil",
  "08/09/2026 30000 Saldo do dia 0,00 (+)",
  "Pix - Recebido",
  "10/09/2026 30000 444555666777888 1.200,00 (+)",
  "10/09 19:07 12345678900 Ana Clara Ramos",
  "Pix - Enviado",
  "10/09/2026 20000 33301 1.200,00 (-)",
  "10/09 19:08 Carlos Eduardo Nunes",
  "10/09/2026 30000 Saldo do dia 0,00 (+)",
  "Pix - Recebido",
  "18/09/2026 30000 555666777888999 18/09 11:55 00000000000000 PEDRO 730,00 (+)",
  "SANTOS",
  "Pix - Enviado",
  "18/09/2026 20000 44401 325,00 (-)",
  "18/09 13:19 Maria Souza Lima",
  "Pix - Enviado",
  "18/09/2026 20000 44402 30,00 (-)",
  "18/09 21:04 Maria Souza Lima",
  "18/09/2026 9903 BB Rende Fácil 375,00 (-)",
  "18/09/2026 7000 Saldo do dia 0,00 (+)",
  "21/09/2026 S A L D O 45,00 (-)",
  "Informações Adicionais",
  "Invest. Resgate Autom. 375,00 (+)",
  "Saldo 330,00 (+)",
  "Juros * 0,00",
  "CREDITO BB-MELHOR OFERTA* 50.000,00 (+)",
  "Lançamentos Futuros",
  "Dia Histórico Valor",
  "00/00/0000 0,00 (+)",
  "Aplicações Financeiras",
  "BB RENDE FACIL 375,00",
];

describe("extrato de conta do Banco do Brasil", () => {
  const result = parseStatementLines(BANCO_DO_BRASIL, new Date(2026, 8, 19));

  it("lê sinal (+)/(-), junta o histórico e tira lote, documento, CPF e CNPJ", () => {
    expect(
      result.transactions.map((t) => [t.date, t.description, t.type, t.amount]),
    ).toEqual([
      ["08/09/2026", "Recebimento de Proventos EMPRESA EXEMPLO LTDA", "income", 3000],
      ["08/09/2026", "Pix - Enviado Maria Souza Lima", "expense", 25],
      ["08/09/2026", "Pix - Enviado Joao Pereira Alves", "expense", 1500],
      ["08/09/2026", "Pgto BB Consig Em Folha BB CREDITO CONSIGNACAO", "expense", 400],
      ["10/09/2026", "Pix - Recebido Ana Clara Ramos", "income", 1200],
      ["10/09/2026", "Pix - Enviado Carlos Eduardo Nunes", "expense", 1200],
      ["18/09/2026", "Pix - Recebido PEDRO SANTOS", "income", 730],
      ["18/09/2026", "Pix - Enviado Maria Souza Lima", "expense", 325],
      ["18/09/2026", "Pix - Enviado Maria Souza Lima", "expense", 30],
    ]);
  });

  it("marca Pix como Pix e proventos como Salário", () => {
    expect(result.transactions.map((t) => t.category)).toEqual([
      "Salário",
      "Pix",
      "Pix",
      "Geral",
      "Pix",
      "Pix",
      "Pix",
      "Pix",
      "Pix",
    ]);
  });

  it("ignora saldos, BB Rende Fácil e o que vem depois de 'Informações Adicionais'", () => {
    expect(result.totalRows).toBe(9);
    expect(result.invalid).toBe(0);
    expect(result.ignoredTransfers).toBe(2);
  });

  it("não deixa dados da conta na descrição", () => {
    const text = result.transactions.map((t) => t.description).join(" ");
    expect(text).not.toMatch(/\d{7,}/);
    expect(text).not.toMatch(/Agência|Conta|Cliente/);
  });
});

// Dados fictícios, na mesma ordem de linhas que o pdf.js entrega para o extrato
// consolidado do Santander: data só na 1ª linha do dia, "-" depois do valor de
// débito, nome do Pix na linha de baixo e quebra de página no meio da tabela.
const SANTANDER = [
  "EXTRATO CONSOLIDADO INTELIGENTE",
  "agosto/2026",
  "Resumo - agosto/2026",
  "Nome",
  "NOME DO TITULAR",
  "Agência",
  "0000",
  "Conta Corrente",
  "00.000000-0",
  "Conta Corrente",
  "Movimentação",
  "Data Descrição Nº Documento Movimento (R$) Saldo (R$)",
  "SALDO EM 31/07 0,00",
  "03/08 PIX RECEBIDO MARIA SOUZA LIMA - 100,00",
  "PIX ENVIADO - 40,00- 60,00",
  "Joao Pereira Alves",
  "05/08 PIX ENVIADO - 10,00-",
  "Ana Clara Ramos",
  "PIX ENVIADO - 50,00- 0,00",
  "Ana Clara Ramos",
  "07/08 PIX RECEBIDO - 1.180,00 1.180,00",
  "CARLOS EDUARDO NUNES",
  "10/08 TRANSFERENCIA PROGRAMADA - 50,00- 1.130,00",
  "PARA: 0000.60.000000-0",
  "11/08 COMPRA CARTAO DEB MC 111222 68,87- 1.061,13",
  "11/08 MERCADO EXEMPLO 001 AS",
  "12/08 RESG POUP - CENTRAL/INTERNET/APP 333444 50,00",
  "DE: 0000.60.000000-0",
  "Extrato_PF_A4_Inteligente - 01/01/2024",
  "BALP_XX_M0000000_MXDD0000.PIM -",
  "Pagina: 2/5",
  "EXTRATO CONSOLIDADO INTELIGENTE",
  "agosto/2026",
  "Data Descrição Nº Documento Movimento (R$) Saldo (R$)",
  "PIX ENVIADO - 31,00- 1.080,13",
  "Ana Clara Ramos",
  "17/08 EMPRESTIMO CONSIGNADO 123456789 444555 221,68- 858,45",
  "SALDO EM 31/08 858,45",
  "Se você não tem Limite da Conta e a sua conta ficou com saldo devedor, terá sido prestado o serviço",
  "Saldos por Período",
  "03 60,00 0,00 0,00 0,00 0,00 0,00 60,00",
  "Compras com Cartão de Débito",
  "11/08 5201.0000 MERCADO EXEMPLO 001 AS 68,87",
  "Comprovantes de Pagamento",
  "03/08 INTERNET BANKING PIX JOAO PEREIRA ALVES 00000000 0000 0000000000000 40,00",
  "Poupança",
  "Data Descrição Movimento (R$) Saldo (R$)",
  "10/08 TRANSFERENCIA PROGRAMADA 50,00 50,00",
  "DE: 0000.01.000000-0",
];

describe("extrato consolidado do Santander", () => {
  const result = parseStatementLines(SANTANDER, new Date(2026, 8, 19));

  it("usa a data da 1ª linha do dia, o ano do título e o '-' pra achar despesas", () => {
    expect(
      result.transactions.map((t) => [t.date, t.description, t.type, t.amount]),
    ).toEqual([
      ["03/08/2026", "PIX RECEBIDO MARIA SOUZA LIMA", "income", 100],
      ["03/08/2026", "PIX ENVIADO Joao Pereira Alves", "expense", 40],
      ["05/08/2026", "PIX ENVIADO Ana Clara Ramos", "expense", 10],
      ["05/08/2026", "PIX ENVIADO Ana Clara Ramos", "expense", 50],
      ["07/08/2026", "PIX RECEBIDO CARLOS EDUARDO NUNES", "income", 1180],
      ["11/08/2026", "COMPRA CARTAO DEB MC MERCADO EXEMPLO 001 AS", "expense", 68.87],
      ["12/08/2026", "PIX ENVIADO Ana Clara Ramos", "expense", 31],
      ["17/08/2026", "EMPRESTIMO CONSIGNADO", "expense", 221.68],
    ]);
  });

  it("marca Pix como Pix e compra de mercado como Alimentação", () => {
    expect(result.transactions.map((t) => t.category)).toEqual([
      "Pix",
      "Pix",
      "Pix",
      "Pix",
      "Pix",
      "Alimentação",
      "Pix",
      "Geral",
    ]);
  });

  it("ignora o vai e volta da poupança, saldos, comprovantes e a tabela da poupança", () => {
    expect(result.totalRows).toBe(8);
    expect(result.invalid).toBe(0);
    expect(result.ignoredTransfers).toBe(2);
  });

  it("recua o ano quando o mês do lançamento é depois do mês do extrato", () => {
    const lines = [
      "janeiro/2026",
      "Data Descrição Nº Documento Movimento (R$) Saldo (R$)",
      "30/12 PIX ENVIADO - 10,00- 5,00",
      "Joao Pereira Alves",
      "02/01 PIX RECEBIDO - 20,00 25,00",
      "Maria Souza Lima",
    ];
    const dates = parseStatementLines(lines, new Date(2026, 8, 19)).transactions.map(
      (t) => t.date,
    );
    expect(dates).toEqual(["30/12/2025", "02/01/2026"]);
  });

  it("não deixa dados da conta na descrição", () => {
    const text = result.transactions.map((t) => t.description).join(" ");
    expect(text).not.toMatch(/\d{7,}/);
    expect(text).not.toMatch(/Agência|Conta Corrente|0000\.\d{2}/);
  });
});

describe("extrato de conta do Mercado Pago", () => {
  const lines = [
    "EXTRATO DE TESTE (dados ficticios)",
    "Periodo: 01/09/2026 a 19/09/2026",
    "Saldo inicial: R$ 1.500,00",
    "Data Descricao ID da operacao Valor Saldo",
    "01/09/2026 Voce recebeu um Pix de Joao da Silva 88250398513 150,00 1.650,00",
    "03/09/2026 Transferencia enviada via Pix 88250399012 -230,00 1.465,90",
    "04/09/2026 Pagamento de conta - Energia Eletrica 88250399555 -180,45 1.285,45",
    "05/09/2026 Recebimento de venda - Mercado Livre 88250399888 320,00 1.605,45",
    "10/09/2026 Transferencia enviada via Pix 88250400555 -1.200,00 910,65",
    "Saldo final: R$ 910,65",
  ];

  it("lê entradas sem sinal e saídas com '-'", () => {
    const { transactions, invalid, totalRows } = parseStatementLines(lines, TODAY);
    expect(invalid).toBe(0);
    expect(totalRows).toBe(5);
    expect(transactions).toEqual([
      {
        amount: 150,
        date: "01/09/2026",
        description: "Voce recebeu um Pix de Joao da Silva",
        type: "income",
        category: "Pix",
      },
      {
        amount: 230,
        date: "03/09/2026",
        description: "Transferencia enviada via Pix",
        type: "expense",
        category: "Pix",
      },
      {
        amount: 180.45,
        date: "04/09/2026",
        description: "Pagamento de conta - Energia Eletrica",
        type: "expense",
        category: "Moradia",
      },
      {
        amount: 320,
        date: "05/09/2026",
        description: "Recebimento de venda - Mercado Livre",
        type: "income",
        category: "Salário",
      },
      {
        amount: 1200,
        date: "10/09/2026",
        description: "Transferencia enviada via Pix",
        type: "expense",
        category: "Pix",
      },
    ]);
  });

  it("aceita R$ e data com hífen, como no PDF real", () => {
    const result = parseStatementLines(
      [
        "Data Descrição ID da operação Valor Saldo",
        "02-09-2026 Pix enviado Maria 12345678901 R$ -50,00 R$ 950,00",
        "03-09-2026 Pix recebido Ana 12345678902 R$ 20,00 R$ 970,00",
      ],
      TODAY,
    );
    expect(result.transactions.map((t) => [t.date, t.amount, t.type])).toEqual([
      ["02/09/2026", 50, "expense"],
      ["03/09/2026", 20, "income"],
    ]);
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
