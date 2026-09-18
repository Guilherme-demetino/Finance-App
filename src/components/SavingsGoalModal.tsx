import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/colors";
import { formatDateToString, parseDateString } from "../utils/dates";
import { CalendarPicker } from "./CalendarPicker";
import { TopFormSheet } from "./TopFormSheet";

interface SavingsGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    targetAmount: number;
    savedAmount: number;
    deadline: string | null;
  }) => void;
  formatCurrency: (val: string) => string;
}

const inputStyle = {
  backgroundColor: colors.surfaceAlt,
  color: colors.textPrimary,
  padding: 16,
  borderRadius: 12,
};

const labelStyle = { color: colors.textMuted, fontSize: 13, marginBottom: 8 };

const toNumber = (value: string) =>
  Number(value.replace(/\./g, "").replace(",", "."));

export function SavingsGoalModal({
  visible,
  onClose,
  onSave,
  formatCurrency,
}: SavingsGoalModalProps) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [deadline, setDeadline] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName("");
      setTarget("");
      setSaved("");
      setDeadline("");
      setError(null);
    }
  }, [visible]);

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
    <TopFormSheet visible={visible} onClose={onClose} title="Nova meta de economia">
      <View style={{ marginBottom: 16 }}>
        <Text style={labelStyle}>Nome da meta</Text>
        <TextInput
          style={inputStyle}
          value={name}
          onChangeText={setName}
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
          placeholder="R$ 0,00"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={labelStyle}>Já tem guardado? (opcional)</Text>
        <TextInput
          style={inputStyle}
          keyboardType="numeric"
          value={saved}
          onChangeText={(text) => setSaved(formatCurrency(text))}
          placeholder="R$ 0,00"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={labelStyle}>Até quando? (opcional)</Text>
        <TouchableOpacity
          onPress={() => setShowPicker(true)}
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
              <TouchableOpacity onPress={() => setDeadline("")}>
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
          Criar meta
        </Text>
      </TouchableOpacity>
    </TopFormSheet>
  );
}
