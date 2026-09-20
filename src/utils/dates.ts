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

/**
 * Datas (DD/MM/AAAA) de um dia fixo do mês, mês a mês a partir do mês de
 * referência. Em meses que não têm aquele dia (ex: 31 em abril) usa o
 * último dia válido só naquele mês — os seguintes voltam ao dia original.
 */
export function getMonthlyDates(
  day: number,
  count: number,
  reference: Date = new Date(),
): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const monthStart = new Date(
      reference.getFullYear(),
      reference.getMonth() + i,
      1,
    );
    const lastDay = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
    ).getDate();
    const safeDay = Math.min(Math.max(1, Math.floor(day)), lastDay);
    dates.push(
      `${String(safeDay).padStart(2, "0")}/${String(monthStart.getMonth() + 1).padStart(2, "0")}/${monthStart.getFullYear()}`,
    );
  }
  return dates;
}

/** Converte uma data DD/MM/AAAA em Date, com fallback pra hoje quando o texto é inválido/vazio. */
export function parseDateString(value: string): Date {
  const [day, month, year] = String(value).split("/").map(Number);
  if (day && month && year) {
    return new Date(year, month - 1, day);
  }
  return new Date();
}

/** Converte um Date em string DD/MM/AAAA. */
export function formatDateToString(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "19/09/2026 às 20:30" (hora local do aparelho). */
export function formatDateTime(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return "não informada";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
