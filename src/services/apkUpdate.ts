import {
  APK_LATEST_RELEASE_URL,
  ApkUpdateError,
  checkForApkUpdate,
  parseLatestRelease,
  type ApkCheck,
  type ApkRelease,
} from "../utils/apkUpdates";

/** Tudo que a atualização por APK precisa do aparelho e da rede; nos testes vira um faz-de-conta. */
export interface ApkUpdateDeps {
  /** Resposta da API de releases do GitHub: código HTTP e o JSON (null se não veio JSON). */
  fetchLatestRelease(url: string): Promise<{ status: number; json: unknown }>;
  /** Baixa o APK para a pasta temporária do app e devolve o endereço para o instalador e o tamanho gravado. */
  downloadApk(
    url: string,
    onProgress: (written: number, total: number) => void,
    signal: AbortSignal,
  ): Promise<{ contentUri: string; size: number }>;
  removeDownloadedApk(): Promise<void>;
  /** Abre o instalador do Android; resolve quando o usuário volta para o app. */
  installApk(contentUri: string): Promise<void>;
  now(): Date;
}

/** Consulta a release mais recente e diz se há versão nova em relação à instalada. */
export async function checkApkUpdate(deps: ApkUpdateDeps, currentVersion: string): Promise<ApkCheck> {
  const { status, json } = await deps.fetchLatestRelease(APK_LATEST_RELEASE_URL);
  if (status !== 200) throw new ApkUpdateError("http", `HTTP ${status}`, status);

  const release = parseLatestRelease(json);
  if (!release) throw new ApkUpdateError("invalid", "Resposta de release inválida");
  return checkForApkUpdate(currentVersion, release);
}

/**
 * Baixa o APK da release e confere se veio inteiro (o tamanho gravado precisa bater
 * com o anunciado); um arquivo incompleto seria recusado pelo instalador com uma
 * mensagem pouco clara. Devolve o endereço para abrir no instalador.
 */
export async function downloadApkUpdate(
  deps: ApkUpdateDeps,
  release: ApkRelease,
  onProgress: (written: number, total: number) => void,
  signal: AbortSignal,
): Promise<string> {
  await deps.removeDownloadedApk();
  const file = await deps.downloadApk(release.apkUrl, onProgress, signal);
  if (release.size > 0 && file.size !== release.size) {
    await deps.removeDownloadedApk();
    throw new ApkUpdateError("incomplete", `Baixou ${file.size} de ${release.size} bytes`);
  }
  return file.contentUri;
}
