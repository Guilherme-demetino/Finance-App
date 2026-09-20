import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { BackupProtectionDeps } from "../services/backupProtection";
import { createFakeProtectionDeps } from "../test/fakeBackupProtectionDeps";
import { useBackupProtection } from "./useBackupProtection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.setTimeout(20_000);

const mounted: ReactTestRenderer[] = [];
const seen = {} as { hook: ReturnType<typeof useBackupProtection> };

function Probe({ deps }: { deps: BackupProtectionDeps }) {
  Object.assign(seen, { hook: useBackupProtection(deps) });
  return null;
}

async function mount(deps: BackupProtectionDeps) {
  await act(async () => {
    mounted.push(create(<Probe deps={deps} />));
  });
}

beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
  jest.restoreAllMocks();
});

describe("useBackupProtection", () => {
  it("lê o estado ao abrir: desligada por padrão", async () => {
    const { deps } = createFakeProtectionDeps();
    await mount(deps);

    expect(seen.hook.status).toBe("off");
    expect(seen.hook.isBusy).toBe(false);
    expect(seen.hook.error).toBeNull();
  });

  it("ligar com senha inválida: devolve false, mostra o erro e continua desligada", async () => {
    const { deps, state } = createFakeProtectionDeps();
    await mount(deps);

    let ok = true;
    await act(async () => {
      ok = await seen.hook.enable("curta", "curta");
    });
    expect(ok).toBe(false);
    expect(seen.hook.error).toContain("pelo menos 8 caracteres");

    await act(async () => {
      ok = await seen.hook.enable("uma senha boa demais", "outra senha boa demais");
    });
    expect(ok).toBe(false);
    expect(seen.hook.error).toBe("As duas senhas não são iguais.");
    expect(seen.hook.status).toBe("off");
    expect(state.secret).toBeNull();
  });

  it("ligar com senha boa: liga, guarda a chave e limpa o erro anterior", async () => {
    const { deps, state } = createFakeProtectionDeps();
    await mount(deps);
    await act(async () => {
      await seen.hook.enable("curta", "curta");
    });

    let ok = false;
    await act(async () => {
      ok = await seen.hook.enable("uma senha boa demais", "uma senha boa demais");
    });

    expect(ok).toBe(true);
    expect(seen.hook.status).toBe("on");
    expect(seen.hook.error).toBeNull();
    expect(seen.hook.isBusy).toBe(false);
    expect(state.secret).not.toBeNull();
  });

  it("mostra que está ocupado enquanto gera a chave", async () => {
    const { deps } = createFakeProtectionDeps();
    await mount(deps);

    let pending!: Promise<boolean>;
    await act(async () => {
      pending = seen.hook.enable("uma senha boa demais", "uma senha boa demais");
    });
    expect(seen.hook.isBusy).toBe(true);

    await act(async () => {
      await pending;
    });
    expect(seen.hook.isBusy).toBe(false);
  });

  it("desligar apaga a chave e volta a 'off'", async () => {
    const { deps, state } = createFakeProtectionDeps();
    await mount(deps);
    await act(async () => {
      await seen.hook.enable("uma senha boa demais", "uma senha boa demais");
    });

    let ok = false;
    await act(async () => {
      ok = await seen.hook.disable();
    });

    expect(ok).toBe(true);
    expect(seen.hook.status).toBe("off");
    expect(state.secret).toBeNull();
  });

  it("falha do cofre ao ligar ou desligar: erro claro, sem derrubar", async () => {
    const { deps, state } = createFakeProtectionDeps();
    await mount(deps);
    state.writeError = new Error("keystore cheio");

    await act(async () => {
      await seen.hook.enable("uma senha boa demais", "uma senha boa demais");
    });
    expect(seen.hook.error).toBe("Não foi possível ligar a proteção. Tente de novo.");
    expect(seen.hook.isBusy).toBe(false);

    deps.deleteSecret = async () => {
      throw new Error("keystore cheio");
    };
    await act(async () => {
      await seen.hook.disable();
    });
    expect(seen.hook.error).toBe("Não foi possível desligar a proteção. Tente de novo.");
  });

  it("cofre estragado ou ilegível: aparece como 'broken'", async () => {
    const { deps, state } = createFakeProtectionDeps();
    state.secret = "isto não é um cofre";
    await mount(deps);
    expect(seen.hook.status).toBe("broken");

    const failing = createFakeProtectionDeps();
    failing.state.readError = new Error("keystore indisponível");
    act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
    await mount(failing.deps);
    expect(seen.hook.status).toBe("broken");
  });

  it("refresh relê o estado (ex.: restaurar um backup passou a proteger)", async () => {
    const { deps, state } = createFakeProtectionDeps();
    await mount(deps);
    expect(seen.hook.status).toBe("off");

    const other = createFakeProtectionDeps(2);
    await act(async () => {
      await seen.hook.enable("uma senha boa demais", "uma senha boa demais");
    });
    const stored = state.secret;
    await act(async () => {
      await seen.hook.disable();
    });
    state.secret = stored; // alguém (a restauração) gravou a chave por fora do hook
    await act(async () => {
      await seen.hook.refresh();
    });

    expect(seen.hook.status).toBe("on");
    expect(other.state.secret).toBeNull();
  });
});
