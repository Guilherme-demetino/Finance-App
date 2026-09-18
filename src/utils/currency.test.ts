import { formatCurrency, formatCurrencyInput } from "./currency";

describe("formatCurrency", () => {
  it("formata valores positivos com separador de milhar e duas casas", () => {
    expect(formatCurrency(1234.5)).toBe("R$ 1.234,50");
  });

  it("formata valores grandes com múltiplos separadores de milhar", () => {
    expect(formatCurrency(1234567.89)).toBe("R$ 1.234.567,89");
  });

  it("formata zero sem sinal", () => {
    expect(formatCurrency(0)).toBe("R$ 0,00");
  });

  it("usa '- R$' (não 'R$ -') para valores negativos", () => {
    expect(formatCurrency(-1234.56)).toBe("- R$ 1.234,56");
  });

  it("força o sinal de '+' quando pedido, mesmo em valor positivo", () => {
    expect(formatCurrency(500, { forceSign: "+" })).toBe("+ R$ 500,00");
  });

  it("força o sinal de '-' quando pedido, mesmo em valor positivo", () => {
    expect(formatCurrency(500, { forceSign: "-" })).toBe("- R$ 500,00");
  });

  it("nunca mostra mais de duas casas decimais (evita resíduo de ponto flutuante)", () => {
    expect(formatCurrency(19.999999997)).toBe("R$ 20,00");
  });

  it("trata valores não finitos (NaN/Infinity) como zero em vez de quebrar", () => {
    expect(formatCurrency(NaN)).toBe("R$ 0,00");
    expect(formatCurrency(Infinity)).toBe("R$ 0,00");
  });
});

describe("formatCurrencyInput", () => {
  it("retorna string vazia quando não há dígitos", () => {
    expect(formatCurrencyInput("")).toBe("");
    expect(formatCurrencyInput("abc")).toBe("");
  });

  it("interpreta os dígitos digitados como centavos", () => {
    expect(formatCurrencyInput("150")).toBe("1,50");
  });

  it("preenche com zero à esquerda quando faltam centavos", () => {
    expect(formatCurrencyInput("5")).toBe("0,05");
  });

  it("adiciona separador de milhar para valores grandes", () => {
    expect(formatCurrencyInput("123456789")).toBe("1.234.567,89");
  });

  it("ignora caracteres não numéricos já presentes no valor", () => {
    expect(formatCurrencyInput("R$ 1.500")).toBe("15,00");
  });
});
