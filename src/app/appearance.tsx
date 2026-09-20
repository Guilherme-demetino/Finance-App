import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, Switch, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  DEFAULT_PREFERENCES,
  FONT_SCALE_OPTIONS,
  makeStyles,
  Text,
  useTheme,
  useThemeActions,
  type ThemeMode,
} from "../theme";

const MODE_OPTIONS: { value: ThemeMode; label: string; hint: string }[] = [
  { value: "dark", label: "Escuro", hint: "Fundo escuro, o visual de sempre do app." },
  { value: "light", label: "Claro", hint: "Fundo claro, bom para ambientes iluminados." },
  { value: "system", label: "Automático", hint: "Segue o tema do Android (escuro ou claro)." },
];

/** Tema, alto contraste e tamanho da letra. Cada mudança vale na hora e fica salva. */
export default function AppearanceScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { colors, mode, highContrast, fontScale } = useTheme();
  const { setMode, setHighContrast, setFontScale } = useThemeActions();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/dashboard");
  };

  const reset = () => {
    setMode(DEFAULT_PREFERENCES.mode);
    setHighContrast(DEFAULT_PREFERENCES.highContrast);
    setFontScale(DEFAULT_PREFERENCES.fontScale);
  };

  const isDefault =
    mode === DEFAULT_PREFERENCES.mode &&
    highContrast === DEFAULT_PREFERENCES.highContrast &&
    fontScale === DEFAULT_PREFERENCES.fontScale;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Aparência e acessibilidade
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tema</Text>
          {MODE_OPTIONS.map((option) => {
            const selected = mode === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setMode(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Tema ${option.label}. ${option.hint}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionHint}>{option.hint}</Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.cardTitle}>Alto contraste</Text>
              <Text style={styles.optionHint}>
                Cores mais fortes, texto mais nítido e bordas mais visíveis, no tema escuro ou no claro.
              </Text>
            </View>
            <Switch
              value={highContrast}
              onValueChange={setHighContrast}
              trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
              thumbColor={colors.textPrimary}
              accessibilityLabel="Alto contraste"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tamanho da letra</Text>
          <View style={styles.scaleRow}>
            {FONT_SCALE_OPTIONS.map((option) => {
              const selected = fontScale === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.scaleButton, selected && styles.optionSelected]}
                  onPress={() => setFontScale(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Tamanho da letra ${option.label}`}
                >
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionHint}>{Math.round(option.value * 100)}%</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.optionHint, { marginTop: 10 }]}>
            Soma-se ao tamanho de letra definido nas configurações do Android.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pré-visualização</Text>
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>Saldo do mês</Text>
            <Text style={styles.previewText}>Assim os textos aparecem no app.</Text>
            <View style={styles.previewRow}>
              <Text style={[styles.previewValue, { color: colors.income }]}>+ R$ 1.500,00</Text>
              <Text style={[styles.previewValue, { color: colors.expense }]}>- R$ 350,50</Text>
            </View>
            <View style={styles.previewButton}>
              <Text style={styles.previewButtonText}>Botão de exemplo</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.resetButton, isDefault && styles.resetDisabled]}
          onPress={reset}
          disabled={isDefault}
          accessibilityRole="button"
        >
          <Text style={styles.resetText}>Restaurar padrão</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 8, marginRight: 8 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  content: { padding: 16, paddingBottom: 48 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "700", marginBottom: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: `${colors.accent}26` },
  optionLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  optionHint: { color: colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  switchRow: { flexDirection: "row", alignItems: "center" },
  scaleRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  scaleButton: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
  },
  preview: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  previewText: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  previewRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  previewValue: { fontSize: 15, fontWeight: "700" },
  previewButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12,
  },
  previewButtonText: { color: colors.textOnColor, fontSize: 15, fontWeight: "700" },
  resetButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetDisabled: { opacity: 0.4 },
  resetText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
}));
