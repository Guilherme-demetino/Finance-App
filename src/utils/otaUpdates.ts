import type { Release } from "../constants/changelog";

/**
 * Lógica pura da tela "Atualizações": descrever a versão em execução, ler as
 * novidades que vêm no manifesto de uma atualização e traduzir erros. Sem
 * nenhuma dependência do expo-updates, para poder ser testada sem aparelho.
 */

export type UpdateKind = "ota" | "embedded" | "disabled";

export interface RunningUpdateInput {
  appVersion: string | null;
  /** false no modo de desenvolvimento e no Expo Go. */
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  updateId: string | null;
  channel: string | null;
  runtimeVersion: string | null;
  createdAt: Date | null;
}

export interface RunningUpdateInfo {
  appVersion: string;
  kind: UpdateKind;
  kindLabel: string;
  updateId: string | null;
  channel: string | null;
  runtimeVersion: string | null;
  publishedAt: Date | null;
}

const KIND_LABELS: Record<UpdateKind, string> = {
  ota: "Atualização OTA (baixada pelo app)",
  embedded: "Versão de fábrica (instalada com o APK)",
  disabled: "Modo de desenvolvimento (atualizações desativadas)",
};

export function describeRunningUpdate(input: RunningUpdateInput): RunningUpdateInfo {
  const kind: UpdateKind = !input.isEnabled
    ? "disabled"
    : input.isEmbeddedLaunch
      ? "embedded"
      : "ota";

  return {
    appVersion: input.appVersion ?? "desconhecida",
    kind,
    kindLabel: KIND_LABELS[kind],
    updateId: input.updateId,
    channel: input.channel,
    runtimeVersion: input.runtimeVersion,
    publishedAt: input.createdAt,
  };
}

/** Só o começo do identificador (ele tem 36 caracteres); a tela mostra o completo em texto selecionável. */
export function shortenId(id: string | null): string {
  if (!id) return "nenhum";
  return id.length > 13 ? `${id.slice(0, 8)}…` : id;
}

// ------------------------------------------------------------------ manifesto

type Obj = Record<string, unknown>;

const isObject = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isRelease(value: unknown): value is Release {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "number" &&
    Number.isFinite(value.id) &&
    typeof value.date === "string" &&
    typeof value.title === "string" &&
    Array.isArray(value.items) &&
    value.items.every((item) => typeof item === "string")
  );
}

/** Lê uma lista de novidades de um dado que não é confiável; o que não tiver o formato certo é ignorado. */
export function parseReleaseNotes(value: unknown): Release[] {
  return Array.isArray(value) ? value.filter(isRelease) : [];
}

/** As novidades que o app.config.js embutiu no manifesto de uma atualização (ver app.config.js). */
export function releaseNotesFromManifest(manifest: unknown): Release[] {
  if (!isObject(manifest) || !isObject(manifest.extra)) return [];
  const expoClient = manifest.extra.expoClient;
  if (!isObject(expoClient) || !isObject(expoClient.extra)) return [];
  return parseReleaseNotes(expoClient.extra.releaseNotes);
}

/** Quando a atualização foi criada: `createdAt` (texto ISO) nas de OTA e `commitTime` (ms) na versão de fábrica. */
export function manifestCreatedAt(manifest: unknown): Date | null {
  if (!isObject(manifest)) return null;

  const raw =
    typeof manifest.createdAt === "string"
      ? manifest.createdAt
      : typeof manifest.commitTime === "number"
        ? manifest.commitTime
        : null;
  if (raw === null) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Maior id do changelog (0 se estiver vazio). */
export function latestReleaseId(changelog: Release[]): number {
  return changelog.reduce((max, release) => Math.max(max, release.id), 0);
}

/** Novidades de uma atualização que este app ainda não tem, da mais nova para a mais antiga. */
export function newerReleases(notes: Release[], installedLatestId: number): Release[] {
  return notes
    .filter((release) => release.id > installedLatestId)
    .sort((a, b) => b.id - a.id);
}

// -------------------------------------------------------------------- erros

const NETWORK_ERROR =
  /network|internet|offline|unable to resolve|failed to connect|connection|timed? ?out|timeout|enotfound|econn|socket|unreachable|no route/i;
const RATE_LIMIT = /rate.?limit|too many requests|\b429\b/i;
const NOT_INSTALLED = /development|expo go|not supported|disabled|not enabled/i;

/** Mensagem em português para o que o expo-updates devolveu ao verificar ou baixar. */
export function describeUpdateError(error: unknown, step: "check" | "download"): string {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  if (NETWORK_ERROR.test(message)) {
    return "Sem conexão com a internet. Confira sua rede e tente de novo.";
  }
  if (RATE_LIMIT.test(message)) {
    return "Muitas verificações seguidas. Espere alguns minutos e tente de novo.";
  }
  if (NOT_INSTALLED.test(message)) {
    return "Atualizações só funcionam no app instalado, não no modo de desenvolvimento.";
  }
  return step === "check"
    ? "Não foi possível verificar se há atualização. Tente de novo mais tarde."
    : "Não foi possível baixar a atualização. Tente de novo mais tarde.";
}

/** "42%" a partir do progresso de 0 a 1, ou null se o sistema ainda não informou. */
export function formatProgress(progress: number | undefined): string | null {
  if (typeof progress !== "number" || !Number.isFinite(progress)) return null;
  return `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
}
