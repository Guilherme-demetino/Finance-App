import { computeMonthProjection } from "./monthProjection";

const TODAY = new Date(2026, 8, 18); // 18/09/2026

describe("computeMonthProjection", () => {
  it("separa o que já aconteceu do que ainda vai cair no mês", () => {
    const result = computeMonthProjection(
      [
        { date: "05/09/2026", type: "income", amount: 3000 },
        { date: "10/09/2026", type: "expense", amount: 1000 },
        { date: "25/09/2026", type: "expense", amount: 400 },
        { date: "30/09/2026", type: "income", amount: 200 },
      ],
      TODAY,
    );

    expect(result.currentBalance).toBe(2000);
    expect(result.upcomingIncome).toBe(200);
    expect(result.upcomingExpense).toBe(400);
    expect(result.upcomingCount).toBe(2);
    expect(result.projectedBalance).toBe(1800);
  });

  it("trata o que tem data de hoje como já realizado", () => {
    const result = computeMonthProjection(
      [{ date: "18/09/2026", type: "expense", amount: 50 }],
      TODAY,
    );
    expect(result.currentBalance).toBe(-50);
    expect(result.upcomingCount).toBe(0);
  });

  it("sem transações, tudo zerado", () => {
    expect(computeMonthProjection([], TODAY)).toEqual({
      currentBalance: 0,
      upcomingIncome: 0,
      upcomingExpense: 0,
      upcomingCount: 0,
      projectedBalance: 0,
    });
  });
});
