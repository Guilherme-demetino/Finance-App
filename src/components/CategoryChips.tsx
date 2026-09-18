import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/colors";

interface CategoryChipsProps {
  options: string[];
  selected: string;
  onSelect: (category: string) => void;
  accentColor: string;
}

export function CategoryChips({
  options,
  selected,
  onSelect,
  accentColor,
}: CategoryChipsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {options.map((option) => {
          const isSelected = option === selected;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onSelect(option)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isSelected ? accentColor : colors.surfaceAlt,
                backgroundColor: isSelected
                  ? `${accentColor}26`
                  : colors.surfaceAlt,
              }}
            >
              <Text
                style={{
                  color: isSelected ? accentColor : colors.textMuted,
                  fontWeight: "bold",
                  fontSize: 13,
                }}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
