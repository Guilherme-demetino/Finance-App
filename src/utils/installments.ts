import { addMonthsToDateString } from "./dates";

export interface PlannedInstallment {
  number: number;
  date: string;
  description: string;
}

/**
 * Parcelas que ainda faltam de uma compra parcelada já em andamento: da
 * parcela `startNumber` até a `total`, uma por mês a partir de `firstDate`
 * (a data da próxima parcela), com a descrição marcada "(k/N)".
 */
export function planRemainingInstallments(
  title: string,
  startNumber: number,
  total: number,
  firstDate: string,
): PlannedInstallment[] {
  const plan: PlannedInstallment[] = [];
  for (let number = startNumber; number <= total; number++) {
    plan.push({
      number,
      date: addMonthsToDateString(firstDate, number - startNumber),
      description: `${title} (${number}/${total})`,
    });
  }
  return plan;
}
