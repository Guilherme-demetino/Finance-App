import { parseReceiptText } from "./receiptOcr";

const TODAY = new Date(2026, 8, 22); // 22/09/2026

describe("parseReceiptText", () => {
  it("lê o total, a data e o nome da loja de um cupom fiscal típico", () => {
    const text = [
      "SUPERMERCADO BOM PRECO LTDA",
      "CNPJ: 12.345.678/0001-95",
      "CUPOM FISCAL",
      "Arroz 5kg          25,90",
      "Feijao 1kg          8,50",
      "Leite 1L            4,20",
      "SUBTOTAL           38,60",
      "TOTAL R$            38,60",
      "DATA: 15/09/2026 14:32:10",
      "FORMA PAGAMENTO: CARTAO DEBITO",
    ].join("\n");

    const result = parseReceiptText(text, TODAY);

    expect(result.amount).toBe(38.6);
    expect(result.date).toBe("15/09/2026");
    expect(result.description).toBe("SUPERMERCADO BOM PRECO LTDA");
    expect(result.category).toBe("Alimentação");
  });

  it("sem uma linha de total, usa o maior valor da página (o total costuma ser o maior)", () => {
    const text = ["FARMACIA SAUDE", "Dipirona          12,50", "Vitamina C        45,00", "Protetor solar    89,90"].join("\n");

    const result = parseReceiptText(text, TODAY);

    expect(result.amount).toBe(89.9);
  });

  it("ignora o subtotal e pega o total de verdade, mesmo com valores parecidos", () => {
    const text = ["LOJA X", "SUBTOTAL 100,00", "DESCONTO 10,00", "TOTAL A PAGAR 90,00"].join("\n");

    const result = parseReceiptText(text, TODAY);

    expect(result.amount).toBe(90);
  });

  it("não confunde CNPJ nem chave de acesso da NFC-e com um valor em dinheiro", () => {
    const text = [
      "LOJA Y",
      "CNPJ 12.345.678/0001-95",
      "Chave de acesso: 1234 5678 9012 3456 7890 1234 5678 9012 3456 7890 1234",
      "TOTAL R$ 55,00",
    ].join("\n");

    const result = parseReceiptText(text, TODAY);

    expect(result.amount).toBe(55);
  });

  it("sem nenhuma data no texto, usa a data de hoje", () => {
    const text = ["LOJA Z", "TOTAL 20,00"].join("\n");

    const result = parseReceiptText(text, TODAY);

    expect(result.date).toBe("22/09/2026");
  });

  it("sem nenhum valor com cara de dinheiro, o valor vem null", () => {
    const text = ["LOJA SEM PRECOS", "OBRIGADO PELA PREFERENCIA"].join("\n");

    const result = parseReceiptText(text, TODAY);

    expect(result.amount).toBeNull();
  });

  it("pula linhas vazias e as só com números ao procurar o nome da loja", () => {
    const text = ["", "12345", "  ", "Padaria Pao Quente", "TOTAL 15,00"].join("\n");

    const result = parseReceiptText(text, TODAY);

    expect(result.description).toBe("Padaria Pao Quente");
    expect(result.category).toBe("Alimentação");
  });

  it("texto vazio: nada é encontrado, menos a data (cai em hoje)", () => {
    const result = parseReceiptText("", TODAY);

    expect(result).toEqual({ amount: null, date: "22/09/2026", description: null, category: null });
  });
});
