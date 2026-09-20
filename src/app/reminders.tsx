import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, Switch, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDueReminders } from "../hooks/useDueReminders";
import { makeStyles, Text, useTheme } from "../theme";
import {
  DAYS_BEFORE_OPTIONS,
  formatReminderTime,
  HOUR_OPTIONS,
  reminderDaysLabel,
  reminderHourLabel,
} from "../utils/dueReminders";

// Quantos dos próximos avisos aparecem na tela.
const UPCOMING_SHOWN = 5;

/** Lembretes de contas a vencer: liga/desliga, antecedência, horário, próximos avisos e um teste. */
export default function RemindersScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { snapshot, isBusy, notice, setEnabled, setDaysBefore, setHour, sendTest, openSystemSettings } =
    useDueReminders();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/dashboard");
  };

  const enabled = snapshot?.settings.enabled ?? false;
  // Ligado no app, mas o Android bloqueou as notificações: nada chega até liberar.
  const blocked = enabled && snapshot !== null && !snapshot.permission.granted;

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
          Lembretes de vencimento
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.cardTitle}>Avisar antes de vencer</Text>
              <Text style={styles.hint}>
                Uma notificação neste aparelho antes do vencimento de uma dívida, de uma parcela ou de uma despesa
                recorrente. Funciona sem internet.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              disabled={snapshot === null || isBusy}
              trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
              thumbColor={colors.textPrimary}
              accessibilityLabel="Avisar antes de vencer"
            />
          </View>
        </View>

        {notice !== null && (
          <View style={styles.noticeBox} accessibilityRole="alert">
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}

        {blocked && (
          <View style={styles.noticeBox} accessibilityRole="alert">
            <Text style={styles.noticeText}>
              As notificações estão bloqueadas para o app no Android, então nenhum lembrete chega.
            </Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={openSystemSettings}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Abrir configurações do Android</Text>
            </TouchableOpacity>
          </View>
        )}

        {snapshot !== null && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quando avisar</Text>
              <View style={styles.chipRow}>
                {DAYS_BEFORE_OPTIONS.map((days) => {
                  const selected = snapshot.settings.daysBefore === days;
                  return (
                    <TouchableOpacity
                      key={days}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setDaysBefore(days)}
                      disabled={isBusy}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Avisar ${reminderDaysLabel(days)}`}
                    >
                      <Text style={styles.chipText}>{reminderDaysLabel(days)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.cardTitle, styles.subTitle]}>Horário</Text>
              <View style={styles.chipRow}>
                {HOUR_OPTIONS.map((hour) => {
                  const selected = snapshot.settings.hour === hour;
                  return (
                    <TouchableOpacity
                      key={hour}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setHour(hour)}
                      disabled={isBusy}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Avisar às ${reminderHourLabel(hour)}`}
                    >
                      <Text style={styles.chipText}>{reminderHourLabel(hour)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.hint, styles.hintSpaced]}>
                Se o horário de aviso de uma conta já passou, o aviso vem no dia do vencimento. Contas já vencidas
                aparecem só nos avisos do Início.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Próximos avisos</Text>
              {snapshot.upcoming.length === 0 ? (
                <Text style={styles.hint}>
                  Nenhuma conta a vencer nos próximos 60 dias. Cadastre uma dívida com data de vencimento, uma
                  compra parcelada ou uma despesa recorrente.
                </Text>
              ) : (
                snapshot.upcoming.slice(0, UPCOMING_SHOWN).map((reminder) => (
                  <View key={reminder.id} style={styles.upcomingRow}>
                    <Text style={styles.upcomingWhen}>{formatReminderTime(reminder.fireAt)}</Text>
                    <Text style={styles.upcomingTitle}>{reminder.title}</Text>
                  </View>
                ))
              )}
              {snapshot.upcoming.length > UPCOMING_SHOWN && (
                <Text style={[styles.hint, styles.hintSpaced]}>
                  e mais {snapshot.upcoming.length - UPCOMING_SHOWN} aviso
                  {snapshot.upcoming.length - UPCOMING_SHOWN === 1 ? "" : "s"}
                </Text>
              )}
              {!enabled && snapshot.upcoming.length > 0 && (
                <Text style={[styles.hint, styles.hintSpaced]}>
                  Ligue &quot;Avisar antes de vencer&quot; para receber esses avisos.
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.secondaryButton, isBusy && styles.disabled]}
              onPress={sendTest}
              disabled={isBusy}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Enviar notificação de teste</Text>
            </TouchableOpacity>
          </>
        )}
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
  subTitle: { marginTop: 16 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  hintSpaced: { marginTop: 10 },
  switchRow: { flexDirection: "row", alignItems: "center" },
  switchText: { flex: 1, paddingRight: 12 },
  noticeBox: {
    backgroundColor: `${colors.expense}26`,
    borderColor: colors.expense,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
    minHeight: 44,
    justifyContent: "center",
  },
  chipSelected: { borderColor: colors.accent, backgroundColor: `${colors.accent}26` },
  chipText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  upcomingRow: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  upcomingWhen: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  upcomingTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "600", marginTop: 2 },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  secondaryText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.4 },
}));
