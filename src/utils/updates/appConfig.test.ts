import { CHANGELOG } from "../../constants/changelog";
import { releaseNotesFromManifest } from "./otaUpdates";

// O app.config.js embute as últimas novidades no manifesto de cada atualização
// publicada; a tela "Atualizações" lê de lá. Este teste garante que os dois lados combinam.
const buildConfig = jest.requireActual<
  (input: { config: Record<string, unknown> }) => {
    name: string;
    extra: { router: unknown; releaseNotes: typeof CHANGELOG };
  }
>("../../../app.config.js");

const STATIC_CONFIG = { name: "Finance", version: "1.0.0", extra: { router: {}, eas: { projectId: "abc" } } };

describe("app.config.js", () => {
  it("mantém tudo o que está no app.json e acrescenta as últimas 6 novidades", () => {
    const result = buildConfig({ config: STATIC_CONFIG });

    expect(result.name).toBe("Finance");
    expect(result.extra.router).toEqual({});
    expect(result.extra).toMatchObject({ eas: { projectId: "abc" } });
    expect(result.extra.releaseNotes).toEqual(CHANGELOG.slice(-6));
  });

  it("não altera o objeto recebido", () => {
    const input = JSON.parse(JSON.stringify(STATIC_CONFIG));
    buildConfig({ config: input });
    expect(input).toEqual(STATIC_CONFIG);
  });

  it("funciona se o app.json não tiver 'extra'", () => {
    const result = buildConfig({ config: { name: "Finance" } });
    expect(result.extra.releaseNotes.length).toBeGreaterThan(0);
  });

  it("o que ele embute é exatamente o que a tela consegue ler do manifesto", () => {
    const config = buildConfig({ config: STATIC_CONFIG });
    const manifest = { id: "x", createdAt: "2026-09-20T15:00:00.000Z", extra: { expoClient: config } };

    expect(releaseNotesFromManifest(manifest)).toEqual(CHANGELOG.slice(-6));
  });
});
