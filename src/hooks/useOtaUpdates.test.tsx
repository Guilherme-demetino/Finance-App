import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { CHANGELOG } from "../constants/changelog";
import { useOtaUpdates } from "./useOtaUpdates";

// Estado do "expo-updates" de mentira. O módulo é um objeto com getters
// (__esModule) para os testes poderem mudar os valores entre um caso e outro.
const mockUpdates = {
  isEnabled: true,
  isEmbeddedLaunch: false,
  updateId: "4b1f7d9e-0a0c-4f57-9a3e-8e2f6b1c7a10",
  channel: "preview",
  runtimeVersion: "1.0.0",
  createdAt: new Date(2026, 8, 19, 20, 30) as Date | null,
  progress: undefined as number | undefined,
  check: jest.fn(),
  fetch: jest.fn(),
  reload: jest.fn(),
};

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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Hook = ReturnType<typeof useOtaUpdates>;

function createProbe() {
  const seen = {} as { hook: Hook };
  function Probe() {
    seen.hook = useOtaUpdates();
    return null;
  }
  return { seen, Probe };
}

let seen: { hook: Hook };
let ProbeComponent: () => null;
const mounted: ReactTestRenderer[] = [];

async function mount() {
  const probe = createProbe();
  seen = probe.seen;
  ProbeComponent = probe.Probe;
  await act(async () => {
    mounted.push(create(<probe.Probe />));
  });
}

const latestId = CHANGELOG[CHANGELOG.length - 1].id;
const note = (id: number) => ({ id, date: "20/09/2026", title: `Novidade ${id}`, items: [`item ${id}`] });
const manifest = (releaseNotes: unknown[]) => ({
  id: "novo",
  createdAt: "2026-09-20T12:00:00.000Z",
  extra: { expoClient: { extra: { releaseNotes } } },
});

beforeEach(() => {
  Object.assign(mockUpdates, {
    isEnabled: true,
    isEmbeddedLaunch: false,
    createdAt: new Date(2026, 8, 19, 20, 30),
    progress: undefined,
  });
  mockUpdates.check.mockReset();
  mockUpdates.fetch.mockReset();
  mockUpdates.reload.mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
  jest.restoreAllMocks();
});

describe("useOtaUpdates: o que está rodando", () => {
  it("mostra versão, tipo, canal, id e data da atualização em execução", async () => {
    await mount();

    expect(seen.hook.info).toMatchObject({
      appVersion: "1.0.0",
      kind: "ota",
      channel: "preview",
      runtimeVersion: "1.0.0",
      updateId: "4b1f7d9e-0a0c-4f57-9a3e-8e2f6b1c7a10",
      publishedAt: new Date(2026, 8, 19, 20, 30),
    });
    expect(seen.hook.phase).toBe("idle");
    expect(seen.hook.installedRelease?.id).toBe(latestId);
    expect(seen.hook.canCheck).toBe(true);
  });

  it("versão de fábrica (APK sem OTA aplicado)", async () => {
    mockUpdates.isEmbeddedLaunch = true;
    await mount();
    expect(seen.hook.info.kind).toBe("embedded");
  });

  it("modo de desenvolvimento: não dá para verificar", async () => {
    mockUpdates.isEnabled = false;
    mockUpdates.createdAt = null;
    await mount();

    expect(seen.hook.info.kind).toBe("disabled");
    expect(seen.hook.canCheck).toBe(false);
    expect(seen.hook.info.publishedAt).toBeNull();
  });
});

describe("useOtaUpdates: verificar", () => {
  it("já está na mais recente", async () => {
    mockUpdates.check.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: false, reason: "noUpdateAvailableOnServer" });
    await mount();

    await act(async () => {
      await seen.hook.check();
    });

    expect(seen.hook.phase).toBe("up-to-date");
    expect(seen.hook.available).toBeNull();
    expect(seen.hook.lastCheckedAt).toBeInstanceOf(Date);
  });

  it("enquanto verifica, o botão fica travado", async () => {
    let finish!: (value: unknown) => void;
    mockUpdates.check.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await mount();

    let running!: Promise<void>;
    await act(async () => {
      running = seen.hook.check();
    });
    expect(seen.hook.phase).toBe("checking");
    expect(seen.hook.canCheck).toBe(false);

    await act(async () => {
      finish({ isAvailable: false, isRollBackToEmbedded: false });
      await running;
    });
    expect(seen.hook.canCheck).toBe(true);
  });

  it("atualização nova: data de publicação e só as novidades que este app ainda não tem", async () => {
    mockUpdates.check.mockResolvedValue({
      isAvailable: true,
      isRollBackToEmbedded: false,
      manifest: manifest([note(latestId - 1), note(latestId), note(latestId + 1), note(latestId + 2)]),
    });
    await mount();

    await act(async () => {
      await seen.hook.check();
    });

    expect(seen.hook.phase).toBe("available");
    expect(seen.hook.available?.isRollback).toBe(false);
    expect(seen.hook.available?.publishedAt?.toISOString()).toBe("2026-09-20T12:00:00.000Z");
    expect(seen.hook.available?.notes.map((n) => n.id)).toEqual([latestId + 2, latestId + 1]);
  });

  it("atualização nova sem descrição no manifesto (versão antiga da config) continua funcionando", async () => {
    mockUpdates.check.mockResolvedValue({
      isAvailable: true,
      isRollBackToEmbedded: false,
      manifest: { id: "novo", createdAt: "2026-09-20T12:00:00.000Z" },
    });
    await mount();

    await act(async () => {
      await seen.hook.check();
    });

    expect(seen.hook.phase).toBe("available");
    expect(seen.hook.available?.notes).toEqual([]);
  });

  it("servidor pedindo para voltar à versão de fábrica", async () => {
    mockUpdates.check.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: true });
    await mount();

    await act(async () => {
      await seen.hook.check();
    });

    expect(seen.hook.phase).toBe("available");
    expect(seen.hook.available).toMatchObject({ isRollback: true, notes: [] });
  });

  it("sem internet: mensagem clara e dá para tentar de novo", async () => {
    mockUpdates.check.mockRejectedValueOnce(new Error("Network request failed"));
    await mount();

    await act(async () => {
      await seen.hook.check();
    });
    expect(seen.hook.phase).toBe("error");
    expect(seen.hook.errorMessage).toContain("Sem conexão com a internet");

    mockUpdates.check.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: false });
    await act(async () => {
      await seen.hook.retry();
    });
    expect(seen.hook.phase).toBe("up-to-date");
    expect(seen.hook.errorMessage).toBeNull();
  });
});

