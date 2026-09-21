import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import type { SavingsGoalRow } from "../../types";
import { formatDateToString, parseDateString } from "../../utils/dates";
import { CalendarPicker } from "../forms/CalendarPicker";
import { TopFormSheet } from "../forms/TopFormSheet";
import { Text, TextInput, makeStyles, useTheme } from "../../theme";

interface SavingsGoalModalProps {
  visible: boolean;
  /** Meta a editar: o formulário abre preenchido com ela. Sem meta, é o formulário de criar. */
  goal?: SavingsGoalRow | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    targetAmount: number;
    savedAmount: number;
    deadline: string | null;
  }) => void;
  formatCurrency: (val: string) => string;
}

const useFieldStyles = makeStyles(({ colors }) => ({
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    padding: 16,
    borderRadius: 12,
  },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
}));

const toNumber = (value: string) =>
  Number(value.replace(/\./g, "").replace(",", "."));

export function SavingsGoalModal({
  visible,
  goal = null,
  onClose,
  onSave,
  formatCurrency,
}: SavingsGoalModalProps) {
  const { colors } = useTheme();
  const { input: inputStyle, label: labelStyle } = useFieldStyles();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [deadline, setDeadline] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = goal !== null;
  const toField = (amount: number) => formatCurrency(String(Math.round(amount * 100)));

  // Prepara o formulário quando o modal abre (durante a renderização, sem setState no effect):
  // vazio para criar, preenchido com a meta para editar.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(goal?.name ?? "");
      setTarget(goal ? toField(goal.target_amount) : "");
      setSaved(goal && goal.saved_amount > 0 ? toField(goal.saved_amount) : "");
      setDeadline(goal?.deadline ?? "");
      setError(null);
    }
  }

  const handleSave = () => {
    const targetAmount = toNumber(target);
    const savedAmount = saved ? toNumber(saved) : 0;

    if (!name.trim() || isNaN(targetAmount) || targetAmount <= 0) {
      setError("Preencha o nome da meta e o valor que você quer juntar.");
      return;
    }
    if (isNaN(savedAmount) || savedAmount < 0) {
      setError("O valor já guardado não pode ser negativo.");
      return;
    }

    onSave({
      name: name.trim(),
      targetAmount,
      savedAmount,
      deadline: deadline || null,
    });
  };

  return (
    <TopFormSheet
      visible={visible}
      onClose={onClose}
      title={isEditing ? "Editar meta de economia" : "Nova meta de economia"}
    >
      <View style={{ marginBottom: 16 }}>
        <Text style={labelStyle}>Nome da meta</Text>
        <TextInput
          style={inputStyle}
          value={name}
          onChangeText={setName}
          accessibilityLabel="Nome da meta"
          placeholder="Ex: Viagem, Reserva de emergência"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={labelStyle}>Quanto quer juntar (R$)</Text>
        <TextInput
          style={inputStyle}
          keyboardType="numeric"
          value={target}
          onChangeText={(text) => setTarget(formatCurrency(text))}
          accessibilityLabel="Valor da meta"
          placeholder="R$ 0,00"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={labelStyle}>
          {isEditing ? "Quanto já está guardado (R$)" : "Já tem guardado? (opcional)"}
        </Text>
        <TextInput
          style={inputStyle}
          keyboardType="numeric"
          value={saved}
          onChangeText={(text) => setSaved(formatCurrency(text))}
          accessibilityLabel="Valor já guardado"
          placeholder="R$ 0,00"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={labelStyle}>Até quando? (opcional)</Text>
        <TouchableOpacity
          onPress={() => setShowPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={deadline ? `Prazo: ${deadline}` : "Escolher prazo"}
          style={{
            ...inputStyle,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: deadline ? colors.textPrimary : colors.textPlaceholder }}>
            {deadline || "DD/MM/AAAA"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {deadline ? (
              <TouchableOpacity
                onPress={() => setDeadline("")}
                accessibilityRole="button"
                accessibilityLabel="Remover prazo"
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
            <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        <CalendarPicker
          visible={showPicker}
          value={parseDateString(deadline)}
          accentColor={colors.accent}
          onClose={() => setShowPicker(false)}
          onSelect={(selectedDate) => {
            setShowPicker(false);
            setDeadline(formatDateToString(selectedDate));
          }}
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
          borderColor: colors.textPrimary,
          padding: 16,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 16 }}>
          {isEditing ? "Salvar alterações" : "Criar meta"}
        </Text>
      </TouchableOpacity>
    </TopFormSheet>
  );
}
