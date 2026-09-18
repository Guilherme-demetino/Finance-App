import { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/colors";
import type { SavingsGoalRow } from "../types";
import { formatCurrency as formatCurrencyDisplay } from "../utils/currency";
import { TopFormSheet } from "./TopFormSheet";

interface SavingsDepositModalProps {
  goal: SavingsGoalRow | null;
  onClose: () => void;
  onConfirm: (goal: SavingsGoalRow, delta: number) => void;
  formatCurrency: (val: string) => string;
}

type Mode = "deposit" | "withdraw";

export function SavingsDepositModal({
  goal,
  onClose,
  onConfirm,
  formatCurrency,
}: SavingsDepositModalProps) {
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (goal) {
      setMode("deposit");
      setAmount("");
      setError(null);
    }
  }, [goal]);

  const handleSave = () => {
    if (!goal) return;
    const value = Number(amount.replace(/\./g, "").replace(",", "."));
    if (isNaN(value) || value <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (mode === "withdraw" && value > goal.saved_amount) {
      setError(
        `Você só tem ${formatCurrencyDisplay(goal.saved_amount)} guardado nessa meta.`,
      );
      return;
    }
    onConfirm(goal, mode === "deposit" ? value : -value);
  };

  const accent = mode === "deposit" ? colors.income : colors.expense;

  return (
    <TopFormSheet
      visible={goal !== null}
      onClose={onClose}
      title={goal ? goal.name : ""}
    >
      {goal ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 13,
            marginTop: -12,
            marginBottom: 20,
          }}
        >
          Guardado: {formatCurrencyDisplay(goal.saved_amount)} de{" "}
          {formatCurrencyDisplay(goal.target_amount)}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor:
              mode === "deposit" ? "rgba(16, 185, 129, 0.15)" : colors.surfaceAlt,
            borderWidth: 1,
            borderColor: mode === "deposit" ? colors.income : colors.surfaceAlt,
          }}
          onPress={() => {
            setMode("deposit");
            setError(null);
          }}
        >
          <Text
            style={{
              color: mode === "deposit" ? colors.income : colors.textMuted,
              fontWeight: "bold",
            }}
          >
            Guardar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor:
              mode === "withdraw" ? "rgba(239, 68, 68, 0.15)" : colors.surfaceAlt,
            borderWidth: 1,
            borderColor: mode === "withdraw" ? colors.expense : colors.surfaceAlt,
          }}
          onPress={() => {
            setMode("withdraw");
            setError(null);
          }}
        >
          <Text
            style={{
              color: mode === "withdraw" ? colors.expense : colors.textMuted,
              fontWeight: "bold",
            }}
          >
            Retirar
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
          Valor (R$)
        </Text>
        <TextInput
          style={{
            backgroundColor: colors.surfaceAlt,
            color: colors.textPrimary,
            padding: 16,
            borderRadius: 12,
          }}
          keyboardType="numeric"
          value={amount}
          onChangeText={(text) => setAmount(formatCurrency(text))}
          placeholder="R$ 0,00"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      {error ? (
        <Text style={{ color: colors.expense, fontSize: 13, marginBottom: 12 }}>
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={handleSave}
        style={{
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1,
          borderColor: accent,
          padding: 16,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: accent, fontWeight: "bold", fontSize: 16 }}>
          {mode === "deposit" ? "Guardar valor" : "Retirar valor"}
        </Text>
      </TouchableOpacity>
    </TopFormSheet>
  );
}
