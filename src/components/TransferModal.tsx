import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, ScrollView, TouchableOpacity, View } from "react-native";
import { createTransfer } from "../database/transfers";
import { useAccounts, type AccountOption } from "../hooks/useAccounts";
import { Text, TextInput, modalCard, modalScrim, useTheme } from "../theme";
import { formatCurrencyInput, parseCurrencyInput } from "../utils/currency";
import { formatDateToString, parseDateString } from "../utils/dates";
import { CalendarPicker } from "./forms/CalendarPicker";
import { AccountModal } from "./forms/AccountModal";

interface TransferModalProps {
  visible: boolean;
  onClose: () => void;
  /** Chamado depois de gravar a transferência com sucesso. */
  onDone: () => void;
}

function AccountPicker({
  label,
  options,
  selected,
  onSelect,
  onCreate,
}: {
  label: string;
  options: AccountOption[];
  selected: string | null;
  onSelect: (name: string) => void;
  onCreate: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 10 }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={onCreate}
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.textPrimary,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Ionicons name="add" size={14} color={colors.textPrimary} />
            <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 12 }}>Nova</Text>
          </TouchableOpacity>
          {options.map((option) => {
            const isSelected = selected === option.name;
            return (
              <TouchableOpacity
                key={option.name}
                onPress={() => onSelect(option.name)}
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: option.color,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  opacity: isSelected ? 1 : 0.5,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: option.color }} />
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "bold" }}>{option.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/** Move dinheiro entre duas contas: vira uma saída numa e uma entrada na outra, sem contar como receita ou despesa. */
export function TransferModal({ visible, onClose, onDone }: TransferModalProps) {
  const theme = useTheme();
  const { colors } = theme;
  const { options, refresh } = useAccounts();
  const [amountText, setAmountText] = useState("");
  const [date, setDate] = useState(() => formatDateToString(new Date()));
  const [fromAccount, setFromAccount] = useState<string | null>(null);
  const [toAccount, setToAccount] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [creatingFor, setCreatingFor] = useState<"from" | "to" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reseta o formulário toda vez que o modal abre (durante a renderização, sem setState no effect).
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setAmountText("");
      setDate(formatDateToString(new Date()));
      setFromAccount(null);
      setToAccount(null);
      setError(null);
      setIsSaving(false);
    }
  }

  if (!visible) return null;

  const amount = parseCurrencyInput(amountText);

  const handleSave = async () => {
    if (!amount || amount <= 0) {
      setError("Insira um valor válido.");
      return;
    }
    if (!fromAccount || !toAccount) {
      setError("Escolha a conta de origem e a de destino.");
      return;
    }
    if (fromAccount === toAccount) {
      setError("A origem e o destino não podem ser a mesma conta.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await createTransfer({ amount, date, fromAccount, toAccount });
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: modalScrim(theme, 0.6), justifyContent: "flex-start", paddingTop: 60 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ ...modalCard(theme), borderRadius: 24, marginHorizontal: 16, padding: 24 }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "bold" }}>Transferir entre contas</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>Valor (R$)</Text>
              <TextInput
                style={{ backgroundColor: colors.surfaceAlt, color: colors.textPrimary, padding: 16, borderRadius: 12, fontSize: 18 }}
                keyboardType="numeric"
                value={amountText}
                onChangeText={(text) => setAmountText(formatCurrencyInput(text))}
                placeholder="0,00"
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>Data</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={{
                  backgroundColor: colors.surfaceAlt,
                  padding: 16,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: colors.textPrimary }}>{date}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <AccountPicker
              label="De"
              options={options}
              selected={fromAccount}
              onSelect={setFromAccount}
              onCreate={() => setCreatingFor("from")}
            />

            <AccountPicker
              label="Para"
              options={options}
              selected={toAccount}
              onSelect={setToAccount}
              onCreate={() => setCreatingFor("to")}
            />

            {error ? <Text style={{ color: colors.expense, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}

            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={{
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.textPrimary,
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 16 }}>Transferir</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <CalendarPicker
          visible={showDatePicker}
          value={parseDateString(date)}
          accentColor={colors.accent}
          onClose={() => setShowDatePicker(false)}
          onSelect={(selectedDate) => {
            setShowDatePicker(false);
            setDate(formatDateToString(selectedDate));
          }}
        />
      </Modal>

      <AccountModal
        visible={creatingFor !== null}
        onClose={() => setCreatingFor(null)}
        onSave={(novaConta) => {
          const target = creatingFor;
          setCreatingFor(null);
          refresh();
          if (target === "from") setFromAccount(novaConta);
          else if (target === "to") setToAccount(novaConta);
        }}
      />
    </>
  );
}
