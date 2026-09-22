import { Ionicons } from "@expo/vector-icons";
import { useRef, type ComponentProps } from "react";
import { DimensionValue, Modal, ScrollView, TouchableOpacity, View } from "react-native";
import { useMenuStyles } from "../../styles/menuStyles";
import { Text, useTheme } from "../../theme";

interface SelectionModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  maxHeight: DimensionValue;
  items: string[];
  selectedItem: string;
  onSelectItem: (item: string) => void;
}

function SelectionModal({
  visible,
  onClose,
  title,
  maxHeight,
  items,
  selectedItem,
  onSelectItem,
}: SelectionModalProps) {
  const { colors } = useTheme();
  const menuStyles = useMenuStyles();
  const scrollRef = useRef<ScrollView>(null);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={menuStyles.modalContainer}>
        <View style={[menuStyles.modalContent, { maxHeight }]}>
          <Text style={menuStyles.modalTitle}>{title}</Text>
          <ScrollView ref={scrollRef}>
            {items.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                // Ao abrir, rola até o item selecionado (ex: o mês atual).
                onLayout={
                  selectedItem === item
                    ? (e) =>
                        scrollRef.current?.scrollTo({
                          y: Math.max(0, e.nativeEvent.layout.y - 60),
                          animated: false,
                        })
                    : undefined
                }
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  alignItems: "center",
                }}
                onPress={() => {
                  onSelectItem(item);
                  onClose();
                }}
              >
                <Text
                  style={{
                    color: selectedItem === item ? colors.income : colors.textPrimary,
                    fontSize: 16,
                    fontWeight: selectedItem === item ? "bold" : "normal",
                  }}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[menuStyles.closeButton, { marginTop: 16 }]}
            onPress={onClose}
          >
            <Text style={menuStyles.closeButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface MonthModalProps {
  visible: boolean;
  onClose: () => void;
  months: string[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

export function MonthModal({
  visible,
  onClose,
  months,
  selectedMonth,
  onSelectMonth,
}: MonthModalProps) {
  return (
    <SelectionModal
      visible={visible}
      onClose={onClose}
      title="Selecione o Mês"
      maxHeight="70%"
      items={months}
      selectedItem={selectedMonth}
      onSelectItem={onSelectMonth}
    />
  );
}

interface YearModalProps {
  visible: boolean;
  onClose: () => void;
  years: string[];
  selectedYear: string;
  onSelectYear: (year: string) => void;
}

export function YearModal({
  visible,
  onClose,
  years,
  selectedYear,
  onSelectYear,
}: YearModalProps) {
  return (
    <SelectionModal
      visible={visible}
      onClose={onClose}
      title="Selecione o Ano"
      maxHeight="50%"
      items={years}
      selectedItem={selectedYear}
      onSelectItem={onSelectYear}
    />
  );
}

export interface AccountSwitchOption {
  name: string;
  color: string;
}

interface AccountSwitchModalProps {
  visible: boolean;
  onClose: () => void;
  options: AccountSwitchOption[];
  /** null = todas as contas juntas. */
  selectedAccount: string | null;
  onSelect: (account: string | null) => void;
}

const ALL_ACCOUNTS_LABEL = "Todas as contas";

/** Alterna qual conta o painel mostra (Início, Orçamento e Histórico) — ou todas juntas. */
export function AccountSwitchModal({
  visible,
  onClose,
  options,
  selectedAccount,
  onSelect,
}: AccountSwitchModalProps) {
  const { colors } = useTheme();
  const menuStyles = useMenuStyles();
  const items: (AccountSwitchOption | null)[] = [null, ...options];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={menuStyles.modalContainer}>
        <View style={[menuStyles.modalContent, { maxHeight: "60%" }]}>
          <Text style={menuStyles.modalTitle}>Ver conta</Text>
          <ScrollView>
            {items.map((item) => {
              const isSelected = (item?.name ?? null) === selectedAccount;
              return (
                <TouchableOpacity
                  key={item?.name ?? "__all__"}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                  onPress={() => {
                    onSelect(item?.name ?? null);
                    onClose();
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  {item === null ? (
                    <Ionicons name="layers-outline" size={18} color={isSelected ? colors.income : colors.textSecondary} />
                  ) : (
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
                  )}
                  <Text
                    style={{
                      flex: 1,
                      color: isSelected ? colors.income : colors.textPrimary,
                      fontSize: 16,
                      fontWeight: isSelected ? "bold" : "normal",
                    }}
                  >
                    {item?.name ?? ALL_ACCOUNTS_LABEL}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={20} color={colors.income} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={[menuStyles.closeButton, { marginTop: 16 }]} onPress={onClose}>
            <Text style={menuStyles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export interface SortOption<T extends string = string> {
  key: T;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
}

interface SortModalProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  title?: string;
  options: SortOption<T>[];
  selectedKey: T;
  onSelect: (key: T) => void;
}

export function SortModal<T extends string>({
  visible,
  onClose,
  title = "Ordenar por",
  options,
  selectedKey,
  onSelect,
}: SortModalProps<T>) {
  const { colors } = useTheme();
  const menuStyles = useMenuStyles();
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={menuStyles.modalContainer}>
        <View style={[menuStyles.modalContent, { maxHeight: "60%" }]}>
          <Text style={menuStyles.modalTitle}>{title}</Text>
          <ScrollView>
            {options.map((option) => {
              const isSelected = option.key === selectedKey;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                  onPress={() => {
                    onSelect(option.key);
                    onClose();
                  }}
                >
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={isSelected ? colors.income : colors.textSecondary}
                  />
                  <Text
                    style={{
                      flex: 1,
                      color: isSelected ? colors.income : colors.textPrimary,
                      fontSize: 16,
                      fontWeight: isSelected ? "bold" : "normal",
                    }}
                  >
                    {option.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={colors.income} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[menuStyles.closeButton, { marginTop: 16 }]}
            onPress={onClose}
          >
            <Text style={menuStyles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
