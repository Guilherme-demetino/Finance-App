import { useAlertState } from "../../context/AlertContext";
import { CustomAlert } from "../CustomAlert";

export function AlertContainer() {
  const { alertVisible, alertTitle, alertMessage, setAlertVisible } =
    useAlertState();

  return (
    <CustomAlert
      visible={alertVisible}
      title={alertTitle}
      message={alertMessage}
      onClose={() => setAlertVisible(false)}
    />
  );
}