describe("useOtaUpdates: baixar e aplicar", () => {
  async function withAvailableUpdate() {
    mockUpdates.check.mockResolvedValue({
      isAvailable: true,
      isRollBackToEmbedded: false,
      manifest: manifest([note(latestId + 1)]),
    });
    await mount();
    await act(async () => {
      await seen.hook.check();
    });
  }

  it("baixa, reinicia o app e mostra o progresso enquanto baixa", async () => {
    await withAvailableUpdate();
    let finishDownload!: (value: unknown) => void;
    mockUpdates.fetch.mockReturnValue(new Promise((resolve) => (finishDownload = resolve)));

    let running!: Promise<void>;
    await act(async () => {
      running = seen.hook.apply();
    });
    expect(seen.hook.phase).toBe("downloading");
    expect(seen.hook.canCheck).toBe(false);

    expect(seen.hook.progress).toBeUndefined(); // o sistema ainda não informou

    mockUpdates.progress = 0.42;
    await act(async () => {
      // o hook do expo-updates re-renderiza quem o usa quando o progresso muda
      mounted[0].update(<ProbeComponent />);
    });
    expect(seen.hook.progress).toBe(0.42);

    await act(async () => {
      finishDownload({ isNew: true, isRollBackToEmbedded: false, manifest: {} });
      await running;
    });

    expect(mockUpdates.reload).toHaveBeenCalledTimes(1);
    expect(seen.hook.phase).toBe("restarting");
  });

  it("falha no download: avisa, não reinicia e tentar de novo refaz só o download", async () => {
    await withAvailableUpdate();
    mockUpdates.fetch.mockRejectedValueOnce(new Error("Failed to connect to u.expo.dev"));

    await act(async () => {
      await seen.hook.apply();
    });

    expect(seen.hook.phase).toBe("error");
    expect(seen.hook.errorMessage).toContain("Sem conexão com a internet");
    expect(mockUpdates.reload).not.toHaveBeenCalled();

    mockUpdates.fetch.mockResolvedValue({ isNew: true, isRollBackToEmbedded: false, manifest: {} });
    await act(async () => {
      await seen.hook.retry();
    });
    expect(mockUpdates.fetch).toHaveBeenCalledTimes(2);
    expect(mockUpdates.check).toHaveBeenCalledTimes(1); // não verificou de novo
    expect(mockUpdates.reload).toHaveBeenCalledTimes(1);
  });

  it("download que não trouxe nada novo é tratado como falha, sem reiniciar", async () => {
    await withAvailableUpdate();
    mockUpdates.fetch.mockResolvedValue({ isNew: false, isRollBackToEmbedded: false });

    await act(async () => {
      await seen.hook.apply();
    });

    expect(seen.hook.phase).toBe("error");
    expect(seen.hook.errorMessage).toContain("baixar a atualização");
    expect(mockUpdates.reload).not.toHaveBeenCalled();
  });

  it("reversão para a versão de fábrica também baixa e reinicia", async () => {
    mockUpdates.check.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: true });
    mockUpdates.fetch.mockResolvedValue({ isNew: false, isRollBackToEmbedded: true });
    await mount();
    await act(async () => {
      await seen.hook.check();
    });

    await act(async () => {
      await seen.hook.apply();
    });

    expect(mockUpdates.reload).toHaveBeenCalledTimes(1);
  });

  it("baixou mas não conseguiu reiniciar: manda fechar e abrir o app", async () => {
    await withAvailableUpdate();
    mockUpdates.fetch.mockResolvedValue({ isNew: true, isRollBackToEmbedded: false, manifest: {} });
    mockUpdates.reload.mockRejectedValueOnce(new Error("cannot reload"));

    await act(async () => {
      await seen.hook.apply();
    });

    expect(seen.hook.phase).toBe("error");
    expect(seen.hook.errorMessage).toContain("Feche o app e abra de novo");

    await act(async () => {
      await seen.hook.retry();
    });
    expect(mockUpdates.fetch).toHaveBeenCalledTimes(1); // não baixou de novo
    expect(mockUpdates.reload).toHaveBeenCalledTimes(2);
  });
});
