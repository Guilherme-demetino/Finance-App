import {
  ApkUpdateError,
  checkForApkUpdate,
  cleanNotes,
  compareVersions,
  describeApkError,
  downloadFraction,
  formatBytes,
  parseLatestRelease,
  parseVersion,
  type ApkRelease,
} from "./apkUpdates";

const releaseJson = (over: Record<string, unknown> = {}) => ({
  tag_name: "V1.1.0",
  name: "Finance 1.1.0",
  body: "Lembretes de vencimento.\r\n\r\n\r\n\r\nAtualização pelo app.",
  draft: false,
  prerelease: false,
  published_at: "2026-09-20T12:00:00Z",
  html_url: "https://github.com/Guilherme-demetino/Finance-App/releases/tag/V1.1.0",
  assets: [
    { name: "notas.txt", size: 10, browser_download_url: "https://github.com/x/notas.txt" },
    { name: "Finance.apk", size: 117713440, browser_download_url: "https://github.com/x/Finance.apk" },
  ],
  ...over,
});

const release = (over: Partial<ApkRelease> = {}): ApkRelease => ({
  version: "1.1.0",
  name: "Finance 1.1.0",
  notes: "",
  publishedAt: null,
  apkUrl: "https://github.com/x/Finance.apk",
  apkName: "Finance.apk",
  size: 1000,
  pageUrl: "https://github.com/x/releases",
  ...over,
});

describe("parseVersion e compareVersions", () => {
  it("lê tags com V maiúsculo ou minúsculo e completa com zeros", () => {
    expect(parseVersion("V1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("v1.2")).toEqual([1, 2, 0]);
    expect(parseVersion(" 2 ")).toEqual([2, 0, 0]);
  });

  it("recusa o que não é número de versão", () => {
    for (const bad of ["", "abc", "1.2.3.4", "1.x", "v", null, undefined, "1.2.3-beta"]) {
      expect(parseVersion(bad)).toBeNull();
    }
  });

  it("compara por número, não por texto (1.10 é maior que 1.9)", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.1.0", "1.1.0")).toBe(0);
    expect(compareVersions("V1.0.0", "1.1.0")).toBeLessThan(0);
    expect(compareVersions("2.0", "1.99.99")).toBeGreaterThan(0);
    expect(compareVersions("desconhecida", "1.0.0")).toBeNull();
  });
});

describe("parseLatestRelease", () => {
  it("lê versão, notas, data, arquivo .apk e página", () => {
    const parsed = parseLatestRelease(releaseJson());

    expect(parsed).toEqual({
      version: "1.1.0",
      name: "Finance 1.1.0",
      notes: "Lembretes de vencimento.\n\nAtualização pelo app.",
      publishedAt: new Date("2026-09-20T12:00:00Z"),
      apkUrl: "https://github.com/x/Finance.apk",
      apkName: "Finance.apk",
      size: 117713440,
      pageUrl: "https://github.com/Guilherme-demetino/Finance-App/releases/tag/V1.1.0",
    });
  });

  it("sem .apk anexado, volta sem endereço de download", () => {
    const parsed = parseLatestRelease(releaseJson({ assets: [] }));

    expect(parsed?.apkUrl).toBe("");
    expect(parsed?.size).toBe(0);
  });

  it("só aceita download por https", () => {
    const parsed = parseLatestRelease(
      releaseJson({ assets: [{ name: "Finance.apk", size: 5, browser_download_url: "http://inseguro/Finance.apk" }] }),
    );

    expect(parsed?.apkUrl).toBe("");
  });

  it("rascunho, pré-lançamento, tag que não é versão e formato estranho são ignorados", () => {
    expect(parseLatestRelease(releaseJson({ draft: true }))).toBeNull();
    expect(parseLatestRelease(releaseJson({ prerelease: true }))).toBeNull();
    expect(parseLatestRelease(releaseJson({ tag_name: "nightly" }))).toBeNull();
    expect(parseLatestRelease(null)).toBeNull();
    expect(parseLatestRelease([])).toBeNull();
    expect(parseLatestRelease({ message: "Not Found" })).toBeNull();
  });

  it("sem nome, data ou texto, usa valores padrão", () => {
    const parsed = parseLatestRelease(releaseJson({ name: "", published_at: "lixo", body: null, html_url: 5 }));

    expect(parsed?.name).toBe("Versão 1.1.0");
    expect(parsed?.publishedAt).toBeNull();
    expect(parsed?.notes).toBe("");
    expect(parsed?.pageUrl).toBe("https://github.com/Guilherme-demetino/Finance-App/releases");
  });
});

describe("cleanNotes", () => {
  it("limita o tamanho do texto", () => {
    const cleaned = cleanNotes("a".repeat(2000));

    expect(cleaned.length).toBeLessThanOrEqual(801);
    expect(cleaned.endsWith("…")).toBe(true);
  });
});

describe("checkForApkUpdate", () => {
  it("versão publicada maior que a instalada: disponível", () => {
    expect(checkForApkUpdate("1.0.0", release())).toEqual({ status: "available", release: release() });
  });

  it("mesma versão ou mais antiga: já está atualizado", () => {
    expect(checkForApkUpdate("1.1.0", release())).toMatchObject({ status: "up-to-date", latestVersion: "1.1.0" });
    expect(checkForApkUpdate("1.2.0", release())).toMatchObject({ status: "up-to-date" });
  });

  it("versão nova sem arquivo anexado: avisa que está a caminho", () => {
    expect(checkForApkUpdate("1.0.0", release({ apkUrl: "" }))).toEqual({ status: "no-apk", version: "1.1.0" });
  });
});

describe("formatBytes e downloadFraction", () => {
  it("mostra em MB com vírgula", () => {
    expect(formatBytes(117713440)).toBe("112,3 MB");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(0)).toBe("tamanho desconhecido");
  });

  it("progresso de 0 a 1, indefinido sem tamanho total", () => {
    expect(downloadFraction(50, 200)).toBe(0.25);
    expect(downloadFraction(300, 200)).toBe(1);
    expect(downloadFraction(10, -1)).toBeUndefined();
    expect(downloadFraction(10, 0)).toBeUndefined();
  });
});

describe("describeApkError", () => {
  it("limite do GitHub, sem release e erro de servidor", () => {
    expect(describeApkError(new ApkUpdateError("http", "x", 403), "check")).toContain("limitou as consultas");
    expect(describeApkError(new ApkUpdateError("http", "x", 429), "check")).toContain("limitou as consultas");
    expect(describeApkError(new ApkUpdateError("http", "x", 404), "check")).toContain("nenhuma versão publicada");
    expect(describeApkError(new ApkUpdateError("http", "x", 500), "check")).toContain("(500)");
  });

  it("download incompleto e resposta ilegível", () => {
    expect(describeApkError(new ApkUpdateError("incomplete", "x"), "download")).toContain("incompleto");
    expect(describeApkError(new ApkUpdateError("invalid", "x"), "check")).toContain("não pôde ser lida");
  });

  it("sem internet, sem espaço, falha do instalador e erro desconhecido", () => {
    expect(describeApkError(new TypeError("Network request failed"), "check")).toContain("Sem conexão");
    expect(describeApkError(new Error("Network error"), "download")).toContain("interrompido");
    expect(describeApkError(new Error("ENOSPC: no space left on device"), "download")).toContain("espaço livre");
    expect(describeApkError(new Error("Activity not found"), "install")).toContain("instalador do Android");
    expect(describeApkError(new Error("algo estranho"), "download")).toContain("Não foi possível baixar");
  });
});
