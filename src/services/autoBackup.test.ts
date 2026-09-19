import type { BackupData } from "../utils/backup";
import {
  BACKUP_META,
  checkBackupReminder,
  disableAutoBackup,
  getAutoBackupSettings,
  recordManualBackup,
  runAutoBackup,
  saveBackupFolder,
  type AutoBackupDeps,
} from "./autoBackup";

const NOW = new Date(2026, 8, 19, 20, 30);
const FOLDER = "content://drive/tree/backups";

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
const EMPTY: BackupData = { ...WITH_DATA, transactions: [] };

function makeDeps(overrides: Partial<AutoBackupDeps> = {}) {
  const meta = new Map<string, string>();
  const folder = new Map<string, string>(); // nome do arquivo -> conteúdo
  const deps: AutoBackupDeps = {
    getMeta: async (key) => meta.get(key) ?? null,
    setMeta: async (key, value) => void meta.set(key, value),
    readData: async () => WITH_DATA,
    writeBackup: async (_uri, name, text) => void folder.set(name, text),
    listBackupNames: async () => [...folder.keys()],
    deleteBackup: async (_uri, name) => void folder.delete(name),
    now: () => NOW,
    ...overrides,
  };
  return { deps, meta, folder };
}

beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe("runAutoBackup", () => {
  it("sem pasta escolhida não faz nada", async () => {
    const { deps, folder } = makeDeps();
    await expect(runAutoBackup(deps, { force: false })).resolves.toEqual({ status: "disabled" });
    expect(folder.size).toBe(0);
  });

  it("grava um backup completo e anota quando e sem erro", async () => {
    const { deps, meta, folder } = makeDeps();
    await saveBackupFolder(deps, FOLDER, "Backups");

    const result = await runAutoBackup(deps, { force: false });

    expect(result).toEqual({ status: "done", fileName: "meu-financeiro-backup-2026-09-19-2030.json" });
    const saved = JSON.parse(folder.get("meu-financeiro-backup-2026-09-19-2030.json")!);
    expect(saved.format).toBe("meu-financeiro-backup");
    expect(saved.data.transactions).toHaveLength(1);
    expect(meta.get(BACKUP_META.lastAt)).toBe(NOW.toISOString());
    expect(meta.get(BACKUP_META.lastError)).toBe("");
  });

  it("só faz um por dia, mas o dia seguinte faz outro", async () => {
    const { deps, folder } = makeDeps();
    await saveBackupFolder(deps, FOLDER, "Backups");

    await runAutoBackup(deps, { force: false });
    await expect(runAutoBackup(deps, { force: false })).resolves.toEqual({ status: "not-due" });
    expect(folder.size).toBe(1);

    const tomorrow = makeDeps({ now: () => new Date(2026, 8, 20, 8, 0) });
    tomorrow.meta.set(BACKUP_META.folderUri, FOLDER);
    tomorrow.meta.set(BACKUP_META.lastAt, NOW.toISOString());
    await expect(runAutoBackup(tomorrow.deps, { force: false })).resolves.toMatchObject({ status: "done" });
  });

  it("force (fazer backup agora) ignora o limite de um por dia", async () => {
    const { deps, folder } = makeDeps();
    await saveBackupFolder(deps, FOLDER, "Backups");
    await runAutoBackup(deps, { force: false });

    const later = new Date(2026, 8, 19, 21, 45);
    const again = await runAutoBackup({ ...deps, now: () => later }, { force: true });

    expect(again).toMatchObject({ status: "done", fileName: "meu-financeiro-backup-2026-09-19-2145.json" });
    expect(folder.size).toBe(2); // não sobrescreveu o anterior
  });

  it("nunca grava um backup vazio (não sobrescreve um bom com nada)", async () => {
    const { deps, folder, meta } = makeDeps({ readData: async () => EMPTY });
    await saveBackupFolder(deps, FOLDER, "Backups");

    await expect(runAutoBackup(deps, { force: true })).resolves.toEqual({ status: "empty" });

    expect(folder.size).toBe(0);
    expect(meta.has(BACKUP_META.lastAt)).toBe(false);
  });

  it("falha na gravação: anota o erro, avisa e não marca como feito", async () => {
    const { deps, meta } = makeDeps({
      writeBackup: async () => {
        throw new Error("permissão revogada");
      },
    });
    await saveBackupFolder(deps, FOLDER, "Backups");

    const result = await runAutoBackup(deps, { force: false });

    expect(result).toMatchObject({ status: "failed" });
    expect(meta.get(BACKUP_META.lastError)).toContain("Escolha a pasta de novo");
    expect(meta.has(BACKUP_META.lastAt)).toBe(false);
  });

  it("depois de uma falha, o próximo app aberto tenta de novo (não fica marcado como feito)", async () => {
    let failing = true;
    const { deps } = makeDeps({
      writeBackup: async () => {
        if (failing) throw new Error("sem permissão");
      },
    });
    await saveBackupFolder(deps, FOLDER, "Backups");

    await expect(runAutoBackup(deps, { force: false })).resolves.toMatchObject({ status: "failed" });
    failing = false;
    await expect(runAutoBackup(deps, { force: false })).resolves.toMatchObject({ status: "done" });
  });

  it("apaga só os backups antigos além dos 30 mais recentes", async () => {
    const { deps, folder } = makeDeps();
    await saveBackupFolder(deps, FOLDER, "Backups");
    for (let day = 1; day <= 30; day++) {
      folder.set(`meu-financeiro-backup-2026-08-${String(day).padStart(2, "0")}-1000.json`, "{}");
    }
    folder.set("minhas-fotos.zip", "x");

    await runAutoBackup(deps, { force: false });

    expect(folder.has("meu-financeiro-backup-2026-08-01-1000.json")).toBe(false);
    expect(folder.has("meu-financeiro-backup-2026-08-02-1000.json")).toBe(true);
    expect(folder.has("meu-financeiro-backup-2026-09-19-2030.json")).toBe(true);
    expect(folder.has("minhas-fotos.zip")).toBe(true);
    expect([...folder.keys()].filter((n) => n.startsWith("meu-financeiro-backup-"))).toHaveLength(30);
  });

  it("se apagar os antigos falhar, o backup novo continua valendo", async () => {
    const { deps, meta } = makeDeps({
      listBackupNames: async () => {
        throw new Error("não consegui listar");
      },
    });
    await saveBackupFolder(deps, FOLDER, "Backups");

    await expect(runAutoBackup(deps, { force: false })).resolves.toMatchObject({ status: "done" });
    expect(meta.get(BACKUP_META.lastError)).toBe("");
  });
});

