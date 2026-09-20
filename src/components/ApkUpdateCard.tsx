import { ActivityIndicator, TouchableOpacity, View } from "react-native";

import { useApkUpdate } from "../hooks/useApkUpdate";
import { makeStyles, Text, useTheme } from "../theme";
import { formatBytes } from "../utils/updates/apkUpdates";
import { formatDateTime } from "../utils/dates";

/**
 * "Nova versão do aplicativo": para versões que mudam a parte nativa do app (e por
 * isso não chegam pelo OTA). Baixa o APK e abre o instalador do Android.
 */
export function ApkUpdateCard({ currentVersion }: { currentVersion: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const {
    phase,
    release,
    latestVersion,
    progress,
    bytes,
    errorMessage,
    lastCheckedAt,
    notice,
    isBusy,
    check,
    download,
    install,
    cancel,
    retry,
    openReleasePage,
  } = useApkUpdate(currentVersion);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Nova versão do aplicativo</Text>
      <Text style={styles.text}>
        Algumas versões mudam partes do app que a atualização comum não alcança. Elas são baixadas como um novo
        arquivo de instalação (APK) e instaladas por cima, mantendo seus dados.
      </Text>

      <TouchableOpacity
        style={[styles.primaryButton, isBusy && styles.disabled]}
        onPress={check}
        disabled={isBusy}
        accessibilityRole="button"
      >
        {phase === "checking" ? (
          <ActivityIndicator color={colors.textOnColor} />
        ) : (
          <Text style={styles.primaryText}>Verificar nova versão do app</Text>
        )}
      </TouchableOpacity>
      {lastCheckedAt && <Text style={styles.hint}>Última verificação: {formatDateTime(lastCheckedAt)}</Text>}

      {phase === "up-to-date" && (
        <View style={[styles.box, styles.boxSuccess]}>
          <Text style={styles.boxTitle}>O aplicativo está na versão mais recente</Text>
          <Text style={styles.text}>
            Instalada: {currentVersion}. Publicada mais recente: {latestVersion}.
          </Text>
        </View>
      )}

      {phase === "no-apk" && (
        <View style={styles.box}>
          <Text style={styles.boxTitle}>Versão {latestVersion} a caminho</Text>
          <Text style={styles.text}>
            A versão foi anunciada, mas o arquivo de instalação ainda não foi anexado. Tente de novo mais tarde.
          </Text>
        </View>
      )}

      {(phase === "available" || phase === "ready" || phase === "installing") && release && (
        <View style={[styles.box, styles.boxAccent]}>
          <Text style={styles.boxTitle}>Nova versão {release.version} disponível</Text>
          <Text style={styles.text}>
            {release.publishedAt ? `Publicada em ${formatDateTime(release.publishedAt)}. ` : ""}
            Arquivo de {formatBytes(release.size)}: prefira uma rede Wi-Fi.
          </Text>
          {release.notes !== "" && <Text style={[styles.text, styles.notes]}>{release.notes}</Text>}
          {notice && <Text style={[styles.text, styles.notice]}>{notice}</Text>}

          {phase === "available" && (
            <TouchableOpacity style={[styles.primaryButton, styles.spaced]} onPress={download} accessibilityRole="button">
              <Text style={styles.primaryText}>Baixar e instalar</Text>
            </TouchableOpacity>
          )}
          {phase === "ready" && (
            <>
              <TouchableOpacity style={[styles.primaryButton, styles.spaced]} onPress={install} accessibilityRole="button">
                <Text style={styles.primaryText}>Instalar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, styles.spaced]} onPress={download} accessibilityRole="button">
                <Text style={styles.secondaryText}>Baixar de novo</Text>
              </TouchableOpacity>
            </>
          )}
          {phase === "installing" && <ActivityIndicator color={colors.accent} style={styles.spaced} />}
          <Text style={styles.hint}>
            O Android vai pedir a sua confirmação para instalar (e, na primeira vez, para permitir instalar por este app).
          </Text>
        </View>
      )}

      {phase === "downloading" && (
        <View style={styles.box}>
          <Text style={styles.boxTitle}>Baixando a nova versão…</Text>
          {progress === undefined ? (
            <ActivityIndicator color={colors.accent} style={styles.spaced} />
          ) : (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          )}
          <Text style={styles.text}>
            {progress === undefined
              ? "Aguarde…"
              : `${Math.round(progress * 100)}% (${formatBytes(bytes?.written ?? 0)} de ${formatBytes(bytes?.total ?? 0)})`}
          </Text>
          <TouchableOpacity style={[styles.secondaryButton, styles.spaced]} onPress={cancel} accessibilityRole="button">
            <Text style={styles.secondaryText}>Cancelar download</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === "error" && errorMessage && (
        <View style={[styles.box, styles.boxError]}>
          <Text style={styles.boxTitle}>Algo deu errado</Text>
          <Text style={styles.text}>{errorMessage}</Text>
          <TouchableOpacity style={[styles.secondaryButton, styles.spaced]} onPress={retry} accessibilityRole="button">
            <Text style={styles.secondaryText}>Tentar de novo</Text>
          </TouchableOpacity>
          {release && (
            <TouchableOpacity
              style={[styles.secondaryButton, styles.spaced]}
              onPress={openReleasePage}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Abrir a página da versão</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: 4 },
  text: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 8 },
  notes: { color: colors.textSecondary },
  notice: { color: colors.textPrimary, fontWeight: "600" },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: colors.textOnColor, fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  spaced: { marginTop: 12 },
  disabled: { opacity: 0.4 },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 8 },
  box: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boxSuccess: { borderColor: colors.income },
  boxAccent: { borderColor: colors.accent },
  boxError: { borderColor: colors.expense },
  boxTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    marginTop: 12,
    marginBottom: 4,
    overflow: "hidden",
  },
  fill: { height: 8, backgroundColor: colors.accent },
}));
