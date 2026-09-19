import * as ScreenOrientation from "expo-screen-orientation";
import { createContext, useState, type ReactNode } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { useRequiredContext } from "./useRequiredContext";

interface PanoramaContextValue {
  isLandscapePanoramaOpen: boolean;
  openLandscapePanorama: () => Promise<void>;
  closeLandscapePanorama: () => Promise<void>;
}

// Acompanha o quanto a tela rolou pra animar a borda do cabeçalho fixo.
// Compartilhado entre as abas pra o cabeçalho (renderizado uma vez no
// layout) reagir ao scroll de qualquer uma delas. É um valor compartilhado do
// Reanimated, com identidade fixa: rolar não re-renderiza ninguém.
const ScrollContext = createContext<SharedValue<number> | null>(null);
const PanoramaContext = createContext<PanoramaContextValue | null>(null);

export function DashboardUiProvider({ children }: { children: ReactNode }) {
  const scrollY = useSharedValue(0);
  const [isLandscapePanoramaOpen, setIsLandscapePanoramaOpen] = useState(false);

  const openLandscapePanorama = async () => {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    );
    setIsLandscapePanoramaOpen(true);
  };

  const closeLandscapePanorama = async () => {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );
    setIsLandscapePanoramaOpen(false);
  };

  const panorama: PanoramaContextValue = {
    isLandscapePanoramaOpen,
    openLandscapePanorama,
    closeLandscapePanorama,
  };

  return (
    <ScrollContext.Provider value={scrollY}>
      <PanoramaContext.Provider value={panorama}>
        {children}
      </PanoramaContext.Provider>
    </ScrollContext.Provider>
  );
}

export function useScrollY() {
  return useRequiredContext(
    ScrollContext,
    "useScrollY",
    "DashboardUiProvider",
  );
}

export function usePanorama() {
  return useRequiredContext(
    PanoramaContext,
    "usePanorama",
    "DashboardUiProvider",
  );
}
