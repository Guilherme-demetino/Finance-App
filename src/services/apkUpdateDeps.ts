import { File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";

import type { ApkUpdateDeps } from "./apkUpdate";

const APK_FILE_NAME = "Finance-update.apk";
const APK_MIME_TYPE = "application/vnd.android.package-archive";
// Intent.FLAG_GRANT_READ_URI_PERMISSION: deixa o instalador do Android ler o arquivo do app.
const FLAG_GRANT_READ_URI_PERMISSION = 1;

const apkFile = () => new File(Paths.cache, APK_FILE_NAME);

/** As dependências de verdade: fetch, pasta temporária do app (expo-file-system) e o instalador do Android. */
export const realApkUpdateDeps: ApkUpdateDeps = {
  async fetchLatestRelease(url) {
    const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      // Sem JSON (ex.: página de erro): quem chama trata pelo código HTTP.
    }
    return { status: response.status, json };
  },

  async downloadApk(url, onProgress, signal) {
    const destination = apkFile();
    if (destination.exists) destination.delete();
    const downloaded = await File.downloadFileAsync(url, destination, {
      idempotent: true,
      signal,
      onProgress: ({ bytesWritten, totalBytes }) => onProgress(bytesWritten, totalBytes),
    });
    return { contentUri: downloaded.contentUri, size: downloaded.size };
  },

  async removeDownloadedApk() {
    const file = apkFile();
    if (file.exists) file.delete();
  },

  async installApk(contentUri) {
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
      type: APK_MIME_TYPE,
    });
  },

  now: () => new Date(),
};
