import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { styles as menuStyles } from "../app/../styles/menuStyles";

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
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={menuStyles.overlay}>
        <View
          style={[
            menuStyles.menuContainer,
            { height: "auto", maxHeight: "70%" },
          ]}
        >
          <Text style={[menuStyles.menuTitle, { marginBottom: 16 }]}>
            Selecione o Mês
          </Text>
          <ScrollView>
            {months.map((month, idx) => (
              <TouchableOpacity
                key={idx}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "#333333",
                  alignItems: "center",
                }}
                onPress={() => {
                  onSelectMonth(month);
                  onClose();
                }}
              >
                <Text
                  style={{
                    color: selectedMonth === month ? "#10B981" : "#FFFFFF",
                    fontSize: 16,
                    fontWeight: selectedMonth === month ? "bold" : "normal",
                  }}
                >
                  {month}
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
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={menuStyles.overlay}>
        <View
          style={[
            menuStyles.menuContainer,
            { height: "auto", maxHeight: "50%" },
          ]}
        >
          <Text style={[menuStyles.menuTitle, { marginBottom: 16 }]}>
            Selecione o Ano
          </Text>
          <ScrollView>
            {years.map((year, idx) => (
              <TouchableOpacity
                key={idx}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "#333333",
                  alignItems: "center",
                }}
                onPress={() => {
                  onSelectYear(year);
                  onClose();
                }}
              >
                <Text
                  style={{
                    color: selectedYear === year ? "#10B981" : "#FFFFFF",
                    fontSize: 16,
                    fontWeight: selectedYear === year ? "bold" : "normal",
                  }}
                >
                  {year}
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
