import { usePanorama } from "../../context/DashboardUiContext";
import { usePeriod } from "../../context/PeriodContext";
import { useTransactionsData } from "../../context/TransactionsContext";
import { LandscapePanoramaModal } from "../overview/LandscapePanoramaModal";

export function PanoramaContainer() {
  const { isLandscapePanoramaOpen, closeLandscapePanorama } = usePanorama();
  const { selectedYear } = usePeriod();
  const { monthsData } = useTransactionsData();

  return (
    <LandscapePanoramaModal
      visible={isLandscapePanoramaOpen}
      selectedYear={selectedYear}
      monthsData={monthsData}
      onClose={closeLandscapePanorama}
    />
  );
}
