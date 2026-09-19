import {
  guessCategory,
  guessTypeFromDescription,
  isInternalTransfer,
  parseFlexibleDate,
  parseSignedAmount,
} from "./statementParsing";

describe("parseFlexibleDate", () => {
  it("aceita os formatos mais comuns e devolve DD/MM/AAAA", () => {
    expect(parseFlexibleDate("05/03/2026")).toBe("05/03/2026");
    expect(parseFlexibleDate("5/3/26")).toBe("05/03/2026");
    expect(parseFlexibleDate("05-03-2026")).toBe("05/03/2026");
    expect(parseFlexibleDate("05.03.2026")).toBe("05/03/2026");
    expect(parseFlexibleDate("2026-03-05")).toBe("05/03/2026");
    expect(parseFlexibleDate("2026-03-05 14:30:00")).toBe("05/03/2026");
    expect(parseFlexibleDate("05/03/2026 14:30")).toBe("05/03/2026");
  });

  it("recusa datas inexistentes e texto", () => {
    expect(parseFlexibleDate("31/02/2026")).toBeNull();
    expect(parseFlexibleDate("2026-13-01")).toBeNull();
    expect(parseFlexibleDate("Data")).toBeNull();
    expect(parseFlexibleDate("")).toBeNull();
  });
});

describe("parseSignedAmount", () => {
  it("lê o formato brasileiro", () => {
    expect(parseSignedAmount("R$ 1.234,56")).toEqual({ amount: 1234.56, sign: "none" });
    expect(parseSignedAmount("45,9")).toEqual({ amount: 45.9, sign: "none" });
    expect(parseSignedAmount("1.234")).toEqual({ amount: 1234, sign: "none" });
  });

  it("lê o formato americano", () => {
    expect(parseSignedAmount("1234.56")).toEqual({ amount: 1234.56, sign: "none" });
    expect(parseSignedAmount("1,234.56")).toEqual({ amount: 1234.56, sign: "none" });
    expect(parseSignedAmount("12.5")).toEqual({ amount: 12.5, sign: "none" });
  });

  it("reconhece o sinal de várias formas", () => {
    expect(parseSignedAmount("-50,00")?.sign).toBe("negative");
    expect(parseSignedAmount("- R$ 50,00")?.sign).toBe("negative");
    expect(parseSignedAmount("R$ -50,00")?.sign).toBe("negative");
    expect(parseSignedAmount("-R$ 50,00")?.sign).toBe("negative");
    expect(parseSignedAmount("(50,00)")?.sign).toBe("negative");
    expect(parseSignedAmount("50,00-")?.sign).toBe("negative");
    expect(parseSignedAmount("50,00 D")?.sign).toBe("negative");
    expect(parseSignedAmount("50,00 C")?.sign).toBe("positive");
    expect(parseSignedAmount("+50,00")?.sign).toBe("positive");
    expect(parseSignedAmount("50,00")?.amount).toBe(50);
  });

  it("recusa vazio, texto e zero", () => {
    expect(parseSignedAmount("")).toBeNull();
    expect(parseSignedAmount("abc")).toBeNull();
    expect(parseSignedAmount("0,00")).toBeNull();
  });
});

describe("guessTypeFromDescription", () => {
  it("reconhece receita e despesa pela descrição", () => {
    expect(guessTypeFromDescription("Pix recebido João")).toBe("income");
    expect(guessTypeFromDescription("Estorno de compra")).toBe("income");
    expect(guessTypeFromDescription("Salário empresa")).toBe("income");
    expect(guessTypeFromDescription("Compra no débito Mercado")).toBe("expense");
    expect(guessTypeFromDescription("Pix enviado Maria")).toBe("expense");
  });

  it("assume despesa sem pistas", () => {
    expect(guessTypeFromDescription("XPTO 123")).toBe("expense");
  });
});

describe("isInternalTransfer", () => {
  it("reconhece movimentações de caixinha e investimento", () => {
    expect(isInternalTransfer("Aplicação RDB")).toBe(true);
    expect(isInternalTransfer("Resgate RDB")).toBe(true);
    expect(isInternalTransfer("Dinheiro guardado - Caixinha Viagem")).toBe(true);
    expect(isInternalTransfer("Dinheiro resgatado")).toBe(true);
  });

  it("não confunde transações comuns", () => {
    expect(isInternalTransfer("Compra no débito - Mercado")).toBe(false);
    expect(isInternalTransfer("Transferência recebida pelo Pix - Ana")).toBe(false);
    expect(isInternalTransfer("Supermercado Nordeste")).toBe(false);
  });
});

describe("guessCategory", () => {
  it("usa as categorias padrão do app", () => {
    expect(guessCategory("Supermercado Extra", "expense")).toBe("Alimentação");
    expect(guessCategory("Uber *Trip", "expense")).toBe("Transporte");
    expect(guessCategory("Drogaria São Paulo", "expense")).toBe("Saúde");
    expect(guessCategory("Netflix.com", "expense")).toBe("Lazer");
    expect(guessCategory("Aluguel abril", "expense")).toBe("Moradia");
  });

  it("cai em Geral quando não reconhece uma despesa", () => {
    expect(guessCategory("XPTO 123", "expense")).toBe("Geral");
  });

  it("guarda a receita como Salário, exceto Pix e transferências", () => {
    expect(guessCategory("Salário", "income")).toBe("Salário");
    expect(guessCategory("Rendimento", "income")).toBe("Salário");
  });

  it("marca Pix e transferências como Pix, receita ou despesa", () => {
    expect(guessCategory("Transferência recebida pelo Pix", "income")).toBe("Pix");
    expect(guessCategory("Pix enviado João", "expense")).toBe("Pix");
    expect(guessCategory("Transferência enviada Maria", "expense")).toBe("Pix");
    expect(guessCategory("TRANSF. ENVIADA", "expense")).toBe("Pix");
  });
});
