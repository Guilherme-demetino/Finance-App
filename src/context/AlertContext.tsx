import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useRequiredContext } from "./useRequiredContext";

interface AlertActions {
  showAlert: (title: string, message: string) => void;
}

interface AlertState {
  alertVisible: boolean;
  alertTitle: string;
  alertMessage: string;
  setAlertVisible: (value: boolean) => void;
}

// Dois contextos: quem só dispara avisos (quase todo mundo) recebe um valor
// que nunca muda; só o componente que desenha o aviso acompanha o estado.
const AlertActionsContext = createContext<AlertActions | null>(null);
const AlertStateContext = createContext<AlertState | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = useCallback((title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  const actions = useMemo(() => ({ showAlert }), [showAlert]);
  const state: AlertState = {
    alertVisible,
    alertTitle,
    alertMessage,
    setAlertVisible,
  };

  return (
    <AlertActionsContext.Provider value={actions}>
      <AlertStateContext.Provider value={state}>
        {children}
      </AlertStateContext.Provider>
    </AlertActionsContext.Provider>
  );
}

export function useAlert() {
  return useRequiredContext(AlertActionsContext, "useAlert", "AlertProvider");
}

export function useAlertState() {
  return useRequiredContext(
    AlertStateContext,
    "useAlertState",
    "AlertProvider",
  );
}
