import type {
  BudgetRow,
  CardPaymentRow,
  CardPurchaseRow,
  CategoryBudgetRow,
  CategoryRow,
  CreditCardRow,
  SubscriptionPriceChangeRow,
  SubscriptionRow,
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
// 2: entraram os cartões de crédito, as compras e os pagamentos de fatura. 3: as assinaturas recorrentes. Arquivos das versões antigas seguem aceitos.
export const BACKUP_VERSION = 3;

export interface BackupData {
  userName: string | null;
  categories: CategoryRow[];
  transactions: TransactionRow[];
  budgets: BudgetRow[];
  categoryBudgets: CategoryBudgetRow[];
  debts: DebtRow[];
  savingsGoals: SavingsGoalRow[];
  /** Cartões de crédito e o que é deles (backups da versão 1 não têm: leem como vazio). */
  creditCards?: CreditCardRow[];
  cardPurchases?: CardPurchaseRow[];
  cardPayments?: CardPaymentRow[];
  /** Assinaturas recorrentes e o histórico de reajustes (backups antigos não têm: leem como vazio). */
  subscriptions?: SubscriptionRow[];
  subscriptionPriceChanges?: SubscriptionPriceChangeRow[];
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
  creditCards: number;
  cardPurchases: number;
  subscriptions: number;
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
    creditCards: data.creditCards?.length ?? 0,
    cardPurchases: data.cardPurchases?.length ?? 0,
    subscriptions: data.subscriptions?.length ?? 0,
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
      // Backups antigos não têm a repetição (a meta não repetia então).
      if (r.repeat_monthly != null && r.repeat_monthly !== 0 && r.repeat_monthly !== 1) return "repetição";
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
    // Backups antigos não têm o valor inicial (a meta começa em 0).
    if (r.start_amount != null && !isNumber(r.start_amount)) return "valor inicial";
    return null;
  });

  const creditCards = raw.creditCards === undefined
    ? []
    : readRows<CreditCardRow>(raw.creditCards, "cartões", (r) => {
        if (!isInteger(r.id)) return "id";
        if (!isString(r.name) || r.name.trim() === "") return "nome";
        if (!isInteger(r.closing_day) || r.closing_day < 1 || r.closing_day > 31) return "dia de fechamento";
        if (!isInteger(r.due_day) || r.due_day < 1 || r.due_day > 31) return "dia de vencimento";
        if (r.credit_limit != null && !isNumber(r.credit_limit)) return "limite";
        return null;
      });
  const cardIds = new Set(creditCards.map((card) => card.id));
  const isRef = (value: unknown) => isString(value) && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

  const cardPurchases = raw.cardPurchases === undefined
    ? []
    : readRows<CardPurchaseRow>(raw.cardPurchases, "compras no cartão", (r) => {
        if (!isInteger(r.id)) return "id";
        if (!isInteger(r.card_id) || !cardIds.has(r.card_id)) return "cartão inexistente";
        if (!isString(r.description)) return "descrição";
        if (!isNumber(r.amount)) return "valor";
        if (!isDate(r.date)) return "data";
        if (!isString(r.category)) return "categoria";
        if (!isRef(r.invoice_ref)) return "fatura";
        if (r.installment_group_id != null && !isString(r.installment_group_id)) return "série";
        if (r.installment_number != null && !isInteger(r.installment_number)) return "parcela";
        if (r.installment_total != null && !isInteger(r.installment_total)) return "total de parcelas";
        if (r.transaction_id != null && !isInteger(r.transaction_id)) return "despesa";
        return null;
      });

  const cardPayments = raw.cardPayments === undefined
    ? []
    : readRows<CardPaymentRow>(
        raw.cardPayments,
        "pagamentos de fatura",
        (r) => {
          if (!isInteger(r.id)) return "id";
          if (!isInteger(r.card_id) || !cardIds.has(r.card_id)) return "cartão inexistente";
          if (!isRef(r.invoice_ref)) return "fatura";
          if (!isDate(r.paid_date)) return "data do pagamento";
          if (!isNumber(r.amount)) return "valor";
          if (r.transaction_id != null && !isInteger(r.transaction_id)) return "despesa";
          return null;
        },
        (r) => `${r.card_id}/${r.invoice_ref}`,
      );

  const subscriptions = raw.subscriptions === undefined
    ? []
    : readRows<SubscriptionRow>(raw.subscriptions, "assinaturas", (r) => {
        if (!isInteger(r.id)) return "id";
        if (!isString(r.name) || r.name.trim() === "") return "nome";
        if (!isNumber(r.amount) || r.amount <= 0) return "valor";
        if (r.cycle !== "monthly" && r.cycle !== "yearly") return "ciclo";
        if (!isInteger(r.billing_day) || r.billing_day < 1 || r.billing_day > 31) return "dia da cobrança";
        if (r.billing_month != null && (!isInteger(r.billing_month) || r.billing_month < 1 || r.billing_month > 12)) return "mês da cobrança";
        if (r.cycle === "yearly" && r.billing_month == null) return "mês da cobrança";
        if (!isString(r.category)) return "categoria";
        if (!isNullableString(r.match_text)) return "texto da cobrança";
        if (r.active !== 0 && r.active !== 1) return "situação";
        if (!isDate(r.created_date)) return "data de criação";
        if (!isDate(r.price_since)) return "início do valor";
        if (r.ignored_amount != null && !isNumber(r.ignored_amount)) return "cobrança ignorada";
        return null;
      });
  const subscriptionIds = new Set(subscriptions.map((subscription) => subscription.id));

  const subscriptionPriceChanges = raw.subscriptionPriceChanges === undefined
    ? []
    : readRows<SubscriptionPriceChangeRow>(raw.subscriptionPriceChanges, "reajustes de assinaturas", (r) => {
        if (!isInteger(r.id)) return "id";
        if (!isInteger(r.subscription_id) || !subscriptionIds.has(r.subscription_id)) return "assinatura inexistente";
        if (!isDate(r.date)) return "data";
        if (!isNumber(r.old_amount)) return "valor antigo";
        if (!isNumber(r.new_amount)) return "valor novo";
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
    creditCards,
    cardPurchases,
    cardPayments,
    subscriptions,
    subscriptionPriceChanges,
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
  const parts = [
    plural(counts.transactions, "transação", "transações"),
    plural(counts.debts, "dívida", "dívidas"),
    plural(counts.savingsGoals, "meta de economia", "metas de economia"),
    plural(counts.categories, "categoria própria", "categorias próprias"),
  ];
  // Só aparece quando há cartão, para não poluir o texto de quem não usa.
  if (counts.creditCards > 0 || counts.cardPurchases > 0) {
    parts.push(plural(counts.creditCards, "cartão", "cartões"), plural(counts.cardPurchases, "compra no cartão", "compras no cartão"));
  }
  if (counts.subscriptions > 0) parts.push(plural(counts.subscriptions, "assinatura", "assinaturas"));
  return parts.join(", ");
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
