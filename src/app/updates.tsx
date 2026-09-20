import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApkUpdateCard } from "../components/ApkUpdateCard";
import { CHANGELOG, type Release } from "../constants/changelog";
import { useOtaUpdates } from "../hooks/useOtaUpdates";
import { formatDateTime } from "../utils/dates";
import { formatProgress } from "../utils/updates/otaUpdates";
import { Text, makeStyles, useTheme } from "../theme";

function InfoRow({ label, value, selectable = false }: { label: string; value: string; selectable?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable={selectable}>
        {value}
      </Text>
    </View>
  );
}

function ReleaseList({ releases }: { releases: Release[] }) {
  const styles = useStyles();
  return (
    <>
      {releases.map((release) => (
        <View key={release.id} style={styles.release}>
          <Text style={styles.releaseTitle}>{release.title}</Text>
          <Text style={styles.releaseDate}>{release.date}</Text>
          {release.items.map((item) => (
            <Text key={item} style={styles.releaseItem}>
              • {item}
            </Text>
          ))}
        </View>
      ))}
    </>
  );
}

/** Versão em execução, verificar atualização (OTA) e o histórico de novidades. */
export default function UpdatesScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const {
    info,
    installedRelease,
    phase,
    available,
    errorMessage,
    lastCheckedAt,
    progress,
    canCheck,
    check,
    apply,
    retry,
  } = useOtaUpdates();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/dashboard");
  };

  const percent = formatProgress(progress);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Atualizações</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Versão instalada</Text>
          <InfoRow label="Versão do app" value={info.appVersion} />
          <InfoRow label="Tipo" value={info.kindLabel} />
          <InfoRow label="Publicada em" value={formatDateTime(info.publishedAt)} />
          <InfoRow label="Canal" value={info.channel ?? "nenhum"} />
          <InfoRow label="Versão de compatibilidade" value={info.runtimeVersion ?? "nenhuma"} />
          <InfoRow label="ID da atualização" value={info.updateId ?? "nenhum"} selectable />
          {installedRelease && (
            <InfoRow
              label="Última novidade instalada"
              value={`${installedRelease.title} (${installedRelease.date})`}
            />
          )}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !canCheck && styles.buttonDisabled]}
          onPress={check}
          disabled={!canCheck}
        >
          {phase === "checking" ? (
            <ActivityIndicator color={colors.textOnColor} />
          ) : (
            <Text style={styles.primaryButtonText}>Verificar atualização</Text>
          )}
        </TouchableOpacity>
        {lastCheckedAt && (
          <Text style={styles.hint}>Última verificação: {formatDateTime(lastCheckedAt)}</Text>
        )}

        {info.kind === "disabled" && (
          <View style={styles.box}>
            <Text style={styles.boxText}>
              As atualizações só funcionam no app instalado, não no modo de desenvolvimento.
            </Text>
          </View>
        )}

        {phase === "up-to-date" && (
          <View style={[styles.box, styles.boxSuccess]}>
            <Text style={styles.boxTitle}>Você já está atualizado</Text>
            <Text style={styles.boxText}>
              Versão {info.appVersion}, publicada em {formatDateTime(info.publishedAt)}.
            </Text>
          </View>
        )}

        {phase === "available" && available && (
          <View style={[styles.box, styles.boxAccent]}>
            <Text style={styles.boxTitle}>
              {available.isRollback ? "Voltar para a versão de fábrica" : "Nova atualização disponível"}
            </Text>
            {available.isRollback ? (
              <Text style={styles.boxText}>
                O servidor pediu para o app voltar à versão que veio instalada. O app vai reiniciar.
              </Text>
            ) : (
              <>
                <Text style={styles.boxText}>Publicada em {formatDateTime(available.publishedAt)}.</Text>
                {available.notes.length > 0 ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.sectionLabel}>O que muda</Text>
                    <ReleaseList releases={available.notes} />
                  </View>
                ) : (
                  <Text style={[styles.boxText, { marginTop: 8 }]}>
                    Esta atualização não trouxe a lista do que mudou.
                  </Text>
                )}
              </>
            )}
            <TouchableOpacity style={[styles.primaryButton, { marginTop: 12 }]} onPress={apply}>
              <Text style={styles.primaryButtonText}>Baixar e aplicar</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === "downloading" && (
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Baixando a atualização…</Text>
            {progress === undefined ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} />
            ) : (
              <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
                <Text style={styles.boxText}>{percent}</Text>
              </>
            )}
          </View>
        )}

        {phase === "restarting" && (
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Reiniciando o app para aplicar a atualização…</Text>
          </View>
        )}

        {phase === "error" && errorMessage && (
          <View style={[styles.box, styles.boxError]}>
            <Text style={styles.boxTitle}>Algo deu errado</Text>
            <Text style={styles.boxText}>{errorMessage}</Text>
            <TouchableOpacity style={[styles.secondaryButton, { marginTop: 12 }]} onPress={retry}>
              <Text style={styles.secondaryButtonText}>Tentar de novo</Text>
            </TouchableOpacity>
          </View>
        )}

        <ApkUpdateCard currentVersion={info.appVersion} />

        <Text style={styles.sectionTitle}>Histórico de novidades</Text>
        <ReleaseList releases={[...CHANGELOG].reverse()} />
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
  headerTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: "700" },
  content: { padding: 16, paddingBottom: 48 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  infoRow: { marginTop: 8 },
  infoLabel: { color: colors.textMuted, fontSize: 12 },
  infoValue: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: colors.textOnColor, fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  buttonDisabled: { opacity: 0.4 },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 8 },
  box: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boxSuccess: { borderColor: colors.income },
  boxAccent: { borderColor: colors.accent },
  boxError: { borderColor: colors.expense },
  boxTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  boxText: { color: colors.textMuted, fontSize: 14, marginTop: 4, lineHeight: 20 },
  sectionLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 28,
    marginBottom: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: { height: 8, backgroundColor: colors.accent },
  release: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  releaseTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  releaseDate: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  releaseItem: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 2 },
}));
