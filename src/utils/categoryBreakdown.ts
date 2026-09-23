export interface CategoryBreakdownTransaction {
  amount: number;
  type: string;
  category?: string;
  color?: string;
}

export interface CategoryBreakdownItem {
  name: string;
  originalName: string;
  amount: number;
  color: string;
  percent: number;
}

/** Agrupa transações por categoria (soma e % do total de receita), ordenado do maior para o menor valor. */
export function groupByCategory(
  transactions: CategoryBreakdownTransaction[],
  totalIncome: number,
  fallbackColor: string,
): CategoryBreakdownItem[] {
  const grouped = transactions.reduce(
    (acc: Record<string, { amount: number; color: string }>, t) => {
      const cat = t.category || "Outros";
      if (!acc[cat]) {
        acc[cat] = {
          amount: 0,
          color: t.color || fallbackColor,
        };
      }
      acc[cat].amount += t.amount;
      return acc;
    },
    {},
  );

  return Object.keys(grouped)
    .map((key) => ({
      name: key.toUpperCase(),
      originalName: key,
      amount: grouped[key].amount,
      color: grouped[key].color,
      percent: totalIncome > 0 ? (grouped[key].amount / totalIncome) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}
