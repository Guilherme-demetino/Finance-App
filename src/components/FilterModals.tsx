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
