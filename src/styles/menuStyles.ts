import { makeStyles, modalCard, modalScrim } from "../theme";

export const useMenuStyles = makeStyles((theme) => {
  const { colors } = theme;
  return {
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
      backgroundColor: modalScrim(theme, 0.8),
      justifyContent: "center",
      padding: 24,
    },
    modalContent: {
      ...modalCard(theme),
      borderRadius: 16,
      padding: 24,
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
  };
});
