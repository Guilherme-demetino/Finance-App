import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import {
  DimensionValue,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { styles as menuStyles } from "../styles/menuStyles";
import { colors } from "../constants/colors";

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
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={menuStyles.overlay}>
        <View
          style={[menuStyles.menuContainer, { height: "auto", maxHeight }]}
        >
          <Text style={[menuStyles.menuTitle, { marginBottom: 16 }]}>
            {title}
          </Text>
          <ScrollView>
            {items.map((item, idx) => (
              <TouchableOpacity
                key={idx}
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
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={menuStyles.overlay}>
        <View style={[menuStyles.menuContainer, { height: "auto", maxHeight: "60%" }]}>
          <Text style={[menuStyles.menuTitle, { marginBottom: 16 }]}>{title}</Text>
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
