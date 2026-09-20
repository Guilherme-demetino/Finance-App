import {
  autoBackupFileName,
  backupsToPrune,
  isBackupDue,
  isBackupEmpty,
  latestIso,
  shouldRemindBackup,
} from "../utils/backup/autoBackup";
import {
  buildBackupFile,
  countBackup,
  serializeBackup,
  type BackupData,
} from "../utils/backup/backup";
import { logError } from "../utils/logger";
import { PROTECTION_FAILED_MESSAGE } from "./backupProtection";

/** Chaves da tabela app_meta usadas pelo backup. Texto vazio = sem valor. */
export const BACKUP_META = {
  folderUri: "auto_backup_folder_uri",
  folderName: "auto_backup_folder_name",
  lastAt: "auto_backup_last_at",
  lastError: "auto_backup_last_error",
  manualAt: "manual_backup_last_at",
  reminderAt: "backup_reminder_at",
} as const;

/** Tudo que o serviço precisa do mundo de fora; nos testes vira um faz-de-conta. */
export interface AutoBackupDeps {
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  readData(): Promise<BackupData>;
  /** Cifra o texto do backup se a proteção por senha estiver ligada. Sem isto, o texto sai como está. */
  protectBackup?(text: string): Promise<string>;
  writeBackup(folderUri: string, fileName: string, text: string): Promise<void>;
  listBackupNames(folderUri: string): Promise<string[]>;
  deleteBackup(folderUri: string, fileName: string): Promise<void>;
  now(): Date;
}

export interface AutoBackupSettings {
  folderUri: string | null;
  folderName: string | null;
  lastAt: string | null;
  lastError: string | null;
  manualAt: string | null;
}

export type AutoBackupResult =
  | { status: "disabled" }
  | { status: "not-due" }
  | { status: "empty" }
  | { status: "done"; fileName: string }
  | { status: "failed"; error: string };

const WRITE_FAILED =
  "Não foi possível gravar na pasta escolhida. Escolha a pasta de novo.";

async function readSetting(deps: AutoBackupDeps, key: string): Promise<string | null> {
  const value = await deps.getMeta(key);
  return value === null || value === "" ? null : value;
}

export async function getAutoBackupSettings(
  deps: AutoBackupDeps,
): Promise<AutoBackupSettings> {
  return {
    folderUri: await readSetting(deps, BACKUP_META.folderUri),
    folderName: await readSetting(deps, BACKUP_META.folderName),
    lastAt: await readSetting(deps, BACKUP_META.lastAt),
    lastError: await readSetting(deps, BACKUP_META.lastError),
    manualAt: await readSetting(deps, BACKUP_META.manualAt),
  };
}

export async function saveBackupFolder(
  deps: AutoBackupDeps,
  folderUri: string,
  folderName: string,
): Promise<void> {
  await deps.setMeta(BACKUP_META.folderUri, folderUri);
  await deps.setMeta(BACKUP_META.folderName, folderName);
  await deps.setMeta(BACKUP_META.lastError, "");
}

/** Desliga o backup automático. Os arquivos já gravados na pasta ficam onde estão. */
export async function disableAutoBackup(deps: AutoBackupDeps): Promise<void> {
  await deps.setMeta(BACKUP_META.folderUri, "");
  await deps.setMeta(BACKUP_META.folderName, "");
  await deps.setMeta(BACKUP_META.lastError, "");
}

/** Anota que o backup manual foi aberto para compartilhar (usado só para decidir o lembrete). */
export async function recordManualBackup(deps: AutoBackupDeps): Promise<void> {
  await deps.setMeta(BACKUP_META.manualAt, deps.now().toISOString());
}

/**
 * Grava um backup completo na pasta escolhida, no máximo um por dia (a não
 * ser com `force`, usado por "fazer backup agora"). Nunca grava um backup
 * vazio. Falhas não derrubam nada: ficam anotadas e voltam no resultado.
 */
export async function runAutoBackup(
  deps: AutoBackupDeps,
  options: { force: boolean },
): Promise<AutoBackupResult> {
  const folderUri = await readSetting(deps, BACKUP_META.folderUri);
  if (!folderUri) return { status: "disabled" };

  const now = deps.now();
  if (!options.force) {
    const lastAt = await readSetting(deps, BACKUP_META.lastAt);
    if (!isBackupDue(lastAt, now)) return { status: "not-due" };
  }

  try {
    const data = await deps.readData();
    if (isBackupEmpty(countBackup(data))) return { status: "empty" };

    // Com a proteção ligada e algo dando errado, o backup NÃO é gravado sem senha.
    let text = serializeBackup(buildBackupFile(data, now));
    if (deps.protectBackup) {
      try {
        text = await deps.protectBackup(text);
      } catch (error) {
        logError("Erro ao proteger o backup automático:", error);
        await deps.setMeta(BACKUP_META.lastError, PROTECTION_FAILED_MESSAGE).catch(() => {});
        return { status: "failed", error: PROTECTION_FAILED_MESSAGE };
      }
    }

    const fileName = autoBackupFileName(now);
    await deps.writeBackup(folderUri, fileName, text);

    await deps.setMeta(BACKUP_META.lastAt, now.toISOString());
    await deps.setMeta(BACKUP_META.lastError, "");

    await pruneOldBackups(deps, folderUri);
    return { status: "done", fileName };
  } catch (error) {
    logError("Erro no backup automático:", error);
    await deps.setMeta(BACKUP_META.lastError, WRITE_FAILED).catch(() => {});
    return { status: "failed", error: WRITE_FAILED };
  }
}

/** Apagar os mais antigos é um extra: se falhar, o backup novo já foi gravado e está tudo certo. */
async function pruneOldBackups(deps: AutoBackupDeps, folderUri: string): Promise<void> {
  try {
    const names = await deps.listBackupNames(folderUri);
    for (const name of backupsToPrune(names)) {
      try {
        await deps.deleteBackup(folderUri, name);
      } catch (error) {
        logError("Erro ao apagar backup antigo:", error);
      }
    }
  } catch (error) {
    logError("Erro ao listar backups antigos:", error);
  }
}

/**
 * Diz se vale lembrar o usuário de fazer backup e, se sim, anota que o
 * lembrete foi dado. As checagens baratas vêm antes de ler o banco.
 */
export async function checkBackupReminder(deps: AutoBackupDeps): Promise<boolean> {
  const settings = await getAutoBackupSettings(deps);
  const lastReminderAt = await readSetting(deps, BACKUP_META.reminderAt);
  const now = deps.now();

  const input = {
    hasAutoBackupFolder: settings.folderUri !== null,
    hasData: true,
    lastBackupAt: latestIso(settings.lastAt, settings.manualAt),
    lastReminderAt,
    now,
  };
  if (!shouldRemindBackup(input)) return false;

  const data = await deps.readData();
  if (isBackupEmpty(countBackup(data))) return false;

  await deps.setMeta(BACKUP_META.reminderAt, now.toISOString());
  return true;
}