describe("configurações", () => {
  it("guardar, ler e desligar a pasta", async () => {
    const { deps } = makeDeps();
    await expect(getAutoBackupSettings(deps)).resolves.toMatchObject({ folderUri: null, folderName: null });

    await saveBackupFolder(deps, FOLDER, "Backups");
    await expect(getAutoBackupSettings(deps)).resolves.toMatchObject({ folderUri: FOLDER, folderName: "Backups" });

    await disableAutoBackup(deps);
    await expect(getAutoBackupSettings(deps)).resolves.toMatchObject({ folderUri: null, folderName: null });
    await expect(runAutoBackup(deps, { force: true })).resolves.toEqual({ status: "disabled" });
  });

  it("escolher a pasta de novo limpa o erro anterior", async () => {
    const { deps, meta } = makeDeps();
    meta.set(BACKUP_META.lastError, "deu ruim");
    await saveBackupFolder(deps, FOLDER, "Backups");
    await expect(getAutoBackupSettings(deps)).resolves.toMatchObject({ lastError: null });
  });
});

describe("checkBackupReminder", () => {
  it("lembra quem tem dados, sem backup e sem pasta, e não repete no mesmo dia", async () => {
    const { deps } = makeDeps();
    await expect(checkBackupReminder(deps)).resolves.toBe(true);
    await expect(checkBackupReminder(deps)).resolves.toBe(false);
  });

  it("não lembra quem já tem backup automático nem quem não tem dados", async () => {
    const withFolder = makeDeps();
    await saveBackupFolder(withFolder.deps, FOLDER, "Backups");
    await expect(checkBackupReminder(withFolder.deps)).resolves.toBe(false);

    const empty = makeDeps({ readData: async () => EMPTY });
    await expect(checkBackupReminder(empty.deps)).resolves.toBe(false);
  });

  it("um backup manual recente segura o lembrete", async () => {
    const { deps } = makeDeps();
    await recordManualBackup(deps);
    await expect(checkBackupReminder(deps)).resolves.toBe(false);
  });
});
