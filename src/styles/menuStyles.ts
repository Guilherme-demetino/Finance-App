import { StyleSheet } from "react-native";
import { colors } from "../constants/colors";

export const styles = StyleSheet.create({
  closeButton: {
    backgroundColor: colors.border,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "bold",
  },
  // Estilos do Modal de Alterar Nome
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: colors.border,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalButtonSave: {
    flex: 1,
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "bold",
  },
});
