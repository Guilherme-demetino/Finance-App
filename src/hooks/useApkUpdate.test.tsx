import React from "react";
import { Linking } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { ApkUpdateDeps } from "../services/apkUpdate";
import { createFakeApkDeps, githubRelease } from "../test/fakeApkUpdateDeps";
import { useApkUpdate } from "./useApkUpdate";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];
const seen = {} as { hook: ReturnType<typeof useApkUpdate> };

function Probe({ deps, version }: { deps: ApkUpdateDeps; version: string }) {
  Object.assign(seen, { hook: useApkUpdate(version, deps) });
  return null;
}

function mount(deps: ApkUpdateDeps, version = "1.0.0") {
  act(() => {
    mounted.push(create(<Probe deps={deps} version={version} />));
  });
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
  jest.restoreAllMocks();
});

describe("verificar nova versão", () => {
  it("começa parado, sem nada a mostrar", () => {
    const { deps } = createFakeApkDeps();
    mount(deps);

    expect(seen.hook.phase).toBe("idle");
    expect(seen.hook.release).toBeNull();
  });

  it("acha a versão nova, com notas, tamanho e data da verificação", async () => {
    const { deps } = createFakeApkDeps();
    mount(deps);

    await act(async () => {
      await seen.hook.check();
    });

    expect(seen.hook.phase).toBe("available");
    expect(seen.hook.release?.version).toBe("1.1.0");
    expect(seen.hook.release?.notes).toContain("Lembretes de vencimento");
    expect(seen.hook.lastCheckedAt).toEqual(new Date(2026, 8, 20, 15, 30));
  });

  it("já na versão mais recente", async () => {
    const { deps } = createFakeApkDeps();
    mount(deps, "1.1.0");

    await act(async () => {
      await seen.hook.check();
    });

    expect(seen.hook.phase).toBe("up-to-date");
    expect(seen.hook.latestVersion).toBe("1.1.0");
  });

  it("versão anunciada sem o arquivo ainda", async () => {
    const { deps, state } = createFakeApkDeps();
    state.response = { status: 200, json: githubRelease({ assets: [] }) };
    mount(deps);

    await act(async () => {
      await seen.hook.check();
    });

    expect(seen.hook.phase).toBe("no-apk");
  });

  it("sem internet: erro claro, e tentar de novo refaz só a verificação", async () => {
    const { deps, state } = createFakeApkDeps();
    state.response = new TypeError("Network request failed");
    mount(deps);

    await act(async () => {
      await seen.hook.check();
    });
    expect(seen.hook.phase).toBe("error");
    expect(seen.hook.errorMessage).toContain("Sem conexão");

    state.response = { status: 200, json: githubRelease() };
    await act(async () => {
      await seen.hook.retry();
    });

    expect(seen.hook.phase).toBe("available");
    expect(seen.hook.errorMessage).toBeNull();
  });

  it("limite de consultas do GitHub", async () => {
    const { deps, state } = createFakeApkDeps();
    state.response = { status: 403, json: { message: "rate limit" } };
    mount(deps);

    await act(async () => {
      await seen.hook.check();
    });

    expect(seen.hook.errorMessage).toContain("limitou as consultas");
  });
});

describe("baixar e instalar", () => {
  async function toAvailable(deps: ApkUpdateDeps) {
    mount(deps);
    await act(async () => {
      await seen.hook.check();
    });
  }

  it("baixa com progresso e abre o instalador com o arquivo baixado", async () => {
    const { deps, state } = createFakeApkDeps();
    await toAvailable(deps);

    await act(async () => {
      await seen.hook.download();
    });

    expect(state.downloaded).toEqual(["https://github.com/x/Finance.apk"]);
    expect(state.installed).toEqual(["content://app.fileprovider/cache/Finance-update.apk"]);
    expect(seen.hook.bytes).toEqual({ written: 1000, total: 1000 });
    // Se o app ainda está aqui, o usuário voltou do instalador sem instalar.
    expect(seen.hook.phase).toBe("ready");
    expect(seen.hook.notice).toContain("A instalação não foi concluída");
  });

  it("mostra o andamento enquanto baixa e permite cancelar", async () => {
    const { deps, state } = createFakeApkDeps();
    state.holdDownload = true;
    await toAvailable(deps);

    let pending!: Promise<void>;
    await act(async () => {
      pending = seen.hook.download();
    });

    expect(seen.hook.phase).toBe("downloading");
    expect(seen.hook.isBusy).toBe(true);
    expect(seen.hook.progress).toBe(0.25);

    await act(async () => {
      seen.hook.cancel();
      await pending;
    });

    expect(seen.hook.phase).toBe("available");
    expect(seen.hook.notice).toBe("Download cancelado.");
    expect(state.installed).toEqual([]);
  });

  it("download incompleto: erro e tentar de novo baixa outra vez", async () => {
    const { deps, state } = createFakeApkDeps();
    state.downloadSize = 400;
    await toAvailable(deps);

    await act(async () => {
      await seen.hook.download();
    });
    expect(seen.hook.phase).toBe("error");
    expect(seen.hook.errorMessage).toContain("incompleto");
    expect(state.installed).toEqual([]);

    state.downloadSize = 1000;
    await act(async () => {
      await seen.hook.retry();
    });

    expect(state.downloaded).toHaveLength(2);
    expect(state.installed).toHaveLength(1);
  });

  it("falha do instalador: não baixa de novo, só tenta abrir o instalador outra vez", async () => {
    const { deps, state } = createFakeApkDeps();
    state.installError = new Error("Activity not found");
    await toAvailable(deps);

    await act(async () => {
      await seen.hook.download();
    });
    expect(seen.hook.phase).toBe("error");
    expect(seen.hook.failedStage).toBe("install");
    expect(seen.hook.errorMessage).toContain("instalador do Android");

    state.installError = null;
    await act(async () => {
      await seen.hook.retry();
    });

    expect(state.downloaded).toHaveLength(1);
    expect(state.installed).toHaveLength(2);
  });

  it("voltou do instalador sem instalar: Instalar reaproveita o arquivo baixado", async () => {
    const { deps, state } = createFakeApkDeps();
    await toAvailable(deps);
    await act(async () => {
      await seen.hook.download();
    });

    await act(async () => {
      await seen.hook.install();
    });

    expect(state.downloaded).toHaveLength(1);
    expect(state.installed).toHaveLength(2);
  });

  it("sem espaço no aparelho", async () => {
    const { deps, state } = createFakeApkDeps();
    state.downloadError = new Error("ENOSPC: no space left on device");
    await toAvailable(deps);

    await act(async () => {
      await seen.hook.download();
    });

    expect(seen.hook.errorMessage).toContain("espaço livre");
  });

  it("no erro, oferece a página da versão como plano B", async () => {
    const { deps, state } = createFakeApkDeps();
    state.installError = new Error("Activity not found");
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await toAvailable(deps);
    await act(async () => {
      await seen.hook.download();
    });

    seen.hook.openReleasePage();

    expect(open).toHaveBeenCalledWith("https://github.com/Guilherme-demetino/Finance-App/releases/tag/V1.1.0");
  });
});
