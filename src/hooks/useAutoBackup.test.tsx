import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { AutoBackupRunner } from "../components/dashboard/AutoBackupRunner";
import { AlertProvider, useAlertState } from "../context/AlertContext";
import { BACKUP_META, type AutoBackupDeps } from "../services/autoBackup";
import type { BackupData } from "../utils/backup";
import { useAutoBackup } from "./useAutoBackup";

const WITH_DATA: BackupData = {
  userName: "Ana",
  categories: [],
  transactions: [
    {
      id: 1,
      amount: 10,
      date: "05/09/2026",
      description: "Padaria",
      type: "expense",
      category_id: "Alimentação",
    },
  ],
  budgets: [],
  categoryBudgets: [],
  debts: [],
  savingsGoals: [],
};

// Pasta e banco de mentira, compartilhados com os mocks abaixo.
const mockMeta = new Map<string, string>();
const mockFolder = new Map<string, string>();
const mockState: { failWrite: boolean; data: BackupData; pick: () => Promise<unknown> } = {
  failWrite: false,
  data: WITH_DATA,
  pick: async () => ({ uri: "content://drive/tree/backups", name: "Backups" }),
};

jest.mock("../services/autoBackupDeps", () => {
  const deps: AutoBackupDeps = {
    getMeta: async (key) => mockMeta.get(key) ?? null,
    setMeta: async (key, value) => void mockMeta.set(key, value),
    readData: async () => mockState.data,
    writeBackup: async (_uri, name, text) => {
      if (mockState.failWrite) throw new Error("sem permissão");
      mockFolder.set(name, text);
    },
    listBackupNames: async () => [...mockFolder.keys()],
    deleteBackup: async (_uri, name) => void mockFolder.delete(name),
    now: () => new Date(2026, 8, 19, 20, 30),
  };
  return { realAutoBackupDeps: deps };
});
jest.mock("expo-file-system", () => ({
  Directory: { pickDirectoryAsync: () => mockState.pick() },
  File: class {},
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Seen = {
  hook: ReturnType<typeof useAutoBackup>;
  alert: ReturnType<typeof useAlertState>;
};
const mounted: ReactTestRenderer[] = [];

/** Componentes que espiam o que o hook e o aviso devolvem, guardando num objeto só deste teste. */
function createProbes() {
  const seen = {} as Seen;
  function Probe() {
    seen.hook = useAutoBackup();
    seen.alert = useAlertState();
    return null;
  }
  function Alerts() {
    seen.alert = useAlertState();
    return null;
  }
  return { seen, Probe, Alerts };
}

let seen: Seen;
let Probe: () => null;
let Alerts: () => null;

async function mount(children: React.ReactNode) {
  await act(async () => {
    mounted.push(create(<AlertProvider>{children}</AlertProvider>));
  });
}

beforeEach(() => {
  ({ seen, Probe, Alerts } = createProbes());
  mockMeta.clear();
  mockFolder.clear();
  mockState.failWrite = false;
  mockState.data = WITH_DATA;
  mockState.pick = async () => ({ uri: "content://drive/tree/backups", name: "Backups" });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
  jest.restoreAllMocks();
});

describe("useAutoBackup", () => {
  it("começa desligado", async () => {
    await mount(<Probe />);
    expect(seen.hook.settings).toMatchObject({ folderUri: null, folderName: null });
  });

  it("escolher a pasta liga o backup e já grava um, avisando", async () => {
    await mount(<Probe />);

    await act(async () => {
      await seen.hook.chooseFolder();
    });

    expect(seen.hook.settings).toMatchObject({
      folderUri: "content://drive/tree/backups",
      folderName: "Backups",
      lastError: null,
    });
    expect(seen.hook.settings?.lastAt).not.toBeNull();
    expect([...mockFolder.keys()]).toEqual(["meu-financeiro-backup-2026-09-19-2030.json"]);
    expect(seen.alert.alertMessage).toBe("Backup salvo na pasta escolhida.");
  });

  it("desistir do seletor não muda nada e não mostra erro", async () => {
    mockState.pick = async () => {
      throw Object.assign(new Error("The file picker was cancelled by the user"), {
        code: "ERR_PICKER_CANCELLED",
      });
    };
    await mount(<Probe />);

    await act(async () => {
      await seen.hook.chooseFolder();
    });

    expect(seen.hook.settings?.folderUri).toBeNull();
    expect(seen.alert.alertVisible).toBe(false);
  });

  it("outro erro do seletor mostra aviso", async () => {
    mockState.pick = async () => {
      throw new Error("falha qualquer");
    };
    await mount(<Probe />);

    await act(async () => {
      await seen.hook.chooseFolder();
    });

    expect(seen.alert.alertMessage).toBe("Não foi possível abrir o seletor de pastas.");
  });

  it("pasta que não aceita gravar: avisa na hora e deixa o erro visível", async () => {
    mockState.failWrite = true;
    await mount(<Probe />);

    await act(async () => {
      await seen.hook.chooseFolder();
    });

    expect(seen.alert.alertMessage).toContain("Escolha a pasta de novo");
    expect(seen.hook.settings?.lastError).toContain("Escolha a pasta de novo");
    expect(seen.hook.settings?.lastAt).toBeNull();
  });

  it("fazer backup agora e desligar", async () => {
    await mount(<Probe />);
    await act(async () => {
      await seen.hook.chooseFolder();
    });
    mockFolder.clear();

    await act(async () => {
      await seen.hook.backupNow();
    });
    expect(mockFolder.size).toBe(1);

    await act(async () => {
      await seen.hook.disable();
    });
    expect(seen.hook.settings?.folderUri).toBeNull();
  });
});

describe("AutoBackupRunner (ao abrir o painel)", () => {
  it("com backup ligado grava o do dia sem incomodar", async () => {
    mockMeta.set(BACKUP_META.folderUri, "content://drive/tree/backups");

    await mount(
      <>
        <Alerts />
        <AutoBackupRunner />
      </>,
    );

    expect(mockFolder.size).toBe(1);
    expect(seen.alert.alertVisible).toBe(false);
  });

  it("com falha no backup ligado, avisa e diz onde arrumar", async () => {
    mockMeta.set(BACKUP_META.folderUri, "content://drive/tree/backups");
    mockState.failWrite = true;

    await mount(
      <>
        <Alerts />
        <AutoBackupRunner />
      </>,
    );

    expect(seen.alert.alertTitle).toBe("Backup automático não funcionou");
    expect(seen.alert.alertMessage).toContain("Backup Automático");
  });

  it("sem backup ligado, lembra quem tem dados", async () => {
    await mount(
      <>
        <Alerts />
        <AutoBackupRunner />
      </>,
    );

    expect(seen.alert.alertTitle).toBe("Faça backup dos seus dados");
    expect(mockFolder.size).toBe(0);
  });

  it("sem backup ligado e sem dados, não incomoda", async () => {
    mockState.data = { ...WITH_DATA, transactions: [] };

    await mount(
      <>
        <Alerts />
        <AutoBackupRunner />
      </>,
    );

    expect(seen.alert.alertVisible).toBe(false);
  });
});
