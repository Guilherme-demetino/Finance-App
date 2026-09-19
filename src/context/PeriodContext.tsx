import { createContext, useMemo, useState, type ReactNode } from "react";

import { MONTH_NAMES } from "../utils/dates";
import { useRequiredContext } from "./useRequiredContext";

export const YEARS_LIST = ["2024", "2025", "2026", "2027", "2028"];

interface PeriodContextValue {
  selectedMonth: string;
  setSelectedMonth: (value: string) => void;
  selectedYear: string;
  setSelectedYear: (value: string) => void;
}

interface TodayContextValue {
  currentMonthNum: string;
  currentYearStr: string;
  currentDay: string;
}

const PeriodContext = createContext<PeriodContextValue | null>(null);
// A data de hoje é separada do período selecionado: quem só precisa dela
// (dívidas, metas) não re-renderiza quando o usuário troca de mês.
const TodayContext = createContext<TodayContextValue | null>(null);

/** Mês/ano que o painel está mostrando (muda quando o usuário troca) e a data de hoje. */
export function PeriodProvider({ children }: { children: ReactNode }) {
  const today = new Date();
  const currentYearStr = String(today.getFullYear());
  const currentDay = String(today.getDate()).padStart(2, "0");
  const currentMonthNum = String(today.getMonth() + 1).padStart(2, "0");

  const [selectedMonth, setSelectedMonth] = useState(
    MONTH_NAMES[today.getMonth()],
  );
  const [selectedYear, setSelectedYear] = useState(currentYearStr);

  const period = useMemo(
    () => ({ selectedMonth, setSelectedMonth, selectedYear, setSelectedYear }),
    [selectedMonth, selectedYear],
  );
  const todayValue = useMemo(
    () => ({ currentMonthNum, currentYearStr, currentDay }),
    [currentMonthNum, currentYearStr, currentDay],
  );

  return (
    <TodayContext.Provider value={todayValue}>
      <PeriodContext.Provider value={period}>{children}</PeriodContext.Provider>
    </TodayContext.Provider>
  );
}

export function usePeriod() {
  return useRequiredContext(PeriodContext, "usePeriod", "PeriodProvider");
}

export function useToday() {
  return useRequiredContext(TodayContext, "useToday", "PeriodProvider");
}
