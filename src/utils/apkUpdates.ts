/**
 * Lógica pura da atualização do app por APK (versões novas que mudam a parte
 * nativa e por isso não chegam por OTA): ler a release do GitHub, comparar
 * versões e traduzir erros. Sem rede nem arquivos, para testar sem aparelho.
 *
 * Como o app descobre a versão nova: cada versão é publicada como uma release
 * do repositório (tag "V1.2.0" ou "v1.2.0", com o .apk anexado e o texto do que
 * mudou). O app consulta a release mais recente.
 */

export const APK_REPOSITORY = "Guilherme-demetino/Finance-App";
export const APK_LATEST_RELEASE_URL = `https://api.github.com/repos/${APK_REPOSITORY}/releases/latest`;

/** O que o app precisa saber de uma versão publicada. */
export interface ApkRelease {
  /** "1.2.0" (sem o V da tag). */
  version: string;
  name: string;
  notes: string;
  publishedAt: Date | null;
  /** Endereço de download do .apk. */
  apkUrl: string;
  apkName: string;
  /** Tamanho em bytes, para conferir se o download veio inteiro. */
  size: number;
  /** Página da release no navegador (plano B se a instalação pelo app falhar). */
  pageUrl: string;
}

export type ApkCheck =
  | { status: "up-to-date"; currentVersion: string; latestVersion: string }
  | { status: "available"; release: ApkRelease }
  /** Existe versão mais nova, mas sem .apk anexado (ainda sendo publicada). */
  | { status: "no-apk"; version: string };

type Obj = Record<string, unknown>;

const isObject = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** "V1.2.0", "v1.2" ou "1.2.0" → [1, 2, 0]; null se não for um número de versão. */
export function parseVersion(text: string | null | undefined): number[] | null {
  const match = /^\s*[vV]?(\d+(?:\.\d+){0,2})\s*$/.exec(String(text ?? ""));
  if (!match) return null;
  const parts = match[1].split(".").map(Number);
  while (parts.length < 3) parts.push(0);
  return parts;
}

/** Negativo se a < b, 0 se iguais, positivo se a > b. Não compara se algum não for versão. */
export function compareVersions(a: string, b: string): number | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

// O texto da release vira aviso na tela: sem excesso de linhas em branco e com limite de tamanho.
const MAX_NOTES_LENGTH = 800;

export function cleanNotes(body: unknown): string {
  if (typeof body !== "string") return "";
  const text = body.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text.length > MAX_NOTES_LENGTH ? `${text.slice(0, MAX_NOTES_LENGTH).trimEnd()}…` : text;
}

/**
 * Lê a resposta da API do GitHub para "release mais recente". Devolve null se não
 * for uma release utilizável (formato inesperado, rascunho, pré-lançamento ou tag
 * que não é número de versão). Uma release sem .apk volta com `apkUrl` vazio, para o
 * app poder dizer "publicada, mas o arquivo ainda não foi anexado".
 */
export function parseLatestRelease(json: unknown): ApkRelease | null {
  if (!isObject(json)) return null;
  if (json.draft === true || json.prerelease === true) return null;

  const parsed = parseVersion(typeof json.tag_name === "string" ? json.tag_name : null);
  if (!parsed) return null;

  const assets = Array.isArray(json.assets) ? json.assets : [];
  const apk = assets.find(
    (asset): asset is Obj =>
      isObject(asset) &&
      typeof asset.name === "string" &&
      asset.name.toLowerCase().endsWith(".apk") &&
      typeof asset.browser_download_url === "string" &&
      asset.browser_download_url.startsWith("https://"),
  );

  const published = typeof json.published_at === "string" ? new Date(json.published_at) : null;
  return {
    version: parsed.join("."),
    name: typeof json.name === "string" && json.name.trim() ? json.name.trim() : `Versão ${parsed.join(".")}`,
    notes: cleanNotes(json.body),
    publishedAt: published && !Number.isNaN(published.getTime()) ? published : null,
    apkUrl: apk ? String(apk.browser_download_url) : "",
    apkName: apk ? String(apk.name) : "",
    size: apk && typeof apk.size === "number" && apk.size > 0 ? apk.size : 0,
    pageUrl: typeof json.html_url === "string" ? json.html_url : `https://github.com/${APK_REPOSITORY}/releases`,
  };
}

/** Compara a release mais recente com a versão instalada. */
export function checkForApkUpdate(currentVersion: string, release: ApkRelease): ApkCheck {
  const order = compareVersions(release.version, currentVersion);
  if (order === null || order <= 0) {
    return { status: "up-to-date", currentVersion, latestVersion: release.version };
  }
  if (!release.apkUrl) return { status: "no-apk", version: release.version };
  return { status: "available", release };
}

/** 117713440 → "112,3 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "tamanho desconhecido";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(1).replace(".", ",")} MB`;
}

/** Fração de 0 a 1 do download; undefined quando o servidor não informou o tamanho total. */
export function downloadFraction(written: number, total: number): number | undefined {
  if (!Number.isFinite(total) || total <= 0) return undefined;
  return Math.min(1, Math.max(0, written / total));
}

// ---------------------------------------------------------------------- erros

export type ApkStage = "check" | "download" | "install";

/** Erro com código conhecido, para a tela mostrar a frase certa. */
export class ApkUpdateError extends Error {
  constructor(
    public readonly code: "http" | "invalid" | "incomplete" | "cancelled",
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApkUpdateError";
  }
}

const NETWORK = /network|internet|offline|timeout|timed out|unable to resolve|failed to connect|connection|host/i;
const NO_SPACE = /no space|enospc|not enough space|storage/i;

export function describeApkError(error: unknown, stage: ApkStage): string {
  if (error instanceof ApkUpdateError) {
    if (error.code === "http") {
      if (error.status === 403 || error.status === 429) {
        return "O GitHub limitou as consultas por um tempo. Tente de novo daqui a alguns minutos.";
      }
      if (error.status === 404) {
        return "Ainda não há nenhuma versão publicada para baixar.";
      }
      return `O servidor respondeu com erro (${error.status ?? "desconhecido"}). Tente de novo mais tarde.`;
    }
    if (error.code === "invalid") {
      return "A resposta do servidor não pôde ser lida. Tente de novo mais tarde.";
    }
    if (error.code === "incomplete") {
      return "O download veio incompleto. Verifique a internet e tente de novo.";
    }
    return "Download cancelado.";
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  if (NO_SPACE.test(message)) {
    return "Não há espaço livre suficiente no aparelho para baixar a nova versão.";
  }
  if (stage === "install") {
    return "Não foi possível abrir o instalador do Android. Baixe o arquivo pela página da versão e instale por lá.";
  }
  if (NETWORK.test(message) || message === "" || /fetch/i.test(message)) {
    return stage === "check"
      ? "Sem conexão com a internet. Conecte-se e tente de novo."
      : "O download foi interrompido por falta de conexão. Tente de novo.";
  }
  return stage === "check"
    ? "Não foi possível verificar a nova versão. Tente de novo."
    : "Não foi possível baixar a nova versão. Tente de novo.";
}
