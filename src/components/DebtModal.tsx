import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/colors";
import type { DebtType } from "../types";
import { formatDateToString, parseDateString } from "../utils/dates";
import { CalendarPicker } from "./CalendarPicker";
import { TopFormSheet } from "./TopFormSheet";

interface DebtModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    person: string;
    amount: number;
    type: DebtType;
    description: string | null;
    dueDate: string | null;
  }) => void;
  formatCurrency: (val: string) => string;
}

export function DebtModal({
  visible,
  onClose,
  onSave,
  formatCurrency,
}: DebtModalProps) {
  const [type, setType] = useState<DebtType>("lent");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showDuePicker, setShowDuePicker] = useState(false);

  // Reseta o formulário quando o modal abre (durante a renderização, sem setState no effect).
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setType("lent");
      setPerson("");
      setAmount("");
      setDescription("");
      setDueDate("");
    }
  }

  const handleSave = () => {
    const safePerson = person.trim();
    const numericValue = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!safePerson || isNaN(numericValue) || numericValue <= 0) return;

    onSave({
      person: safePerson,
      amount: numericValue,
      type,
      description: description.trim() || null,
      dueDate: dueDate || null,
    });
  };

  return (
    <TopFormSheet visible={visible} onClose={onClose} title="Nova Dívida/Empréstimo">
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor:
              type === "lent" ? "rgba(16, 185, 129, 0.15)" : colors.surfaceAlt,
            borderWidth: 1,
            borderColor: type === "lent" ? colors.income : colors.surfaceAlt,
          }}
          onPress={() => setType("lent")}
        >
          <Text
            style={{
              color: type === "lent" ? colors.income : colors.textMuted,
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            Emprestei{"\n"}(a receber)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor:
              type === "borrowed" ? "rgba(239, 68, 68, 0.15)" : colors.surfaceAlt,
            borderWidth: 1,
            borderColor: type === "borrowed" ? colors.expense : colors.surfaceAlt,
          }}
          onPress={() => setType("borrowed")}
        >
          <Text
            style={{
              color: type === "borrowed" ? colors.expense : colors.textMuted,
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            Peguei emprestado{"\n"}(a pagar)
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
          {type === "lent"
            ? "Pra quem você emprestou?"
            : "De quem você pegou emprestado?"}
        </Text>
        <TextInput
          style={{
            backgroundColor: colors.surfaceAlt,
            color: colors.textPrimary,
            padding: 16,
            borderRadius: 12,
          }}
          value={person}
          onChangeText={setPerson}
          placeholder="Ex: João"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
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

      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
          {type === "lent"
            ? "Dia para receber (opcional)"
            : "Dia para pagar (opcional)"}
        </Text>
        <TouchableOpacity
          onPress={() => setShowDuePicker(true)}
          style={{
            backgroundColor: colors.surfaceAlt,
            padding: 16,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: dueDate ? colors.textPrimary : colors.textPlaceholder }}>
            {dueDate || "DD/MM/AAAA"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {dueDate ? (
              <TouchableOpacity onPress={() => setDueDate("")}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
            <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        <CalendarPicker
          visible={showDuePicker}
          value={parseDateString(dueDate)}
          accentColor={type === "lent" ? colors.income : colors.expense}
          onClose={() => setShowDuePicker(false)}
          onSelect={(selectedDate) => {
            setShowDuePicker(false);
            setDueDate(formatDateToString(selectedDate));
          }}
        />
      </View>

      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
          Observação (opcional)
        </Text>
        <TextInput
          style={{
            backgroundColor: colors.surfaceAlt,
            color: colors.textPrimary,
            padding: 16,
            borderRadius: 12,
          }}
          value={description}
          onChangeText={setDescription}
          placeholder="Ex: Almoço de sexta"
          placeholderTextColor={colors.textPlaceholder}
        />
      </View>

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
        <Text
          style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 16 }}
        >
          Salvar
        </Text>
      </TouchableOpacity>
    </TopFormSheet>
  );
}
