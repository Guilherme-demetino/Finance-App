import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { ThemeProvider } from "../theme";
import { contrastRatio } from "../theme/contrast";
import { HIGH_CONTRAST_DARK_COLORS, HIGH_CONTRAST_LIGHT_COLORS, DARK_COLORS, LIGHT_COLORS } from "../theme/palettes";
import UpdatesScreen from "./updates";
import { CHANGELOG } from "../constants/changelog";

const mockUpdates = {
  isEnabled: true,
  isEmbeddedLaunch: false,
  updateId: "4b1f7d9e-0a0c-4f57-9a3e-8e2f6b1c7a10",
  channel: "preview" as string | null,
  runtimeVersion: "1.0.0",
  createdAt: new Date(2026, 8, 19, 20, 30) as Date | null,
  progress: undefined as number | undefined,
  check: jest.fn(),
  fetch: jest.fn(),
  reload: jest.fn(),
};
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() };

jest.mock("expo-updates", () => ({
  __esModule: true,
  get isEnabled() {
    return mockUpdates.isEnabled;
  },
  get isEmbeddedLaunch() {
    return mockUpdates.isEmbeddedLaunch;
  },
  get updateId() {
    return mockUpdates.updateId;
  },
  get channel() {
    return mockUpdates.channel;
  },
  get runtimeVersion() {
    return mockUpdates.runtimeVersion;
  },
  get createdAt() {
    return mockUpdates.createdAt;
  },
  useUpdates: () => ({ downloadProgress: mockUpdates.progress }),
  checkForUpdateAsync: (...args: unknown[]) => mockUpdates.check(...args),
  fetchUpdateAsync: (...args: unknown[]) => mockUpdates.fetch(...args),
  reloadAsync: (...args: unknown[]) => mockUpdates.reload(...args),
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0" } },
}));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
jest.setTimeout(20_000);

const latest = CHANGELOG[CHANGELOG.length - 1];
const mounted: ReactTestRenderer[] = [];
let tree: ReactTestRenderer;

async function mountScreen() {
  await act(async () => {
    tree = create(<UpdatesScreen />);
  });
  mounted.push(tree);
}

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const screenText = () =>
  tree.root
    .findAllByType(Text)
    .map((node) => flat(node.props.children))
    .join(" | ");

function button(label: string) {
  const found = tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.findAllByType(Text).some((text) => flat(text.props.children) === label));
  if (!found) throw new Error(`botão "${label}" não encontrado`);
  return found;
}

const press = (label: string) =>
  act(async () => {
    await button(label).props.onPress();
  });

const newManifest = {
  id: "novo",
  createdAt: "2026-09-20T15:00:00.000Z",
  extra: {
    expoClient: {
      extra: {
        releaseNotes: [
          { id: latest.id, date: latest.date, title: latest.title, items: latest.items },
          { id: latest.id + 1, date: "20/09/2026", title: "Tema claro", items: ["Agora o app tem tema claro."] },
        ],
      },
    },
  },
};

beforeEach(() => {
  Object.assign(mockUpdates, {
    isEnabled: true,
    isEmbeddedLaunch: false,
    channel: "preview",
    createdAt: new Date(2026, 8, 19, 20, 30),
    progress: undefined,
  });
  mockUpdates.check.mockReset();
  mockUpdates.fetch.mockReset();
  mockUpdates.reload.mockReset().mockResolvedValue(undefined);
  Object.values(mockRouter).forEach((fn) => fn.mockReset());
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.restoreAllMocks();
});

