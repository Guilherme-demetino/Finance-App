import React from "react";
import * as Sharing from "expo-sharing";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { useAlertState } from "../context/AlertContext";
import { DashboardProviders } from "../context/DashboardProviders";
import { useTransactionsData } from "../context/TransactionsContext";
import { resetDatabase } from "../database/sqlite";
import { createTransaction, getAllTransactions } from "../database/transactions";
import { useDataTransfer } from "../hooks/useDataTransfer";
import { enableProtection, getProtectionStatus } from "../services/backupProtection";
import { createSqlJsDatabase } from "../test/sqliteFake";
import type { createFakeProtectionDeps } from "../test/fakeBackupProtectionDeps";

/**
 * Integração: exportar e restaurar backup com a proteção por senha, pelos mesmos handlers do
 * menu do perfil, com providers, banco e criptografia de verdade. Só o cofre do sistema, o
 * seletor de arquivos e o compartilhamento são trocados.
 */
const mockState: { db: unknown } = { db: null };
const mockPick: { text: string | null } = { text: null };
const mockExport: { text: string | null } = { text: null };

jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));
jest.mock("expo-file-system", () => {
  class File {
    uri: string;
    exists = false;
    constructor(_dir: unknown, name: string) {
      this.uri = `file:///cache/${name}`;
    }
    delete() {}
    create() {}
    write(text: string) {
      mockExport.text = text;
    }
    static async pickFileAsync() {
      const text = mockPick.text;
      if (text === null) return { canceled: true, result: null };
      const encode = (value: string) => Uint8Array.from(unescape(encodeURIComponent(value)), (c) => c.charCodeAt(0));
      return {
        canceled: false,
        result: {
          text: async () => text,
          arrayBuffer: async () => encode(text).buffer,
        },
      };
    }
  }
  return { File, Paths: { cache: "cache" } };
});
jest.mock("expo-print", () => ({ printAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: async () => true, shareAsync: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(),
  OrientationLock: { LANDSCAPE: 1, PORTRAIT_UP: 2 },
}));
jest.mock("react-native-reanimated", () => ({
  useSharedValue: (initial: number) => {
    const { useRef } = jest.requireActual<typeof import("react")>("react");
    return useRef({ value: initial, get: () => initial, set: () => {} }).current;
  },
}));
// A criptografia é a de verdade; só o cofre e a fonte de bytes aleatórios são de mentira.
jest.mock("../services/backupProtectionDeps", () => {
  const { createFakeProtectionDeps: create } = jest.requireActual("../test/fakeBackupProtectionDeps");
  const fake = create();
  return { fake, realBackupProtectionDeps: fake.deps };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Cada chave nova leva um tempo (é o custo de propósito do scrypt).
jest.setTimeout(30_000);

const fake = (jest.requireMock("../services/backupProtectionDeps") as { fake: ReturnType<typeof createFakeProtectionDeps> }).fake;
const PASSWORD = "minha frase de senha";

type Seen = {
  transfer: ReturnType<typeof useDataTransfer>;
  transactions: ReturnType<typeof useTransactionsData>;
  alert: ReturnType<typeof useAlertState>;
};

const seen = {} as Seen;
function Probe() {
  Object.assign(seen, {
    transfer: useDataTransfer(),
    transactions: useTransactionsData(),
    alert: useAlertState(),
  });
  return null;
}

const mounted: ReactTestRenderer[] = [];
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

async function mountApp() {
  await act(async () => {
    mounted.push(
      create(
        <DashboardProviders>
          <Probe />
        </DashboardProviders>,
      ),
    );
  });
  await settle();
}

const thisMonth = () => {
  const now = new Date();
  return `05/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
};

async function seed() {
  await createTransaction({ amount: 42, date: thisMonth(), description: "Padaria", type: "expense", category: "Alimentação" });
}

const turnProtectionOn = async () => {
  await enableProtection(fake.deps, PASSWORD, PASSWORD);
};

async function exportBackup() {
  mockExport.text = null;
  await act(async () => {
    await seen.transfer.handleExportBackup();
  });
  return (mockExport as { text: string | null }).text as string;
}

async function pickToRestore(text: string) {
  mockPick.text = text;
  await act(async () => {
    await seen.transfer.handleRestoreBackup();
  });
}

const confirmRestore = async () => {
  await act(async () => {
    await seen.transfer.confirmRestore();
  });
  await settle();
};

beforeAll(async () => {
  mockState.db = await createSqlJsDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  fake.state.secret = null;
  fake.state.readError = null;
  mockPick.text = null;
  mockExport.text = null;
  (Sharing.shareAsync as jest.Mock).mockClear();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.restoreAllMocks();
});

describe("exportar o backup completo", () => {
  it("sem a proteção, sai o backup comum de sempre", async () => {
    await seed();
    await mountApp();

    const text = await exportBackup();

    expect(JSON.parse(text)).toMatchObject({ format: "meu-financeiro-backup" });
    expect(text).toContain("Padaria");
    expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
  });

  it("com a proteção ligada, o arquivo compartilhado sai cifrado: nada legível", async () => {
    await seed();
    await turnProtectionOn();
    await mountApp();

    const text = await exportBackup();

    expect(text.startsWith('{"format":"meu-financeiro-backup-criptografado"')).toBe(true);
    expect(text).not.toContain("Padaria");
    expect(text).not.toContain("Alimentação");
    expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
  });

  it("proteção ligada mas o cofre não responde: NÃO compartilha nada aberto e avisa", async () => {
    await seed();
    await turnProtectionOn();
    await mountApp();
    fake.state.readError = new Error("keystore indisponível");

    await exportBackup();

    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(mockExport.text).toBeNull();
    expect(seen.alert.alertTitle).toBe("Erro");
    expect(seen.alert.alertMessage).toContain("Não foi possível proteger o backup com senha");
  });
});

describe("restaurar um backup protegido", () => {
  it("no mesmo aparelho, com a chave guardada, abre sozinho e restaura sem pedir a senha", async () => {
    await seed();
    await turnProtectionOn();
    await mountApp();
    const file = await exportBackup();
    await resetDatabase(); // perdeu os dados

    await pickToRestore(file);

    expect(seen.transfer.pendingPassword).toBeNull();
    expect(seen.transfer.pendingRestore?.backup.data.transactions).toHaveLength(1);

    await confirmRestore();
    expect((await getAllTransactions()).map((t) => t.description)).toEqual(["Padaria"]);
    expect(seen.transactions.formattedTransactions.map((t) => t.description)).toEqual(["Padaria"]);
  });

  it("em outro aparelho pede a senha: errada não abre, certa abre, e a proteção continua com a mesma senha", async () => {
    await seed();
    await turnProtectionOn();
    await mountApp();
    const file = await exportBackup();
    await resetDatabase();
    fake.state.secret = null; // aparelho novo: sem a chave

    await pickToRestore(file);
    expect(seen.transfer.pendingPassword).not.toBeNull();
    expect(seen.transfer.pendingRestore).toBeNull();

    await act(async () => {
      await seen.transfer.submitRestorePassword("uma senha errada aqui", true);
    });
    expect(seen.transfer.passwordError).toBe("Senha incorreta ou arquivo alterado.");
    expect(seen.transfer.pendingPassword).not.toBeNull();
    expect(seen.transfer.isUnlocking).toBe(false);

    await act(async () => {
      await seen.transfer.submitRestorePassword(PASSWORD, true);
    });
    expect(seen.transfer.passwordError).toBeNull();
    expect(seen.transfer.pendingPassword).toBeNull();
    expect(seen.transfer.pendingRestore?.backup.data.transactions).toHaveLength(1);
    // Ainda nada mudou: a proteção só é assumida quando a restauração é confirmada.
    expect(await getProtectionStatus(fake.deps)).toBe("off");

    await confirmRestore();

    expect(await getProtectionStatus(fake.deps)).toBe("on");
    expect(seen.alert.alertMessage).toContain("continuam protegidos com a mesma senha");
    // O aparelho novo agora protege com a mesma senha, e o que exporta abre com ela.
    const next = await exportBackup();
    expect(next).not.toContain("Padaria");
    expect(next.startsWith('{"format":"meu-financeiro-backup-criptografado"')).toBe(true);
  });

  it("dá para restaurar sem continuar protegendo: a proteção fica desligada", async () => {
    await seed();
    await turnProtectionOn();
    await mountApp();
    const file = await exportBackup();
    await resetDatabase();
    fake.state.secret = null;

    await pickToRestore(file);
    await act(async () => {
      await seen.transfer.submitRestorePassword(PASSWORD, false);
    });
    await confirmRestore();

    expect((await getAllTransactions()).map((t) => t.description)).toEqual(["Padaria"]);
    expect(await getProtectionStatus(fake.deps)).toBe("off");
    expect(seen.alert.alertMessage).toBe("Backup restaurado. Os dados do app foram substituídos.");
  });

  it("cancelar o pedido de senha não altera nada", async () => {
    await seed();
    await turnProtectionOn();
    await mountApp();
    const file = await exportBackup();
    fake.state.secret = null;

    await pickToRestore(file);
    act(() => seen.transfer.cancelRestorePassword());

    expect(seen.transfer.pendingPassword).toBeNull();
    expect(seen.transfer.pendingRestore).toBeNull();
    expect((await getAllTransactions()).map((t) => t.description)).toEqual(["Padaria"]);
  });

  it("arquivo alterado: nem a senha certa abre, e nada é restaurado", async () => {
    await seed();
    await turnProtectionOn();
    await mountApp();
    const envelope = JSON.parse(await exportBackup());
    const flipped = envelope.ciphertext.startsWith("A") ? `B${envelope.ciphertext.slice(1)}` : `A${envelope.ciphertext.slice(1)}`;

    await pickToRestore(JSON.stringify({ ...envelope, ciphertext: flipped }));
    expect(seen.transfer.pendingPassword).not.toBeNull();
    await act(async () => {
      await seen.transfer.submitRestorePassword(PASSWORD, true);
    });

    expect(seen.transfer.passwordError).toBe("Senha incorreta ou arquivo alterado.");
    expect(seen.transfer.pendingRestore).toBeNull();
  });

  it("envelope com parâmetros inválidos: erro claro, sem pedir senha", async () => {
    await seed();
    await turnProtectionOn();
    await mountApp();
    const envelope = JSON.parse(await exportBackup());

    await pickToRestore(JSON.stringify({ ...envelope, kdf: { ...envelope.kdf, N: 2 ** 22 } }));

    expect(seen.transfer.pendingPassword).toBeNull();
    expect(seen.alert.alertTitle).toBe("Backup inválido");
    expect(seen.alert.alertMessage).toContain("Backup protegido inválido");
  });

  it("um backup comum (sem senha) continua restaurando normalmente, mesmo com a proteção ligada", async () => {
    await seed();
    await mountApp();
    const plain = await exportBackup(); // exportado com a proteção desligada
    await resetDatabase();
    await turnProtectionOn();

    await pickToRestore(plain);

    expect(seen.transfer.pendingPassword).toBeNull();
    expect(seen.transfer.pendingRestore?.backup.data.transactions).toHaveLength(1);
  });
});

describe("importar extrato com um arquivo protegido", () => {
  it("é encaminhado para 'Restaurar backup', não tratado como extrato desconhecido", async () => {
    await seed();
    await turnProtectionOn();
    await mountApp();
    const file = await exportBackup();

    mockPick.text = file;
    await act(async () => {
      await seen.transfer.handleImportFile();
    });

    expect(seen.alert.alertTitle).toBe("Esse é um backup completo");
    expect(seen.alert.alertMessage).toContain("Restaurar backup");
  });
});
