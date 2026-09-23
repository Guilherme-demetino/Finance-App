import { groupByCategory } from "./categoryBreakdown";

describe("groupByCategory", () => {
  it("soma os valores por categoria e calcula o % da receita total, do maior pro menor", () => {
    const result = groupByCategory(
      [
        { amount: 100, type: "expense", category: "Alimentação", color: "#111" },
        { amount: 50, type: "expense", category: "Alimentação", color: "#111" },
        { amount: 200, type: "expense", category: "Transporte", color: "#222" },
      ],
      1000,
      "#999",
    );

    expect(result).toEqual([
      { name: "TRANSPORTE", originalName: "Transporte", amount: 200, color: "#222", percent: 20 },
      { name: "ALIMENTAÇÃO", originalName: "Alimentação", amount: 150, color: "#111", percent: 15 },
    ]);
  });

  it("sem categoria, agrupa em 'Outros'", () => {
    const result = groupByCategory([{ amount: 30, type: "expense" }], 100, "#999");

    expect(result).toEqual([{ name: "OUTROS", originalName: "Outros", amount: 30, color: "#999", percent: 30 }]);
  });

  it("sem cor na transação, usa a cor de fallback", () => {
    const result = groupByCategory([{ amount: 10, type: "expense", category: "X" }], 100, "#abc");

    expect(result[0].color).toBe("#abc");
  });

  it("receita total zero: percentual fica 0 em vez de dividir por zero", () => {
    const result = groupByCategory([{ amount: 10, type: "expense", category: "X" }], 0, "#999");

    expect(result[0].percent).toBe(0);
  });

  it("sem transações, devolve lista vazia", () => {
    expect(groupByCategory([], 100, "#999")).toEqual([]);
  });
});
