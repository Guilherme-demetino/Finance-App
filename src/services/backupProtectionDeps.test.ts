import { realBackupProtectionDeps } from "./backupProtectionDeps";

const mockStore = new Map<string, string>();
const mockUuid = { calls: 0 };

jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));
// O UUID v4 nativo (Android: UUID.randomUUID) é a fonte de bytes aleatórios.
jest.mock("expo-modules-core", () => ({
  ...jest.requireActual("expo-modules-core"),
  uuid: {
    v4: () => {
      mockUuid.calls += 1;
      return `${String(mockUuid.calls).padStart(8, "0")}-aaaa-4bbb-9ccc-dddddddddddd`;
    },
  },
}));

beforeEach(() => {
  mockStore.clear();
  mockUuid.calls = 0;
});

describe("proteção dos backups: dependências reais", () => {
  it("guarda a chave no cofre do sistema, com o mesmo cofre do PIN mas outra chave", async () => {
    expect(await realBackupProtectionDeps.readSecret()).toBeNull();

    await realBackupProtectionDeps.writeSecret('{"kdf":{},"key":"x"}');

    expect([...mockStore.keys()]).toEqual(["finance_app_backup_key"]);
    expect(await realBackupProtectionDeps.readSecret()).toBe('{"kdf":{},"key":"x"}');

    await realBackupProtectionDeps.deleteSecret();
    expect(await realBackupProtectionDeps.readSecret()).toBeNull();
  });

  it("os bytes aleatórios vêm do UUID v4 nativo, sem repetir", () => {
    const first = realBackupProtectionDeps.randomBytes(24);
    const second = realBackupProtectionDeps.randomBytes(24);

    expect(first.length).toBe(24);
    expect(mockUuid.calls).toBe(4); // 24 bytes = 2 UUIDs de 15 bytes, duas vezes
    expect(Array.from(first)).not.toEqual(Array.from(second));
  });
});
