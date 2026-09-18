import {
  addMonthsToDateString,
  getMonthNumber,
  MONTH_NAME_TO_NUMBER,
  MONTH_NAMES,
} from "./dates";

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

describe("addMonthsToDateString", () => {
  it("soma meses mantendo o mesmo dia", () => {
    expect(addMonthsToDateString("15/03/2026", 1)).toBe("15/04/2026");
    expect(addMonthsToDateString("15/03/2026", 3)).toBe("15/06/2026");
  });

  it("vira o ano quando ultrapassa dezembro", () => {
    expect(addMonthsToDateString("10/11/2026", 3)).toBe("10/02/2027");
  });

  it("recua o ano quando soma meses negativos além de janeiro", () => {
    expect(addMonthsToDateString("10/01/2026", -2)).toBe("10/11/2025");
  });

  it("ajusta pro último dia válido quando o dia não existe no mês de destino", () => {
    // 31/01 + 1 mês -> fevereiro não tem dia 31, cai no dia 28 (2026 não é bissexto)
    expect(addMonthsToDateString("31/01/2026", 1)).toBe("28/02/2026");
  });

  it("respeita anos bissextos ao ajustar o dia 31 para fevereiro", () => {
    expect(addMonthsToDateString("31/01/2028", 1)).toBe("29/02/2028");
  });

  it("somar zero meses retorna a mesma data", () => {
    expect(addMonthsToDateString("05/07/2026", 0)).toBe("05/07/2026");
  });
});
