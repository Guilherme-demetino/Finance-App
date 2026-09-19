import { useState } from "react";

import { useScrollY } from "../../context/DashboardUiContext";
import { usePeriod, YEARS_LIST } from "../../context/PeriodContext";
import { useProfile } from "../../context/ProfileContext";
import { MONTH_NAMES } from "../../utils/dates";
import { MonthModal, YearModal } from "../FilterModals";
import { UserProfileHeader } from "../UserProfileHeader";

/** Cabeçalho fixo com o seletor de mês e ano. O estado dos dois modais é só daqui. */
export function DashboardHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { userName, userImage } = useProfile();
  const { selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } =
    usePeriod();
  const scrollY = useScrollY();
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);

  return (
    <>
      <UserProfileHeader
        userName={userName}
        userImage={userImage}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onOpenMonthModal={() => setIsMonthModalOpen(true)}
        onOpenYearModal={() => setIsYearModalOpen(true)}
        onOpenMenu={onOpenMenu}
        scrollY={scrollY}
      />

      <MonthModal
        visible={isMonthModalOpen}
        onClose={() => setIsMonthModalOpen(false)}
        months={MONTH_NAMES}
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
      />

      <YearModal
        visible={isYearModalOpen}
        onClose={() => setIsYearModalOpen(false)}
        years={YEARS_LIST}
        selectedYear={selectedYear}
        onSelectYear={setSelectedYear}
      />
    </>
  );
}
