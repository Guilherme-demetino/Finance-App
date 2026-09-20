import { DEFAULT_PREFERENCES } from "./preferences";
import { loadPreferences, savePreferences } from "./preferencesStorage";

const mockMeta = new Map<string, string>();
const mockFail: { on: boolean } = { on: false };

jest.mock("../database/appMeta", () => ({
  getMeta: async (key: string) => {
    if (mockFail.on) throw new Error("banco indisponível");
    return mockMeta.get(key) ?? null;
  },
  setMeta: async (key: string, value: string) => {
    if (mockFail.on) throw new Error("banco indisponível");
    mockMeta.set(key, value);
  },
}));

beforeEach(() => {
  mockMeta.clear();
  mockFail.on = false;
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("preferências de aparência no banco", () => {
  it("sem nada salvo, devolve o padrão (escuro, sem alto contraste, letra padrão)", async () => {
    await expect(loadPreferences()).resolves.toEqual(DEFAULT_PREFERENCES);
  });

  it("salva e lê de volta, como depois de fechar e abrir o app", async () => {
    await savePreferences({ mode: "light", highContrast: true, fontScale: 1.3 });

    await expect(loadPreferences()).resolves.toEqual({ mode: "light", highContrast: true, fontScale: 1.3 });
    expect(Object.fromEntries(mockMeta)).toEqual({
      theme_mode: "light",
      theme_high_contrast: "1",
      theme_font_scale: "1.3",
    });
  });

  it("guarda 'automático' e desligar o alto contraste", async () => {
    await savePreferences({ mode: "system", highContrast: true, fontScale: 1.15 });
    await savePreferences({ mode: "system", highContrast: false, fontScale: 1.15 });

    await expect(loadPreferences()).resolves.toEqual({ mode: "system", highContrast: false, fontScale: 1.15 });
  });

  it("valor corrompido no banco volta ao padrão", async () => {
    mockMeta.set("theme_mode", "roxo");
    mockMeta.set("theme_high_contrast", "talvez");
    mockMeta.set("theme_font_scale", "99");

    await expect(loadPreferences()).resolves.toEqual(DEFAULT_PREFERENCES);
  });

  it("banco com problema não derruba o app: lê o padrão e ignora a falha ao salvar", async () => {
    mockFail.on = true;

    await expect(loadPreferences()).resolves.toEqual(DEFAULT_PREFERENCES);
    await expect(savePreferences({ mode: "light", highContrast: false, fontScale: 1 })).resolves.toBeUndefined();
  });
});
