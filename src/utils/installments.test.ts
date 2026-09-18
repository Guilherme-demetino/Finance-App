import { planRemainingInstallments } from "./installments";

describe("planRemainingInstallments", () => {
  it("lança da parcela atual até a última, uma por mês", () => {
    expect(planRemainingInstallments("Celular", 3, 5, "15/09/2026")).toEqual([
      { number: 3, date: "15/09/2026", description: "Celular (3/5)" },
      { number: 4, date: "15/10/2026", description: "Celular (4/5)" },
      { number: 5, date: "15/11/2026", description: "Celular (5/5)" },
    ]);
  });

  it("gera só uma parcela quando a atual é a última", () => {
    expect(planRemainingInstallments("Sofá", 6, 6, "10/09/2026")).toEqual([
      { number: 6, date: "10/09/2026", description: "Sofá (6/6)" },
    ]);
  });

  it("vira o ano quando as parcelas passam de dezembro", () => {
    const plan = planRemainingInstallments("TV", 1, 3, "20/11/2026");
    expect(plan.map((item) => item.date)).toEqual([
      "20/11/2026",
      "20/12/2026",
      "20/01/2027",
    ]);
  });
});