describe("tela Atualizações", () => {
  it("mostra versão, tipo, data de publicação, canal, id e a última novidade instalada", async () => {
    await mountScreen();
    const text = screenText();

    expect(text).toContain("Versão do app | 1.0.0");
    expect(text).toContain("Atualização OTA (baixada pelo app)");
    expect(text).toContain("19/09/2026 às 20:30");
    expect(text).toContain("preview");
    expect(text).toContain("4b1f7d9e-0a0c-4f57-9a3e-8e2f6b1c7a10");
    expect(text).toContain(`${latest.title} (${latest.date})`);
    expect(text).not.toContain("Última verificação");
  });

  it("mostra o histórico de novidades, da mais nova para a mais antiga", async () => {
    await mountScreen();
    const text = screenText();

    expect(text).toContain("Histórico de novidades");
    expect(text.indexOf(latest.title)).toBeGreaterThan(-1);
    expect(text.lastIndexOf(CHANGELOG[0].title)).toBeGreaterThan(text.lastIndexOf(latest.title));
  });

  it("versão de fábrica: mostra que veio com o APK", async () => {
    mockUpdates.isEmbeddedLaunch = true;
    await mountScreen();
    expect(screenText()).toContain("Versão de fábrica (instalada com o APK)");
  });

  it("modo de desenvolvimento: avisa e trava o botão", async () => {
    mockUpdates.isEnabled = false;
    mockUpdates.createdAt = null;
    await mountScreen();

    expect(screenText()).toContain("só funcionam no app instalado");
    expect(screenText()).toContain("Publicada em | não informada");
    expect(button("Verificar atualização").props.disabled).toBe(true);
  });

  it("verificar quando já está na mais recente: 'Você já está atualizado' com versão e data", async () => {
    mockUpdates.check.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: false });
    await mountScreen();

    await press("Verificar atualização");

    const text = screenText();
    expect(text).toContain("Você já está atualizado");
    expect(text).toContain("Versão 1.0.0, publicada em 19/09/2026 às 20:30.");
    expect(text).toContain("Última verificação:");
    expect(mockUpdates.check).toHaveBeenCalledTimes(1);
  });

  it("atualização nova: mostra data, o que muda (só o que falta) e o botão de baixar", async () => {
    mockUpdates.check.mockResolvedValue({ isAvailable: true, isRollBackToEmbedded: false, manifest: newManifest });
    await mountScreen();

    await press("Verificar atualização");

    const text = screenText();
    expect(text).toContain("Nova atualização disponível");
    expect(text).toContain("Publicada em 20/09/2026");
    expect(text).toContain("O que muda");
    expect(text).toContain("• Agora o app tem tema claro.");
    // a novidade que este app já tem não é repetida na caixa "O que muda"
    const box = text.slice(text.indexOf("O que muda"), text.indexOf("Baixar e aplicar"));
    expect(box).not.toContain(latest.title);
    expect(() => button("Baixar e aplicar")).not.toThrow();
  });

  it("atualização sem lista de novidades diz isso, sem quebrar", async () => {
    mockUpdates.check.mockResolvedValue({
      isAvailable: true,
      isRollBackToEmbedded: false,
      manifest: { id: "novo", createdAt: "2026-09-20T15:00:00.000Z" },
    });
    await mountScreen();

    await press("Verificar atualização");

    expect(screenText()).toContain("Esta atualização não trouxe a lista do que mudou.");
  });

  it("baixar e aplicar: mostra o progresso, baixa e reinicia o app", async () => {
    mockUpdates.check.mockResolvedValue({ isAvailable: true, isRollBackToEmbedded: false, manifest: newManifest });
    let finishDownload!: (value: unknown) => void;
    mockUpdates.fetch.mockReturnValue(new Promise((resolve) => (finishDownload = resolve)));
    await mountScreen();
    await press("Verificar atualização");

    let downloading!: Promise<void>;
    await act(async () => {
      downloading = button("Baixar e aplicar").props.onPress();
    });
    expect(screenText()).toContain("Baixando a atualização…");

    mockUpdates.progress = 0.42;
    await act(async () => {
      tree.update(<UpdatesScreen />);
    });
    expect(screenText()).toContain("42%");

    await act(async () => {
      finishDownload({ isNew: true, isRollBackToEmbedded: false, manifest: {} });
      await downloading;
    });
    expect(mockUpdates.reload).toHaveBeenCalledTimes(1);
    expect(screenText()).toContain("Reiniciando o app para aplicar a atualização…");
  });

  it("sem internet ao verificar: mensagem clara e 'Tentar de novo' funciona", async () => {
    mockUpdates.check.mockRejectedValueOnce(new Error("Network request failed"));
    await mountScreen();

    await press("Verificar atualização");
    expect(screenText()).toContain("Algo deu errado");
    expect(screenText()).toContain("Sem conexão com a internet");

    mockUpdates.check.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: false });
    await press("Tentar de novo");
    expect(screenText()).toContain("Você já está atualizado");
    expect(screenText()).not.toContain("Algo deu errado");
  });

  it("download que falha: avisa, não reinicia e tenta só o download de novo", async () => {
    mockUpdates.check.mockResolvedValue({ isAvailable: true, isRollBackToEmbedded: false, manifest: newManifest });
    mockUpdates.fetch.mockRejectedValueOnce(new Error("Failed to connect"));
    await mountScreen();
    await press("Verificar atualização");

    await press("Baixar e aplicar");
    expect(screenText()).toContain("Sem conexão com a internet");
    expect(mockUpdates.reload).not.toHaveBeenCalled();

    mockUpdates.fetch.mockResolvedValue({ isNew: true, isRollBackToEmbedded: false, manifest: {} });
    await press("Tentar de novo");
    expect(mockUpdates.fetch).toHaveBeenCalledTimes(2);
    expect(mockUpdates.check).toHaveBeenCalledTimes(1);
    expect(mockUpdates.reload).toHaveBeenCalledTimes(1);
  });

  it("o botão de voltar volta para a tela anterior, ou para o painel se não houver", async () => {
    await mountScreen();
    const backButton = tree.root.findAllByType(TouchableOpacity)[0];

    mockRouter.canGoBack.mockReturnValue(true);
    act(() => backButton.props.onPress());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);

    mockRouter.canGoBack.mockReturnValue(false);
    act(() => backButton.props.onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith("/dashboard");
  });
});

