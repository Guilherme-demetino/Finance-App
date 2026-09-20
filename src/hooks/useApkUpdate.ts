import { useRef, useState } from "react";
import { Linking } from "react-native";

import { checkApkUpdate, downloadApkUpdate, type ApkUpdateDeps } from "../services/apkUpdate";
import { realApkUpdateDeps } from "../services/apkUpdateDeps";
import {
  describeApkError,
  downloadFraction,
  type ApkRelease,
  type ApkStage,
} from "../utils/apkUpdates";
import { logError } from "../utils/logger";

export type ApkPhase =
  | "idle"
  | "checking"
  | "up-to-date"
  /** Há versão mais nova, mas o arquivo ainda não foi anexado à release. */
  | "no-apk"
  | "available"
  | "downloading"
  /** Baixado, esperando o usuário instalar (ou voltou do instalador sem instalar). */
  | "ready"
  | "installing"
  | "error";

/**
 * Atualização do app por APK (versões que mudam a parte nativa): consulta a release
 * mais recente, baixa o arquivo, e abre o instalador do Android. O usuário ainda
 * confirma a instalação na tela do sistema (e, na primeira vez, permite instalar
 * por este app).
 */
export function useApkUpdate(currentVersion: string, deps: ApkUpdateDeps = realApkUpdateDeps) {
  const [phase, setPhase] = useState<ApkPhase>("idle");
  const [release, setRelease] = useState<ApkRelease | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [bytes, setBytes] = useState<{ written: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedStage, setFailedStage] = useState<ApkStage | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const controller = useRef<AbortController | null>(null);
  const downloadedUri = useRef<string | null>(null);

  const fail = (error: unknown, stage: ApkStage) => {
    logError("Erro na atualização do app:", error);
    setErrorMessage(describeApkError(error, stage));
    setFailedStage(stage);
    setPhase("error");
  };

  const check = async () => {
    setPhase("checking");
    setErrorMessage(null);
    setNotice(null);
    downloadedUri.current = null;
    try {
      const result = await checkApkUpdate(deps, currentVersion);
      setLastCheckedAt(deps.now());
      if (result.status === "available") {
        setRelease(result.release);
        setLatestVersion(result.release.version);
        setPhase("available");
      } else if (result.status === "no-apk") {
        setLatestVersion(result.version);
        setPhase("no-apk");
      } else {
        setLatestVersion(result.latestVersion);
        setPhase("up-to-date");
      }
    } catch (error) {
      fail(error, "check");
    }
  };

  const install = async () => {
    const uri = downloadedUri.current;
    if (uri === null) return;
    setPhase("installing");
    setNotice(null);
    try {
      await deps.installApk(uri);
      // Se a instalação deu certo o Android fecha o app antes daqui; chegar aqui é o usuário ter voltado sem instalar.
      setNotice("A instalação não foi concluída. Toque em Instalar para tentar de novo.");
      setPhase("ready");
    } catch (error) {
      fail(error, "install");
    }
  };

  const download = async () => {
    if (release === null) return;
    const abort = new AbortController();
    controller.current = abort;
    setPhase("downloading");
    setProgress(undefined);
    setBytes(null);
    setErrorMessage(null);
    setNotice(null);

    try {
      downloadedUri.current = await downloadApkUpdate(
        deps,
        release,
        (written, total) => {
          setBytes({ written, total });
          setProgress(downloadFraction(written, total));
        },
        abort.signal,
      );
    } catch (error) {
      if (abort.signal.aborted) {
        setNotice("Download cancelado.");
        setPhase("available");
      } else {
        fail(error, "download");
      }
      return;
    } finally {
      controller.current = null;
    }
    await install();
  };

  const cancel = () => controller.current?.abort();

  const retry = () => {
    if (failedStage === "check") return check();
    if (failedStage === "install" && downloadedUri.current !== null) return install();
    return download();
  };

  const openReleasePage = () => {
    if (release === null) return;
    Linking.openURL(release.pageUrl).catch((error) => logError("Erro ao abrir a página da versão:", error));
  };

  return {
    phase,
    release,
    latestVersion,
    progress,
    bytes,
    errorMessage,
    failedStage,
    lastCheckedAt,
    notice,
    isBusy: phase === "checking" || phase === "downloading" || phase === "installing",
    check,
    download,
    install,
    cancel,
    retry,
    openReleasePage,
  };
}
