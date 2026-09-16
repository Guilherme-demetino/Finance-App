import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    padding: 24,
    alignItems: "center", // Centraliza os itens
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#A1A1AA",
    marginBottom: 40,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 12,
    padding: 20,
    fontSize: 32,
    letterSpacing: 8,
    color: "#FFFFFF",
    textAlign: "center",
    width: "60%", // Caixa de texto mais curta, focada no centro
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#3B82F6",
    padding: 16,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  biometricButton: {
    padding: 16,
  },
  biometricText: {
    color: "#3B82F6",
    fontSize: 16,
    fontWeight: "600",
  },
});
