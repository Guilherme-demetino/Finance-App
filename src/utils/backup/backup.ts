import type {
  BudgetRow,
  CategoryBudgetRow,
  CategoryRow,
  DebtRow,
  SavingsGoalRow,
  TransactionRow,
} from "../../types";

/**
 * Backup completo do app num único arquivo JSON: transações, categorias,
 * orçamentos, dívidas, metas e o nome. Não leva o PIN (fica só no aparelho,
 * no cofre do sistema) nem a foto (é um caminho local que não existe em outro
 * aparelho).
 */

export const BACKUP_FORMAT = "meu-financeiro-backup";
export const BACKUP_VERSION = 1;

export interface BackupData {
  userName: string | null;
  categories: CategoryRow[];
  transactions: TransactionRow[];
  budgets: BudgetRow[];
  categoryBudgets: CategoryBudgetRow[];
  debts: DebtRow[];
  savingsGoals: SavingsGoalRow[];
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** ISO 8601, ex: 2026-09-19T20:30:00.000Z */
  createdAt: string;
  data: BackupData;
}

export type ParseBackupResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; error: string };

export interface BackupCounts {
  transactions: number;
  categories: number;
  budgets: number;
  categoryBudgets: number;
  debts: number;
  savingsGoals: number;
}

export function buildBackupFile(data: BackupData, now: Date): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: now.toISOString(),
    data,
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup);
}

