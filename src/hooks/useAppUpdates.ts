import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useState } from "react";

import { CHANGELOG, type Release } from "../constants/changelog";
import {
  describeRunningUpdate,
  describeUpdateError,
  latestReleaseId,
  manifestCreatedAt,
  newerReleases,
  releaseNotesFromManifest,
  type RunningUpdateInfo,
} from "../utils/appUpdates";
import { logError } from "../utils/logger";

export type UpdatePhase =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "restarting"
  | "error";

/** Em qual etapa deu erro: define o que "Tentar de novo" refaz. */
type ErrorStep = "check" | "download" | "restart";

export interface AvailableUpdate {
  /** O servidor mandou voltar para a versão de fábrica (sem nada novo para ler). */
  isRollback: boolean;
  publishedAt: Date | null;
  /** O que mudou, só as novidades que este app ainda não tem (vazio se a atualização não trouxe descrição). */
  notes: Release[];
}

const RESTART_FAILED =
  "A atualização foi baixada, mas o app não conseguiu reiniciar sozinho. Feche o app e abra de novo para aplicá-la.";

/**
 * Tela "Atualizações": o que está rodando agora, verificar se há atualização
 * nova (expo-updates), baixar com progresso e reiniciar para aplicar.
 */
export function useAppUpdates() {
  // Só o progresso vem do hook do expo-updates; o resto do fluxo é controlado aqui.
  const { downloadProgress } = Updates.useUpdates();

  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [available, setAvailable] = useState<AvailableUpdate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<ErrorStep | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const info: RunningUpdateInfo = describeRunningUpdate({
    appVersion: Constants.expoConfig?.version ?? null,
    isEnabled: Updates.isEnabled,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId,
    channel: Updates.channel,
    runtimeVersion: Updates.runtimeVersion,
    createdAt: Updates.createdAt,
  });

  const fail = (step: ErrorStep, error: unknown) => {
    logError(`Erro nas atualizações (${step}):`, error);
    setErrorStep(step);
    setErrorMessage(
      step === "restart" ? RESTART_FAILED : describeUpdateError(error, step),
    );
    setPhase("error");
  };

  const check = async () => {
    setErrorMessage(null);
    setPhase("checking");
    try {
      const result = await Updates.checkForUpdateAsync();
      setLastCheckedAt(new Date());

      if (result.isAvailable) {
        setAvailable({
          isRollback: false,
          publishedAt: manifestCreatedAt(result.manifest),
          notes: newerReleases(
            releaseNotesFromManifest(result.manifest),
            latestReleaseId(CHANGELOG),
          ),
        });
        setPhase("available");
      } else if (result.isRollBackToEmbedded) {
        setAvailable({ isRollback: true, publishedAt: null, notes: [] });
        setPhase("available");
      } else {
        setAvailable(null);
        setPhase("up-to-date");
      }
    } catch (error) {
      fail("check", error);
    }
  };

  const restart = async () => {
    setErrorMessage(null);
    setPhase("restarting");
    try {
      await Updates.reloadAsync();
    } catch (error) {
      fail("restart", error);
    }
  };

  /** Baixa a atualização e reinicia o app para aplicá-la. */
  const apply = async () => {
    setErrorMessage(null);
    setPhase("downloading");
    try {
      const result = await Updates.fetchUpdateAsync();
      if (!result.isNew && !result.isRollBackToEmbedded) {
        throw new Error("O download não trouxe uma atualização nova.");
      }
    } catch (error) {
      fail("download", error);
      return;
    }
    await restart();
  };

  const retry = () => {
    if (errorStep === "restart") return restart();
    if (errorStep === "download") return apply();
    return check();
  };

  const isBusy =
    phase === "checking" || phase === "downloading" || phase === "restarting";

  return {
    info,
    /** A novidade mais recente que já está neste app (do changelog embutido no código). */
    installedRelease: CHANGELOG[CHANGELOG.length - 1] ?? null,
    phase,
    available,
    errorMessage,
    lastCheckedAt,
    progress: phase === "downloading" ? downloadProgress : undefined,
    /** No modo de desenvolvimento não há o que verificar. */
    canCheck: info.kind !== "disabled" && !isBusy,
    check,
    apply,
    retry,
  };
}
