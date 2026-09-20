import * as IntentLauncher from "expo-intent-launcher";

import { realApkUpdateDeps } from "./apkUpdateDeps";

const mockFiles = {
  exists: false,
  deleted: 0,
  download: jest.fn(),
};

jest.mock("expo-file-system", () => {
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map(String).join("/");
    }
    get exists() {
      return mockFiles.exists;
    }
    delete() {
      mockFiles.deleted += 1;
      mockFiles.exists = false;
    }
    static downloadFileAsync(...args: unknown[]) {
      return mockFiles.download(...args);
    }
  }
  return { File, Paths: { cache: "cache" } };
});

const startActivity = IntentLauncher.startActivityAsync as unknown as jest.Mock;

beforeEach(() => {
  mockFiles.exists = false;
  mockFiles.deleted = 0;
  mockFiles.download.mockReset();
  startActivity.mockClear();
  jest.restoreAllMocks();
});

describe("atualização por APK: dependências reais", () => {
  it("abre o instalador do Android com o arquivo, o tipo APK e a permissão de leitura", async () => {
    await realApkUpdateDeps.installApk("content://app.FileSystemFileProvider/cached_expo_files/Finance-update.apk");

    expect(startActivity).toHaveBeenCalledWith("android.intent.action.VIEW", {
      data: "content://app.FileSystemFileProvider/cached_expo_files/Finance-update.apk",
      flags: 1,
      type: "application/vnd.android.package-archive",
    });
  });

  it("baixa para a pasta temporária, repassa o progresso e devolve o endereço do instalador", async () => {
    mockFiles.exists = true;
    mockFiles.download.mockImplementation(async (_url, _dest, options) => {
      options.onProgress({ bytesWritten: 500, totalBytes: 1000 });
      return { contentUri: "content://x/Finance-update.apk", size: 1000 };
    });
    const progress: [number, number][] = [];
    const signal = new AbortController().signal;

    const result = await realApkUpdateDeps.downloadApk("https://github.com/x/Finance.apk", (w, t) => progress.push([w, t]), signal);

    expect(result).toEqual({ contentUri: "content://x/Finance-update.apk", size: 1000 });
    expect(progress).toEqual([[500, 1000]]);
    // Apagou o arquivo antigo e pediu para sobrescrever, com o sinal de cancelamento.
    expect(mockFiles.deleted).toBe(1);
    const [url, destination, options] = mockFiles.download.mock.calls[0];
    expect(url).toBe("https://github.com/x/Finance.apk");
    expect(destination.uri).toBe("cache/Finance-update.apk");
    expect(options).toMatchObject({ idempotent: true, signal });
  });

  it("remove o arquivo baixado só se ele existir", async () => {
    await realApkUpdateDeps.removeDownloadedApk();
    expect(mockFiles.deleted).toBe(0);

    mockFiles.exists = true;
    await realApkUpdateDeps.removeDownloadedApk();
    expect(mockFiles.deleted).toBe(1);
  });

  it("consulta a API do GitHub pedindo JSON e devolve o código e o corpo", async () => {
    const fetchMock = jest.fn(async () => ({ status: 200, json: async () => ({ tag_name: "V1.1.0" }) }));
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as unknown as typeof fetch);

    await expect(realApkUpdateDeps.fetchLatestRelease("https://api.github.com/x")).resolves.toEqual({
      status: 200,
      json: { tag_name: "V1.1.0" },
    });
    expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/x", {
      headers: { Accept: "application/vnd.github+json" },
    });
  });

  it("resposta sem JSON (página de erro) não estoura: volta o código e corpo nulo", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    } as unknown as Response);

    await expect(realApkUpdateDeps.fetchLatestRelease("https://api.github.com/x")).resolves.toEqual({
      status: 502,
      json: null,
    });
  });
});
