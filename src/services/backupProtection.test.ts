import { createFakeProtectionDeps } from "../test/fakeBackupProtectionDeps";
import { parseEncryptedBackup } from "../utils/backup/encryption";
import {
  adoptProtection,
  BackupProtectionError,
  disableProtection,
  enableProtection,
  getProtectionStatus,
  protectBackupText,
  unlockBackup,
  type ProtectionKey,
} from "./backupProtection";

jest.setTimeout(20_000);

const PLAIN = JSON.stringify({ format: "meu-financeiro-backup", version: 1, data: { userName: "Maria" } });
const PASSWORD = "minha frase de senha";

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

/** Um aparelho com a proteção ligada. */
async function protectedDevice(seed = 1, password = PASSWORD) {
  const device = createFakeProtectionDeps(seed);
  await enableProtection(device.deps, password, password);
  return device;
}

describe("ligar a proteção", () => {
  it("começa desligada", async () => {
    const { deps } = createFakeProtectionDeps();

    expect(await getProtectionStatus(deps)).toBe("off");
  });

  it("senha curta ou confirmação diferente: recusa e não guarda nada", async () => {
    const { deps, state } = createFakeProtectionDeps();

    expect(await enableProtection(deps, "curta", "curta")).toMatchObject({ ok: false });
    expect(await enableProtection(deps, PASSWORD, "outra senha diferente")).toEqual({
      ok: false,
      error: "As duas senhas não são iguais.",
    });
    expect(state.secret).toBeNull();
    expect(await getProtectionStatus(deps)).toBe("off");
  });

  it("guarda só a chave, os parâmetros e o sal: a senha em si nunca é gravada", async () => {
    const { deps, state } = createFakeProtectionDeps();

    expect(await enableProtection(deps, PASSWORD, PASSWORD)).toEqual({ ok: true });

    expect(await getProtectionStatus(deps)).toBe("on");
    const stored = JSON.parse(state.secret as string);
    expect(Object.keys(stored).sort()).toEqual(["kdf", "key"]);
    expect(stored.kdf).toMatchObject({ name: "scrypt", N: 32768, r: 8, p: 1 });
    expect(state.secret).not.toContain(PASSWORD);
  });

  it("desligar apaga o cofre", async () => {
    const { deps, state } = await protectedDevice();

    await disableProtection(deps);

    expect(state.secret).toBeNull();
    expect(await getProtectionStatus(deps)).toBe("off");
  });
});

describe("proteger o texto do backup", () => {
  it("desligada: o texto sai igual", async () => {
    const { deps } = createFakeProtectionDeps();

    expect(await protectBackupText(deps, PLAIN)).toBe(PLAIN);
  });

  it("ligada: sai cifrado, sem nada legível, e cada arquivo é diferente", async () => {
    const { deps } = await protectedDevice();

    const first = await protectBackupText(deps, PLAIN);
    const second = await protectBackupText(deps, PLAIN);

    expect(parseEncryptedBackup(first).ok).toBe(true);
    expect(first).not.toContain("Maria");
    expect(first).not.toBe(second);
  });

  it("ligada mas o cofre está estragado: NÃO devolve o texto aberto, lança", async () => {
    const { deps, state } = await protectedDevice();
    state.secret = "isto não é um cofre válido";

    expect(await getProtectionStatus(deps)).toBe("broken");
    await expect(protectBackupText(deps, PLAIN)).rejects.toBeInstanceOf(BackupProtectionError);
    state.secret = JSON.stringify({ kdf: { name: "scrypt" }, key: "AAAA" });
    await expect(protectBackupText(deps, PLAIN)).rejects.toBeInstanceOf(BackupProtectionError);
  });

  it("ligada mas o cofre não responde: também lança (nunca cai para o texto aberto)", async () => {
    const { deps, state } = await protectedDevice();
    state.readError = new Error("keystore indisponível");

    await expect(protectBackupText(deps, PLAIN)).rejects.toThrow("Não foi possível proteger o backup com senha");
  });
});

