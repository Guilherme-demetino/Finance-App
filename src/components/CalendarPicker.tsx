import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const buildMonthGrid = (viewDate: Date): (Date | null)[] => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  return cells;
};

interface CalendarPickerProps {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onSelect: (date: Date) => void;
  accentColor?: string;
}

export function CalendarPicker({
  visible,
  value,
  onClose,
  onSelect,
  accentColor = "#10B981",
}: CalendarPickerProps) {
  const [viewDate, setViewDate] = useState(
    new Date(value.getFullYear(), value.getMonth(), 1),
  );

  const today = new Date();
  const cells = buildMonthGrid(viewDate);

  const goToPreviousMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            backgroundColor: "#1E1E1E",
            borderRadius: 24,
            padding: 20,
            width: "88%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <Text
              style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "bold" }}
            >
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#888" />
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <TouchableOpacity
              onPress={goToPreviousMonth}
              style={{
                backgroundColor: "#2A2A2A",
                borderRadius: 8,
                padding: 8,
              }}
            >
              <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={{ flexDirection: "row", flex: 1 }}>
              {WEEKDAYS.map((label, index) => (
                <View key={index} style={{ flex: 1, alignItems: "center" }}>
                  <Text
                    style={{ color: "#888", fontSize: 12, fontWeight: "bold" }}
                  >
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={goToNextMonth}
              style={{
                backgroundColor: "#2A2A2A",
                borderRadius: 8,
                padding: 8,
              }}
            >
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {cells.map((date, index) => {
              if (!date) {
                return (
                  <View
                    key={index}
                    style={{ width: `${100 / 7}%`, aspectRatio: 1 }}
                  />
                );
              }

              const isSelected = isSameDay(date, value);
              const isToday = isSameDay(date, today);

              return (
                <View
                  key={index}
                  style={{
                    width: `${100 / 7}%`,
                    aspectRatio: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <TouchableOpacity
                    onPress={() => onSelect(date)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSelected
                        ? accentColor
                        : "transparent",
                      borderWidth: !isSelected && isToday ? 1 : 0,
                      borderColor: accentColor,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? "#1E1E1E" : "#FFFFFF",
                        fontWeight: isSelected || isToday ? "bold" : "normal",
                        fontSize: 13,
                      }}
                    >
                      {date.getDate()}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
