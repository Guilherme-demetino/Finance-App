import { Modal, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface LandscapePanoramaModalProps {
  visible: boolean;
  selectedYear: string;
  totalIncome: number;
  totalExpense: number;
  monthsData: Array<{ label: string; income: number; expense: number }>;
  onClose: () => void;
}

export function LandscapePanoramaModal({
  visible,
  selectedYear,
  totalIncome,
  totalExpense,
  monthsData,
  onClose,
}: LandscapePanoramaModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#121212",
          padding: 20,
          justifyContent: "center",
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
          <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "bold" }}>
            TENDÊNCIA ANUAL ({selectedYear})
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: "#2A2A2A",
              borderWidth: 1,
              borderColor: "#FFFFFF",
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 8,
            }}
            onPress={onClose}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "bold" }}>Fechar</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            backgroundColor: "#1E1E1E",
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: "#333333",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <View>
              <Text
                style={{ color: "#10B981", fontSize: 14, fontWeight: "bold" }}
              >
                + R$ {totalIncome.toFixed(2).replace(".", ",")}
              </Text>
              <Text
                style={{ color: "#EF4444", fontSize: 14, fontWeight: "bold" }}
              >
                - R$ {totalExpense.toFixed(2).replace(".", ",")}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#10B981",
                  }}
                />
                <Text style={{ color: "#A1A1AA", fontSize: 10 }}>RECEITAS</Text>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#EF4444",
                  }}
                />
                <Text style={{ color: "#A1A1AA", fontSize: 10 }}>DESPESAS</Text>
              </View>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
              height: 160,
              borderBottomWidth: 1,
              borderBottomColor: "#333333",
              paddingBottom: 4,
            }}
          >
            {monthsData.map((m, index) => {
              const incomeHeight = m.income > 0 ? 110 : 4;
              const expenseHeight = m.expense > 0 ? 45 : 4;
              return (
                <View key={index} style={{ alignItems: "center", flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      height: 120,
                      gap: 3,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: incomeHeight,
                        backgroundColor: m.income > 0 ? "#10B981" : "#222222",
                        borderRadius: 3,
                      }}
                    />
                    <View
                      style={{
                        width: 6,
                        height: expenseHeight,
                        backgroundColor: m.expense > 0 ? "#EF4444" : "#222222",
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  <Text
                    style={{ color: "#A1A1AA", fontSize: 10, marginTop: 6 }}
                  >
                    {m.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
