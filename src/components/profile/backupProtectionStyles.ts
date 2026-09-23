import { makeStyles, modalCard, modalScrim } from "../../theme";

/** Estilos compartilhados pelos modais de proteção de backup (ligar/trocar/desligar e pedir senha pra restaurar). */
export const useBackupProtectionStyles = makeStyles((theme) => {
  const { colors } = theme;
  return {
    // Perto do topo: o teclado abre na hora (autoFocus) e não pode cobrir os campos nem os botões.
    overlay: {
      flex: 1,
      backgroundColor: modalScrim(theme, 0.6),
      justifyContent: "flex-start",
      alignItems: "center",
      paddingTop: 48,
      paddingHorizontal: 16,
    },
    card: {
      width: "100%",
      maxHeight: "92%",
      ...modalCard(theme),
      borderRadius: 16,
      padding: 20,
    },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: 8 },
    text: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 4 },
    hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 8 },
    spaced: { marginTop: 16 },
    box: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    boxOn: { borderColor: colors.income },
    boxWarning: { borderColor: colors.categoryAmber },
    boxError: { borderColor: colors.expense },
    boxTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
    field: { marginTop: 14 },
    fieldLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 6 },
    input: {
      backgroundColor: colors.surfaceAlt,
      color: colors.textPrimary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
    switchLabel: { flex: 1, paddingRight: 12 },
    errorText: { color: colors.expense, fontSize: 14, fontWeight: "600", lineHeight: 20, marginTop: 12 },
    busy: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, marginTop: 8 },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 16,
    },
    primaryText: { color: colors.textOnColor, fontSize: 16, fontWeight: "700" },
    secondaryButton: {
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 12,
    },
    secondaryText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
    closeButton: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
    closeText: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
    disabled: { opacity: 0.4 },
  };
});
