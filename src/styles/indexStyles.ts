import { StyleSheet } from "react-native";
import { colors } from "../constants/colors";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    // Ancorado no topo (e não centralizado) pra o teclado não cobrir o campo
    // do nome nem o botão.
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 110,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
    textAlign: "center",
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.surfaceAlt, // Fundo escuro igual ao botão do menu e login
    borderWidth: 1,
    borderColor: colors.textPrimary, // Borda branca
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: colors.textPrimary, // Texto branco
    fontSize: 16,
    fontWeight: "bold",
  },
});
