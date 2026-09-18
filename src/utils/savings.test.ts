import {
  monthlyDepositNeeded,
  monthsUntilDeadline,
  savingsProgress,
} from "./savings";

const TODAY = new Date(2026, 8, 18); // 18/09/2026

describe("savingsProgress", () => {
  it("calcula o percentual guardado", () => {
    expect(savingsProgress(1250, 5000)).toBe(25);
  });

  it("limita entre 0 e 100", () => {
    expect(savingsProgress(6000, 5000)).toBe(100);
    expect(savingsProgress(-10, 5000)).toBe(0);
  });

  it("devolve 0 quando a meta é inválida", () => {
    expect(savingsProgress(100, 0)).toBe(0);
  });
});

describe("monthsUntilDeadline", () => {
  it("conta a diferença de meses até o prazo", () => {
    expect(monthsUntilDeadline("31/12/2026", TODAY)).toEqual({
      monthsLeft: 3,
      isOverdue: false,
    });
  });

  it("atravessa o ano", () => {
    expect(monthsUntilDeadline("15/03/2027", TODAY).monthsLeft).toBe(6);
  });

  it("no mesmo mês, conta pelo menos 1", () => {
    expect(monthsUntilDeadline("30/09/2026", TODAY).monthsLeft).toBe(1);
  });

  it("marca prazo vencido", () => {
    expect(monthsUntilDeadline("01/09/2026", TODAY).isOverdue).toBe(true);
  });
});

describe("monthlyDepositNeeded", () => {
  it("divide o que falta pelos meses restantes", () => {
    expect(monthlyDepositNeeded(500, 3500, "31/12/2026", TODAY)).toBe(1000);
  });

  it("arredonda pra cima em centavos", () => {
    expect(monthlyDepositNeeded(0, 1000, "31/12/2026", TODAY)).toBe(333.34);
  });

  it("retorna null sem prazo, com meta batida ou prazo vencido", () => {
    expect(monthlyDepositNeeded(0, 1000, null, TODAY)).toBeNull();
    expect(monthlyDepositNeeded(1000, 1000, "31/12/2026", TODAY)).toBeNull();
    expect(monthlyDepositNeeded(0, 1000, "01/09/2026", TODAY)).toBeNull();
  });
});