describe("abrir um arquivo para restaurar", () => {
  it("arquivo sem senha ou de outro tipo: segue o caminho normal", async () => {
    const { deps } = createFakeProtectionDeps();

    expect(await unlockBackup(deps, PLAIN)).toEqual({ status: "plain", text: PLAIN });
    expect(await unlockBackup(deps, "data;valor\n1;2")).toMatchObject({ status: "plain" });
  });

  it("envelope inválido ou de versão mais nova: erro claro, sem pedir senha", async () => {
    const { deps } = createFakeProtectionDeps();
    const good = JSON.parse(await protectBackupText((await protectedDevice()).deps, PLAIN));

    expect(await unlockBackup(deps, JSON.stringify({ ...good, nonce: "x" }))).toMatchObject({
      status: "invalid",
      error: expect.stringContaining("Backup protegido inválido"),
    });
    expect(await unlockBackup(deps, JSON.stringify({ ...good, version: 9 }))).toMatchObject({
      status: "invalid",
      error: expect.stringContaining("Atualize o app"),
    });
  });

  it("no mesmo aparelho, com a chave guardada, abre sozinho e sem pedir a senha", async () => {
    const { deps } = await protectedDevice();
    const file = await protectBackupText(deps, PLAIN);

    expect(await unlockBackup(deps, file)).toEqual({ status: "opened", text: PLAIN, adoptable: null });
  });

  it("em outro aparelho pede a senha; com a certa abre e oferece continuar protegendo", async () => {
    const file = await protectBackupText((await protectedDevice(1)).deps, PLAIN);
    const other = createFakeProtectionDeps(2);

    expect(await unlockBackup(other.deps, file)).toEqual({ status: "needs-password" });
    const opened = await unlockBackup(other.deps, file, PASSWORD);

    expect(opened).toMatchObject({ status: "opened", text: PLAIN });
    expect((opened as { adoptable: ProtectionKey | null }).adoptable).not.toBeNull();
  });

  it("senha errada não abre, e dá para tentar de novo", async () => {
    const file = await protectBackupText((await protectedDevice(1)).deps, PLAIN);
    const other = createFakeProtectionDeps(2);

    expect(await unlockBackup(other.deps, file, "senha errada aqui")).toEqual({ status: "wrong-password" });
    expect(await unlockBackup(other.deps, file, PASSWORD)).toMatchObject({ status: "opened" });
  });

  it("depois de adotar a chave, o aparelho novo protege com a mesma senha e abre os arquivos do antigo sem pedir", async () => {
    const oldDevice = await protectedDevice(1);
    const file = await protectBackupText(oldDevice.deps, PLAIN);
    const newDevice = createFakeProtectionDeps(2);
    const opened = await unlockBackup(newDevice.deps, file, PASSWORD);

    expect(opened).toMatchObject({ status: "opened" });
    await adoptProtection(newDevice.deps, (opened as { adoptable: ProtectionKey | null }).adoptable as ProtectionKey);

    expect(await getProtectionStatus(newDevice.deps)).toBe("on");
    expect(await unlockBackup(newDevice.deps, file)).toMatchObject({ status: "opened", text: PLAIN });
    // E o que este aparelho grava agora abre com a mesma senha de sempre.
    const fresh = await protectBackupText(newDevice.deps, PLAIN);
    expect(await unlockBackup(createFakeProtectionDeps(3).deps, fresh, PASSWORD)).toMatchObject({ status: "opened" });
  });

  it("trocar a senha: arquivos antigos pedem a senha antiga; os novos, a nova", async () => {
    const { deps } = await protectedDevice(1, "senha antiga do usuário");
    const oldFile = await protectBackupText(deps, PLAIN);

    await enableProtection(deps, "senha nova do usuário", "senha nova do usuário");
    const newFile = await protectBackupText(deps, PLAIN);

    expect(await unlockBackup(deps, newFile)).toMatchObject({ status: "opened", adoptable: null });
    expect(await unlockBackup(deps, oldFile)).toEqual({ status: "needs-password" });
    expect(await unlockBackup(deps, oldFile, "senha antiga do usuário")).toMatchObject({ status: "opened", text: PLAIN });
    expect(await unlockBackup(deps, oldFile, "senha nova do usuário")).toEqual({ status: "wrong-password" });
  });

  it("arquivo alterado: a chave guardada não abre, cai no pedido de senha e a senha certa também falha", async () => {
    const { deps } = await protectedDevice();
    const envelope = JSON.parse(await protectBackupText(deps, PLAIN));
    const flipped = envelope.ciphertext.startsWith("A") ? `B${envelope.ciphertext.slice(1)}` : `A${envelope.ciphertext.slice(1)}`;
    const tampered = JSON.stringify({ ...envelope, ciphertext: flipped });

    expect(await unlockBackup(deps, tampered)).toEqual({ status: "needs-password" });
    expect(await unlockBackup(deps, tampered, PASSWORD)).toEqual({ status: "wrong-password" });
  });
});
