import { StyleSheet } from "react-native";
import { colors } from "../constants/colors";

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  menuContainer: {
    width: "75%",
    backgroundColor: colors.surface,
    height: "100%",
    padding: 24,
    paddingTop: 60,
    justifyContent: "space-between",
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  menuHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.accent,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    textAlign: "center",
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  menuBody: {
    flex: 1,
  },
  actionButton: {
    backgroundColor: colors.surfaceAlt, // Corrigido o valor de fundo
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "bold",
  },
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
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: 24,
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
