import { getMonthNumber, MONTH_NAME_TO_NUMBER, MONTH_NAMES } from "./dates";

describe("MONTH_NAME_TO_NUMBER / MONTH_NAMES", () => {
  it("tem os 12 meses, na ordem do calendário", () => {
    expect(MONTH_NAMES).toEqual([
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ]);
  });

  it("mapeia cada nome para o número de dois dígitos correspondente", () => {
    expect(MONTH_NAME_TO_NUMBER.Janeiro).toBe("01");
    expect(MONTH_NAME_TO_NUMBER.Dezembro).toBe("12");
  });
});

describe("getMonthNumber", () => {
  it("retorna o número do mês para um nome válido", () => {
    expect(getMonthNumber("Março")).toBe("03");
    expect(getMonthNumber("Dezembro")).toBe("12");
  });

  it("cai no mês atual quando o nome não é reconhecido", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15)); // Junho/2026
    expect(getMonthNumber("mes-invalido")).toBe("06");
    jest.useRealTimers();
  });
});
