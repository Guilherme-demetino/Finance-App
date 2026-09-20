import type { Release } from "../constants/changelog";
import {
  describeRunningUpdate,
  describeUpdateError,
  formatProgress,
  latestReleaseId,
  manifestCreatedAt,
  newerReleases,
  parseReleaseNotes,
  releaseNotesFromManifest,
  shortenId,
} from "./otaUpdates";

const release = (id: number, items = ["algo mudou"]): Release => ({
  id,
  date: "19/09/2026",
  title: `Novidade ${id}`,
  items,
});

const base = {
  appVersion: "1.0.0",
  isEnabled: true,
  isEmbeddedLaunch: false,
  updateId: "4b1f7d9e-0a0c-4f57-9a3e-8e2f6b1c7a10",
  channel: "preview",
  runtimeVersion: "1.0.0",
  createdAt: new Date(2026, 8, 19, 20, 30),
};

describe("describeRunningUpdate", () => {
  it("atualização baixada pelo app (OTA)", () => {
    expect(describeRunningUpdate(base)).toMatchObject({
      kind: "ota",
      kindLabel: "Atualização OTA (baixada pelo app)",
      appVersion: "1.0.0",
      channel: "preview",
      publishedAt: base.createdAt,
    });
  });

  it("versão de fábrica, quando roda o que veio no APK", () => {
    expect(describeRunningUpdate({ ...base, isEmbeddedLaunch: true }).kind).toBe("embedded");
  });

  it("modo de desenvolvimento: atualizações desativadas, mesmo que o resto venha preenchido", () => {
    const info = describeRunningUpdate({ ...base, isEnabled: false, isEmbeddedLaunch: true });
    expect(info.kind).toBe("disabled");
    expect(info.kindLabel).toContain("desenvolvimento");
  });

  it("sem versão informada", () => {
    expect(describeRunningUpdate({ ...base, appVersion: null }).appVersion).toBe("desconhecida");
  });
});

describe("formatação", () => {
  it("shortenId corta o identificador longo", () => {
    expect(shortenId("4b1f7d9e-0a0c-4f57-9a3e-8e2f6b1c7a10")).toBe("4b1f7d9e…");
    expect(shortenId("curto")).toBe("curto");
    expect(shortenId(null)).toBe("nenhum");
  });

  it("formatProgress converte de 0-1 para porcentagem, limitando ao intervalo", () => {
    expect(formatProgress(0.426)).toBe("43%");
    expect(formatProgress(0)).toBe("0%");
    expect(formatProgress(1.7)).toBe("100%");
    expect(formatProgress(-2)).toBe("0%");
    expect(formatProgress(undefined)).toBeNull();
    expect(formatProgress(Number.NaN)).toBeNull();
  });
});

describe("novidades no manifesto", () => {
  const manifest = (releaseNotes: unknown) => ({
    id: "abc",
    createdAt: "2026-09-19T23:30:00.000Z",
    extra: { expoClient: { name: "Finance", extra: { releaseNotes } } },
  });

  it("lê as novidades que o app.config.js embutiu", () => {
    const notes = [release(12), release(13)];
    expect(releaseNotesFromManifest(manifest(notes))).toEqual(notes);
  });

  it("ignora itens fora do formato em vez de quebrar", () => {
    const notes = [release(12), { id: "x" }, null, "texto", { ...release(14), items: [1, 2] }];
    expect(releaseNotesFromManifest(manifest(notes)).map((r) => r.id)).toEqual([12]);
  });

  it("manifesto sem novidades, antigo ou estranho devolve lista vazia", () => {
    expect(releaseNotesFromManifest(undefined)).toEqual([]);
    expect(releaseNotesFromManifest({})).toEqual([]);
    expect(releaseNotesFromManifest({ extra: {} })).toEqual([]);
    expect(releaseNotesFromManifest({ extra: { expoClient: { extra: {} } } })).toEqual([]);
    expect(releaseNotesFromManifest(manifest("não é lista"))).toEqual([]);
    expect(parseReleaseNotes(undefined)).toEqual([]);
  });

  it("manifestCreatedAt lê createdAt (OTA) e commitTime (versão de fábrica)", () => {
    expect(manifestCreatedAt({ createdAt: "2026-09-19T23:30:00.000Z" })?.toISOString()).toBe(
      "2026-09-19T23:30:00.000Z",
    );
    expect(manifestCreatedAt({ commitTime: Date.UTC(2026, 8, 18, 12) })?.toISOString()).toBe(
      "2026-09-18T12:00:00.000Z",
    );
    expect(manifestCreatedAt({ createdAt: "lixo" })).toBeNull();
    expect(manifestCreatedAt({})).toBeNull();
    expect(manifestCreatedAt(undefined)).toBeNull();
  });
});

describe("o que é novo para este app", () => {
  it("latestReleaseId é o maior id, ou 0", () => {
    expect(latestReleaseId([release(3), release(9), release(5)])).toBe(9);
    expect(latestReleaseId([])).toBe(0);
  });

  it("newerReleases guarda só o que passa do instalado, mais nova primeiro", () => {
    const notes = [release(11), release(13), release(12), release(10)];
    expect(newerReleases(notes, 11).map((r) => r.id)).toEqual([13, 12]);
    expect(newerReleases(notes, 13)).toEqual([]);
    expect(newerReleases(notes, 0).map((r) => r.id)).toEqual([13, 12, 11, 10]);
  });

  it("não altera a lista original", () => {
    const notes = [release(2), release(3)];
    newerReleases(notes, 0);
    expect(notes.map((r) => r.id)).toEqual([2, 3]);
  });
});

describe("describeUpdateError", () => {
  it.each([
    "Network request failed",
    "Unable to resolve host u.expo.dev",
    "java.net.UnknownHostException: no internet",
    "Failed to connect to u.expo.dev",
    "The request timed out",
    "ENOTFOUND u.expo.dev",
  ])("erro de rede: %s", (message) => {
    expect(describeUpdateError(new Error(message), "check")).toContain("Sem conexão com a internet");
  });

  it("limite de requisições", () => {
    expect(describeUpdateError(new Error("Too Many Requests"), "check")).toContain("Muitas verificações");
    expect(describeUpdateError(new Error("HTTP 429"), "download")).toContain("Muitas verificações");
  });

  it("modo de desenvolvimento", () => {
    expect(
      describeUpdateError(new Error("checkForUpdateAsync() is not supported in development mode"), "check"),
    ).toContain("só funcionam no app instalado");
  });

  it("erro desconhecido depende da etapa", () => {
    expect(describeUpdateError(new Error("???"), "check")).toContain("verificar se há atualização");
    expect(describeUpdateError(new Error("???"), "download")).toContain("baixar a atualização");
    expect(describeUpdateError(undefined, "download")).toContain("baixar a atualização");
    expect(describeUpdateError("Network down", "check")).toContain("Sem conexão");
  });
});
