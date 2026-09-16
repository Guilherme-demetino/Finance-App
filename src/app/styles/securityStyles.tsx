import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#A1A1AA",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 16,
    textAlign: "center",
    letterSpacing: 8,
  },
  button: {
    backgroundColor: "#2A2A2A", // Fundo escuro igual ao botão do menu
    borderWidth: 1,
    borderColor: "#FFFFFF", // Borda branca
    padding: 16,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#FFFFFF", // Texto branco
    fontSize: 16,
    fontWeight: "bold",
  },
  biometricButton: {
    backgroundColor: "#2A2A2A", // Fundo escuro igual ao botão principal
    borderWidth: 1,
    borderColor: "#FFFFFF", // Borda branca
    padding: 16,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  biometricText: {
    color: "#FFFFFF", // Texto branco
    fontSize: 16,
    fontWeight: "bold",
  },
});
