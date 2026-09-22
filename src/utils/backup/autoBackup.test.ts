import {
  autoBackupFileName,
  backupsToPrune,
  describeLastBackup,
  isBackupDue,
  isBackupEmpty,
  KEEP_BACKUPS,
  latestIso,
  shouldRemindBackup,
} from "./autoBackup";

const NOW = new Date(2026, 8, 19, 20, 30);
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 3600 * 1000).toISOString();

describe("autoBackupFileName", () => {
  it("inclui data e hora locais", () => {
    expect(autoBackupFileName(NOW)).toBe("meu-financeiro-backup-2026-09-19-2030.json");
    expect(autoBackupFileName(new Date(2026, 0, 5, 7, 4))).toBe(
      "meu-financeiro-backup-2026-01-05-0704.json",
    );
  });
});

describe("isBackupDue", () => {
  it("vence quando nunca rodou ou a data é inválida", () => {
    expect(isBackupDue(null, NOW)).toBe(true);
    expect(isBackupDue("lixo", NOW)).toBe(true);
  });

  it("não vence no mesmo dia, mesmo horas depois", () => {
    expect(isBackupDue(new Date(2026, 8, 19, 0, 5).toISOString(), NOW)).toBe(false);
    expect(isBackupDue(new Date(2026, 8, 19, 20, 29).toISOString(), NOW)).toBe(false);
  });

  it("vence no dia seguinte, mesmo com menos de 24 horas", () => {
    expect(isBackupDue(new Date(2026, 8, 18, 23, 59).toISOString(), NOW)).toBe(true);
  });
});

describe("isBackupEmpty", () => {
  const zero = { transactions: 0, categories: 0, budgets: 0, categoryBudgets: 0, debts: 0, savingsGoals: 0, creditCards: 0, cardPurchases: 0, subscriptions: 0 };
  it("só é vazio sem nenhum dado", () => {
    expect(isBackupEmpty(zero)).toBe(true);
    expect(isBackupEmpty({ ...zero, savingsGoals: 1 })).toBe(false);
    expect(isBackupEmpty({ ...zero, transactions: 3 })).toBe(false);
    expect(isBackupEmpty({ ...zero, creditCards: 1 })).toBe(false);
    expect(isBackupEmpty({ ...zero, cardPurchases: 2 })).toBe(false);
    expect(isBackupEmpty({ ...zero, subscriptions: 1 })).toBe(false);
  });
});

describe("backupsToPrune", () => {
  const name = (day: number) => `meu-financeiro-backup-2026-09-${String(day).padStart(2, "0")}-1000.json`;

  it("não apaga nada até o limite", () => {
    const names = Array.from({ length: KEEP_BACKUPS }, (_, i) => name(i + 1));
    expect(backupsToPrune(names)).toEqual([]);
  });

  it("apaga só os mais antigos que passam do limite", () => {
    const names = Array.from({ length: KEEP_BACKUPS + 2 }, (_, i) => `meu-financeiro-backup-2026-08-${String(i + 1).padStart(2, "0")}-1000.json`);
    expect(backupsToPrune(names.reverse())).toEqual([
      "meu-financeiro-backup-2026-08-01-1000.json",
      "meu-financeiro-backup-2026-08-02-1000.json",
    ]);
  });

  it("nunca toca em arquivos que o app não criou", () => {
    const own = Array.from({ length: 3 }, (_, i) => name(i + 1));
    const foreign = ["fotos.zip", "meu-financeiro-backup-antigo.json", "notas.json", "meu-financeiro-backup-2026-09-01.txt"];
    expect(backupsToPrune([...foreign, ...own], 1)).toEqual([name(1), name(2)]);
    expect(backupsToPrune(foreign, 0)).toEqual([]);
  });

  it("reconhece o nome que o Android renomeia quando já existe (\"(1)\")", () => {
    const names = ["meu-financeiro-backup-2026-09-01-1000.json", "meu-financeiro-backup-2026-09-02-1000 (1).json"];
    expect(backupsToPrune(names, 1)).toEqual(["meu-financeiro-backup-2026-09-01-1000.json"]);
  });
});

describe("shouldRemindBackup", () => {
  const base = { hasAutoBackupFolder: false, hasData: true, lastBackupAt: null, lastReminderAt: null, now: NOW };

  it("lembra quem tem dados e nunca fez backup", () => {
    expect(shouldRemindBackup(base)).toBe(true);
  });

  it("não lembra sem dados nem com backup automático ligado", () => {
    expect(shouldRemindBackup({ ...base, hasData: false })).toBe(false);
    expect(shouldRemindBackup({ ...base, hasAutoBackupFolder: true })).toBe(false);
  });

  it("não lembra se o último backup é recente (menos de 30 dias)", () => {
    expect(shouldRemindBackup({ ...base, lastBackupAt: daysAgo(29) })).toBe(false);
    expect(shouldRemindBackup({ ...base, lastBackupAt: daysAgo(31) })).toBe(true);
  });

  it("não repete o lembrete antes de 7 dias", () => {
    expect(shouldRemindBackup({ ...base, lastReminderAt: daysAgo(3) })).toBe(false);
    expect(shouldRemindBackup({ ...base, lastReminderAt: daysAgo(8) })).toBe(true);
  });
});

describe("latestIso e describeLastBackup", () => {
  it("latestIso escolhe a data mais recente e ignora nulos e inválidos", () => {
    expect(latestIso(null, null)).toBeNull();
    expect(latestIso("lixo", daysAgo(5), daysAgo(2), null)).toBe(daysAgo(2));
  });

  it("describeLastBackup", () => {
    expect(describeLastBackup(null)).toBe("ainda não");
    expect(describeLastBackup("lixo")).toBe("ainda não");
    expect(describeLastBackup(NOW.toISOString())).toBe("19/09/2026 às 20:30");
  });
});
