export const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  Janeiro: "01",
  Fevereiro: "02",
  Março: "03",
  Abril: "04",
  Maio: "05",
  Junho: "06",
  Julho: "07",
  Agosto: "08",
  Setembro: "09",
  Outubro: "10",
  Novembro: "11",
  Dezembro: "12",
};

export const MONTH_NAMES = Object.keys(MONTH_NAME_TO_NUMBER);

/** Número do mês (ex: "03") a partir do nome em português, com fallback pro mês atual. */
export function getMonthNumber(monthName: string): string {
  return (
    MONTH_NAME_TO_NUMBER[monthName] ||
    String(new Date().getMonth() + 1).padStart(2, "0")
  );
}
