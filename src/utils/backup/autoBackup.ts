import { BACKUP_FILE_PREFIX, type BackupCounts } from "./backup";

/** Quantos arquivos de backup automático ficam na pasta; os mais antigos são apagados. */
export const KEEP_BACKUPS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const REMIND_AFTER_DAYS = 30;
const REMIND_EVERY_DAYS = 7;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * "meu-financeiro-backup-2026-09-19-2030.json": leva a hora para dois backups
 * do mesmo dia nunca se sobrescreverem (ex: um zerar dados seguido de outro backup).
 */
export function autoBackupFileName(now: Date): string {
  return `${BACKUP_FILE_PREFIX}${localDay(now)}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

/** Só um backup automático por dia: vence quando nunca rodou ou o último foi em outro dia. */
export function isBackupDue(lastAtIso: string | null, now: Date): boolean {
  if (!lastAtIso) return true;
  const last = new Date(lastAtIso);
  if (Number.isNaN(last.getTime())) return true;
  return localDay(last) !== localDay(now);
}

/** Backup vazio (só o nome, sem nenhum dado) não é gravado: não vale sobrescrever um bom com nada. */
export function isBackupEmpty(counts: BackupCounts): boolean {
  return (
    counts.transactions === 0 &&
    counts.categories === 0 &&
    counts.budgets === 0 &&
    counts.categoryBudgets === 0 &&
    counts.debts === 0 &&
    counts.savingsGoals === 0
  );
}

const OWN_BACKUP_NAME = new RegExp(
  `^${BACKUP_FILE_PREFIX}\\d{4}-\\d{2}-\\d{2}(?:-\\d{4})?(?: \\(\\d+\\))?\\.json$`,
);

/**
 * Quais arquivos apagar para sobrar só os `keep` mais recentes. Só mexe em nomes
 * que o próprio app cria; qualquer outro arquivo da pasta nunca entra na lista.
 */
export function backupsToPrune(names: string[], keep: number = KEEP_BACKUPS): string[] {
  const own = names.filter((name) => OWN_BACKUP_NAME.test(name)).sort();
  return own.length > keep ? own.slice(0, own.length - keep) : [];
}

interface ReminderInput {
  hasAutoBackupFolder: boolean;
  hasData: boolean;
  /** O mais recente entre o backup automático e o backup manual (ISO), ou null. */
  lastBackupAt: string | null;
  lastReminderAt: string | null;
  now: Date;
}

function daysSince(iso: string | null, now: Date): number {
  if (!iso) return Infinity;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return Infinity;
  return (now.getTime() - time) / DAY_MS;
}

/** Lembra de fazer backup só quando há dados, não há backup automático, o último foi há muito tempo e o lembrete não foi dado há pouco. */
export function shouldRemindBackup(input: ReminderInput): boolean {
  if (input.hasAutoBackupFolder || !input.hasData) return false;
  if (daysSince(input.lastBackupAt, input.now) < REMIND_AFTER_DAYS) return false;
  if (daysSince(input.lastReminderAt, input.now) < REMIND_EVERY_DAYS) return false;
  return true;
}

/** O mais recente entre duas datas ISO (ignora nulos e inválidos). */
export function latestIso(...values: (string | null)[]): string | null {
  let best: string | null = null;
  let bestTime = -Infinity;
  for (const value of values) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (!Number.isNaN(time) && time > bestTime) {
      best = value;
      bestTime = time;
    }
  }
  return best;
}

/** "19/09/2026 às 20:30" (hora local) ou "ainda não". */
export function describeLastBackup(iso: string | null): string {
  if (!iso) return "ainda não";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "ainda não";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