export const BACKUP_FILE_PREFIX = "meu-financeiro-backup-";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "meu-financeiro-backup-2026-09-19.json" (data local). */
export function backupFileName(now: Date): string {
  return `${BACKUP_FILE_PREFIX}${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export function countBackup(data: BackupData): BackupCounts {
  return {
    transactions: data.transactions.length,
    categories: data.categories.length,
    budgets: data.budgets.length,
    categoryBudgets: data.categoryBudgets.length,
    debts: data.debts.length,
    savingsGoals: data.savingsGoals.length,
  };
}

// ---------------------------------------------------------------- validação

type Obj = Record<string, unknown>;

const isObject = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isInteger = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value);
const isNullableString = (value: unknown) => value === null || isString(value);
const isDate = (value: unknown): value is string =>
  isString(value) && /^\d{2}\/\d{2}\/\d{4}$/.test(value);
const isNullableDate = (value: unknown) => value === null || isDate(value);

class InvalidBackup extends Error {}

function fail(table: string, index: number, detail: string): never {
  throw new InvalidBackup(
    `Backup inválido: ${table}, item ${index + 1} (${detail}).`,
  );
}

/** Valida cada linha de uma tabela e recusa ids repetidos. */
function readRows<T>(
  raw: unknown,
  table: string,
  check: (row: Obj) => string | null,
  uniqueKey: (row: Obj) => string = (row) => String(row.id),
): T[] {
  if (!Array.isArray(raw)) {
    throw new InvalidBackup(`Backup inválido: falta a lista "${table}".`);
  }

  const seen = new Set<string>();
  raw.forEach((row, index) => {
    if (!isObject(row)) fail(table, index, "não é um registro");
    const problem = check(row);
    if (problem) fail(table, index, problem);
    const key = uniqueKey(row);
    if (seen.has(key)) fail(table, index, "repetido");
    seen.add(key);
  });
  return raw as T[];
}

const TRANSACTION_TYPES = ["income", "expense"];
const RECURRENCE_TYPES = ["recurring", "installment"];

function readData(raw: unknown): BackupData {
  if (!isObject(raw)) {
    throw new InvalidBackup("Backup inválido: faltam os dados.");
  }
  if (!(raw.userName === null || isString(raw.userName))) {
    throw new InvalidBackup("Backup inválido: nome do usuário.");
  }

  const transactions = readRows<TransactionRow>(raw.transactions, "transações", (r) => {
    if (!isInteger(r.id)) return "id";
    if (!isNumber(r.amount)) return "valor";
    if (!isDate(r.date)) return "data";
    if (!isString(r.description)) return "descrição";
    if (!TRANSACTION_TYPES.includes(r.type as string)) return "tipo";
    if (!isString(r.category_id)) return "categoria";
    if (r.recurrence_group_id != null && !isString(r.recurrence_group_id)) return "série";
    if (r.recurrence_type != null && !RECURRENCE_TYPES.includes(r.recurrence_type as string)) return "tipo de série";
    if (r.installment_number != null && !isInteger(r.installment_number)) return "parcela";
    if (r.installment_total != null && !isInteger(r.installment_total)) return "total de parcelas";
    return null;
  });

  const categories = readRows<CategoryRow>(raw.categories, "categorias", (r) => {
    if (!isInteger(r.id)) return "id";
    if (!isString(r.name) || r.name.trim() === "") return "nome";
    if (!isString(r.color)) return "cor";
    if (!TRANSACTION_TYPES.includes(r.type as string)) return "tipo";
    return null;
  });

  const budgets = readRows<BudgetRow>(
    raw.budgets,
    "orçamentos",
    (r) => {
      if (!isInteger(r.id)) return "id";
      if (!isString(r.month) || !/^\d{2}$/.test(r.month)) return "mês";
      if (!isString(r.year) || !/^\d{4}$/.test(r.year)) return "ano";
      if (!isNumber(r.amount)) return "valor";
      return null;
    },
    (r) => `${r.month}/${r.year}`,
  );

  const categoryBudgets = readRows<CategoryBudgetRow>(
    raw.categoryBudgets,
    "metas por categoria",
    (r) => {
      if (!isInteger(r.id)) return "id";
      if (!isString(r.category)) return "categoria";
      if (!isString(r.month) || !/^\d{2}$/.test(r.month)) return "mês";
      if (!isString(r.year) || !/^\d{4}$/.test(r.year)) return "ano";
      if (!isNumber(r.amount)) return "valor";
      return null;
    },
    (r) => `${r.category}/${r.month}/${r.year}`,
  );

  const debts = readRows<DebtRow>(raw.debts, "dívidas", (r) => {
    if (!isInteger(r.id)) return "id";
    if (!isString(r.person)) return "pessoa";
    if (!isNumber(r.amount)) return "valor";
    if (r.type !== "lent" && r.type !== "borrowed") return "tipo";
    if (!isNullableString(r.description)) return "descrição";
    if (!isDate(r.date)) return "data";
    if (r.status !== "pending" && r.status !== "settled") return "situação";
    if (!isNullableDate(r.settled_date)) return "data de quitação";
    if (!isNullableDate(r.due_date)) return "vencimento";
    return null;
  });

  const savingsGoals = readRows<SavingsGoalRow>(raw.savingsGoals, "metas de economia", (r) => {
    if (!isInteger(r.id)) return "id";
    if (!isString(r.name)) return "nome";
    if (!isNumber(r.target_amount)) return "valor da meta";
    if (!isNumber(r.saved_amount)) return "valor guardado";
    if (!isNullableDate(r.deadline)) return "prazo";
    if (!isDate(r.created_date)) return "data de criação";
    return null;
  });

  return {
    userName: raw.userName as string | null,
    categories,
    transactions,
    budgets,
    categoryBudgets,
    debts,
    savingsGoals,
  };
}

/** Lê e valida o texto de um backup. Nada é gravado aqui: só decide se o arquivo é aceitável. */
export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Esse arquivo não é um backup do Meu Financeiro (não consegui ler o conteúdo)." };
  }

  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, error: "Esse arquivo não é um backup do Meu Financeiro." };
  }
  if (!isInteger(raw.version) || raw.version < 1) {
    return { ok: false, error: "Backup inválido: versão desconhecida." };
  }
  if (raw.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: "Esse backup foi criado por uma versão mais nova do app. Atualize o app e tente de novo.",
    };
  }
  if (!isString(raw.createdAt) || Number.isNaN(Date.parse(raw.createdAt))) {
    return { ok: false, error: "Backup inválido: data de criação." };
  }

  try {
    return {
      ok: true,
      backup: {
        format: BACKUP_FORMAT,
        version: raw.version,
        createdAt: raw.createdAt,
        data: readData(raw.data),
      },
    };
  } catch (error) {
    if (error instanceof InvalidBackup) return { ok: false, error: error.message };
    throw error;
  }
}

// ------------------------------------------------------------------ textos

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function describeCounts(counts: BackupCounts): string {
  return [
    plural(counts.transactions, "transação", "transações"),
    plural(counts.debts, "dívida", "dívidas"),
    plural(counts.savingsGoals, "meta de economia", "metas de economia"),
    plural(counts.categories, "categoria própria", "categorias próprias"),
  ].join(", ");
}

/** "19/09/2026" (data local do aparelho). */
export function formatBackupDate(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Texto da confirmação antes de substituir tudo pelo backup. */
export function describeRestore(current: BackupCounts, backup: BackupFile): string {
  return [
    `Backup de ${formatBackupDate(backup.createdAt)}: ${describeCounts(countBackup(backup.data))}.`,
    `Agora no app: ${describeCounts(current)}.`,
    "Restaurar SUBSTITUI tudo o que está no app pelos dados do backup. Não dá para desfazer; se quiser guardar o que existe agora, faça um backup antes.",
  ].join("\n\n");
}