describe("cartões da tela Atualizações se destacam do fundo", () => {
  const themes = [
    ["escuro", "dark", false, DARK_COLORS],
    ["claro", "light", false, LIGHT_COLORS],
    ["escuro com alto contraste", "dark", true, HIGH_CONTRAST_DARK_COLORS],
    ["claro com alto contraste", "light", true, HIGH_CONTRAST_LIGHT_COLORS],
  ] as const;

  it.each(themes)("no tema %s, cada novidade do histórico e a versão instalada têm contorno", async (_name, mode, highContrast, palette) => {
    await act(async () => {
      tree = create(
        <ThemeProvider initial={{ mode, highContrast, fontScale: 1 }}>
          <UpdatesScreen />
        </ThemeProvider>,
      );
    });
    mounted.push(tree);

    const hostStyles = tree.root
      .findAll((n) => typeof n.type === "string")
      .map((n) => StyleSheet.flatten(n.props.style) as Record<string, unknown> | undefined)
      .filter((style): style is Record<string, unknown> => !!style);
    // Cartão de cada novidade do histórico (raio 12, margem interna 14) e o cartão "Versão instalada" (raio 16, margem 16).
    const releaseCards = hostStyles.filter((style) => style.borderRadius === 12 && style.padding === 14);
    const installedCard = hostStyles.find((style) => style.borderRadius === 16 && style.padding === 16 && style.marginBottom === 16);

    expect(releaseCards).toHaveLength(CHANGELOG.length);
    for (const card of [...releaseCards, installedCard]) {
      expect(card).toMatchObject({ backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border });
    }
    // No alto contraste o contorno se distingue do fundo da tela (3:1, WCAG 1.4.11).
    if (highContrast) expect(contrastRatio(palette.border, palette.background)).toBeGreaterThanOrEqual(3);
  });
});
