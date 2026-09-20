import { Modal, ScrollView, TouchableOpacity, View } from "react-native";
import type { Release } from "../constants/changelog";
import { useMenuStyles } from "../styles/menuStyles";
import { Text, useTheme } from "../theme";

interface ReleaseNotesModalProps {
  /** Novidades ainda não vistas; o pop-up só aparece se houver alguma. */
  releases: Release[];
  onClose: () => void;
}

export function ReleaseNotesModal({ releases, onClose }: ReleaseNotesModalProps) {
  const { colors } = useTheme();
  const menuStyles = useMenuStyles();
  return (
    <Modal
      visible={releases.length > 0}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={menuStyles.modalContainer}>
        <View style={menuStyles.modalContent}>
          <Text style={menuStyles.modalTitle}>O app foi atualizado</Text>

          <ScrollView
            style={{ maxHeight: 340, marginBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {releases.map((release, index) => (
              <View key={release.id} style={{ marginTop: index === 0 ? 0 : 20 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 15,
                    fontWeight: "bold",
                  }}
                >
                  {release.title}
                </Text>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    marginTop: 2,
                    marginBottom: 8,
                  }}
                >
                  {release.date}
                </Text>

                {release.items.map((item) => (
                  <View
                    key={item}
                    style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}
                  >
                    <Text style={{ color: colors.accent, fontSize: 14 }}>•</Text>
                    <Text
                      style={{
                        flex: 1,
                        color: colors.textSecondary,
                        fontSize: 14,
                        lineHeight: 20,
                      }}
                    >
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.textPrimary,
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={onClose}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 16,
                fontWeight: "bold",
              }}
            >
              Entendi
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
