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

/**
 * Mês/ano anterior ao informado, tratando a virada de ano — o mês anterior
 * a Janeiro é Dezembro do ano passado. Usado no comparativo mês a mês.
 */
export function getPreviousMonth(
  monthName: string,
  year: string,
): { month: string; year: string } {
  const monthIndex = MONTH_NAMES.indexOf(monthName);
  if (monthIndex === -1) {
    return { month: monthName, year };
  }
  if (monthIndex === 0) {
    return { month: MONTH_NAMES[11], year: String(Number(year) - 1) };
  }
  return { month: MONTH_NAMES[monthIndex - 1], year };
}

/**
 * Soma meses a uma data no formato DD/MM/AAAA, usada para gerar as
 * ocorrências futuras de transações recorrentes/parceladas. Quando o dia
 * não existe no mês de destino (ex: dia 31 num mês de 30 dias), usa o
 * último dia válido daquele mês em vez de estourar pro mês seguinte.
 */
export function addMonthsToDateString(
  dateString: string,
  monthsToAdd: number,
): string {
  const [day, month, year] = dateString.split("/").map(Number);
  const targetMonthIndex = month - 1 + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  const lastDayOfTargetMonth = new Date(
    targetYear,
    targetMonth + 1,
    0,
  ).getDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);

  return `${String(targetDay).padStart(2, "0")}/${String(targetMonth + 1).padStart(2, "0")}/${targetYear}`;
}
