import type { ApkUpdateDeps } from "../services/apkUpdate";

export const FAKE_APK_SIZE = 1000;

export const githubRelease = (over: Record<string, unknown> = {}) => ({
  tag_name: "V1.1.0",
  name: "Finance 1.1.0",
  body: "Lembretes de vencimento e atualização pelo app.",
  draft: false,
  prerelease: false,
  published_at: "2026-09-20T12:00:00Z",
  html_url: "https://github.com/Guilherme-demetino/Finance-App/releases/tag/V1.1.0",
  assets: [{ name: "Finance.apk", size: FAKE_APK_SIZE, browser_download_url: "https://github.com/x/Finance.apk" }],
  ...over,
});

/**
 * Rede, arquivo e instalador de mentira. Cada parte pode ser trocada no teste
 * (`state.response`, `state.downloadSize`, `state.installError` ...).
 */
export function createFakeApkDeps() {
  const state = {
    response: { status: 200, json: githubRelease() as unknown } as { status: number; json: unknown } | Error,
    downloadSize: FAKE_APK_SIZE,
    downloadError: null as Error | null,
    /** Quando definido, o download só termina quando o teste chamar `finishDownload()`. */
    holdDownload: false,
    installError: null as Error | null,
    fetched: [] as string[],
    downloaded: [] as string[],
    removed: 0,
    installed: [] as string[],
    finishDownload: () => {},
  };

  const deps: ApkUpdateDeps = {
    async fetchLatestRelease(url) {
      state.fetched.push(url);
      if (state.response instanceof Error) throw state.response;
      return state.response;
    },
    async downloadApk(url, onProgress, signal) {
      state.downloaded.push(url);
      onProgress(250, FAKE_APK_SIZE);
      if (state.holdDownload) {
        await new Promise<void>((resolve, reject) => {
          state.finishDownload = resolve;
          signal.addEventListener("abort", () => reject(new Error("AbortError")));
        });
      }
      if (state.downloadError) throw state.downloadError;
      onProgress(state.downloadSize, FAKE_APK_SIZE);
      return { contentUri: "content://app.fileprovider/cache/Finance-update.apk", size: state.downloadSize };
    },
    async removeDownloadedApk() {
      state.removed += 1;
    },
    async installApk(contentUri) {
      state.installed.push(contentUri);
      if (state.installError) throw state.installError;
    },
    now: () => new Date(2026, 8, 20, 15, 30),
  };

  return { deps, state };
}
