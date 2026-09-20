import { createFakeApkDeps, FAKE_APK_SIZE, githubRelease } from "../test/fakeApkUpdateDeps";
import { ApkUpdateError, parseLatestRelease } from "../utils/apkUpdates";
import { checkApkUpdate, downloadApkUpdate } from "./apkUpdate";

describe("checkApkUpdate", () => {
  it("consulta a release mais recente do repositório e acha a versão nova", async () => {
    const { deps, state } = createFakeApkDeps();

    const result = await checkApkUpdate(deps, "1.0.0");

    expect(state.fetched).toEqual(["https://api.github.com/repos/Guilherme-demetino/Finance-App/releases/latest"]);
    expect(result).toMatchObject({ status: "available", release: { version: "1.1.0", size: FAKE_APK_SIZE } });
  });

  it("já na versão publicada: atualizado", async () => {
    const { deps } = createFakeApkDeps();

    await expect(checkApkUpdate(deps, "1.1.0")).resolves.toMatchObject({ status: "up-to-date" });
  });

  it("erro de HTTP vira ApkUpdateError com o código", async () => {
    const { deps, state } = createFakeApkDeps();
    state.response = { status: 403, json: { message: "rate limit" } };

    await expect(checkApkUpdate(deps, "1.0.0")).rejects.toMatchObject({ code: "http", status: 403 });
  });

  it("resposta que não é uma release válida", async () => {
    const { deps, state } = createFakeApkDeps();
    state.response = { status: 200, json: { tag_name: "nightly" } };

    await expect(checkApkUpdate(deps, "1.0.0")).rejects.toBeInstanceOf(ApkUpdateError);
    state.response = { status: 200, json: null };
    await expect(checkApkUpdate(deps, "1.0.0")).rejects.toMatchObject({ code: "invalid" });
  });

  it("sem internet a falha da rede passa adiante", async () => {
    const { deps, state } = createFakeApkDeps();
    state.response = new TypeError("Network request failed");

    await expect(checkApkUpdate(deps, "1.0.0")).rejects.toThrow("Network request failed");
  });
});

describe("downloadApkUpdate", () => {
  const release = parseLatestRelease(githubRelease())!;

  it("baixa o arquivo, avisa o progresso e devolve o endereço para o instalador", async () => {
    const { deps, state } = createFakeApkDeps();
    const progress: [number, number][] = [];

    const uri = await downloadApkUpdate(deps, release, (w, t) => progress.push([w, t]), new AbortController().signal);

    expect(uri).toBe("content://app.fileprovider/cache/Finance-update.apk");
    expect(state.downloaded).toEqual(["https://github.com/x/Finance.apk"]);
    expect(progress).toEqual([
      [250, FAKE_APK_SIZE],
      [FAKE_APK_SIZE, FAKE_APK_SIZE],
    ]);
    // Apaga um arquivo antigo antes de baixar.
    expect(state.removed).toBe(1);
  });

  it("download que veio menor que o anunciado é recusado e o arquivo, apagado", async () => {
    const { deps, state } = createFakeApkDeps();
    state.downloadSize = 400;

    await expect(downloadApkUpdate(deps, release, () => {}, new AbortController().signal)).rejects.toMatchObject({
      code: "incomplete",
    });
    expect(state.removed).toBe(2);
  });

  it("sem tamanho anunciado na release, não compara", async () => {
    const { deps, state } = createFakeApkDeps();
    state.downloadSize = 400;

    await expect(
      downloadApkUpdate(deps, { ...release, size: 0 }, () => {}, new AbortController().signal),
    ).resolves.toContain("content://");
  });
});
