import { useState } from "react";

import { useAccountFilter } from "../../context/AccountFilterContext";
import { useScrollY } from "../../context/DashboardUiContext";
import { usePeriod, YEARS_LIST } from "../../context/PeriodContext";
import { useProfile } from "../../context/ProfileContext";
import { useAccounts } from "../../hooks/useAccounts";
import { MONTH_NAMES } from "../../utils/dates";
import { AccountSwitchModal, MonthModal, YearModal } from "../transactions/FilterModals";
import { UserProfileHeader } from "../profile/UserProfileHeader";

/** Cabeçalho fixo com o seletor de mês, ano e conta em foco. O estado dos modais é só daqui. */
export function DashboardHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { userName, userImage } = useProfile();
  const { selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } =
    usePeriod();
  const { selectedAccount, setSelectedAccount } = useAccountFilter();
  const { options: accountOptions } = useAccounts();
  const scrollY = useScrollY();
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Só oferece o seletor quando há mais de uma conta: com uma só, não há entre o quê alternar.
  const showAccountSwitch = accountOptions.length > 1;

  return (
    <>
      <UserProfileHeader
        userName={userName}
        userImage={userImage}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        selectedAccount={showAccountSwitch ? selectedAccount : undefined}
        onOpenMonthModal={() => setIsMonthModalOpen(true)}
        onOpenYearModal={() => setIsYearModalOpen(true)}
        onOpenAccountModal={showAccountSwitch ? () => setIsAccountModalOpen(true) : undefined}
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

      <AccountSwitchModal
        visible={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        options={accountOptions.map((option) => ({ name: option.name, color: option.color }))}
        selectedAccount={selectedAccount}
        onSelect={setSelectedAccount}
      />
    </>
  );
}
