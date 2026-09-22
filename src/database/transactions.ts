import { getDatabase } from "./sqlite";
import type { TransactionRow, TransactionType } from "../types";
import { addMonthsToDateString, getMonthlyDates } from "../utils/dates";
import { splitAmountIntoInstallments } from "../utils/currency";
import { planRemainingInstallments } from "../utils/installments";
import { isDateInRange, yearsInRange, type DateRange } from "../utils/historyFilters";
import { TRASH_RETENTION_DAYS } from "../utils/trash";

// Menor número de meses aceito para uma recorrência — abaixo disso não
// faz sentido chamar de "recorrente".
const MIN_RECURRING_MONTHS = 2;

function generateRecurrenceGroupId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

type Db = Awaited<ReturnType<typeof getDatabase>>;

/**
 * Compras de cartão de crédito viram despesas (ver database/creditCards). Apagar a despesa no Histórico tira a compra
 * do cartão também, senão ela ficaria na fatura sem gasto correspondente.
 */
function pruneCardPurchases(db: Db): void {
  db.runSync(
    "DELETE FROM card_purchases WHERE transaction_id IS NOT NULL AND transaction_id NOT IN (SELECT id FROM transactions)",
  );
}

// Todas as leituras "ativas" abaixo ignoram o que está na Lixeira (deleted_at IS NOT NULL): para o resto do app, uma
// transação excluída não existe mais, mesmo que a linha ainda esteja na tabela por um tempo (ver utils/trash.ts).

export async function getAllTransactions(): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    "SELECT * FROM transactions WHERE deleted_at IS NULL ORDER BY id DESC",
  );
}

/**
 * Despesas parceladas ou recorrentes (as que têm um vencimento pela frente).
 * A data fica em DD/MM/AAAA, então o filtro por "de hoje em diante" é de quem chama.
 */
export async function getRecurringExpenses(): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    "SELECT * FROM transactions WHERE type = 'expense' AND recurrence_type IS NOT NULL AND deleted_at IS NULL",
  );
}

/**
 * Transações de um ano inteiro (datas no formato DD/MM/AAAA). Traz só o que o
 * painel precisa em vez da tabela toda; o mês é filtrado em cima desse recorte.
 */
export async function getTransactionsByYear(
  year: string,
): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    "SELECT * FROM transactions WHERE date LIKE ? AND deleted_at IS NULL ORDER BY id DESC",
    `%/${year}`,
  );
}

/**
 * Transações de um período qualquer (datas DD/MM/AAAA, as duas pontas inclusas), mesmo atravessando
 * meses e anos. As datas ficam como texto, então o banco traz cada ano tocado e o corte fino é feito aqui.
 */
export async function getTransactionsInRange(
  range: DateRange,
): Promise<TransactionRow[]> {
  const years = yearsInRange(range);
  const perYear = await Promise.all(years.map((year) => getTransactionsByYear(year)));
  return perYear.flat().filter((row) => isDateInRange(row.date, range));
}

/** Transações de um mês/ano específico (formato DD/MM/AAAA). */
export async function getTransactionsByMonth(
  monthNumber: string,
  year: string,
): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    "SELECT * FROM transactions WHERE date LIKE ? AND deleted_at IS NULL ORDER BY id DESC",
    `%/${monthNumber}/${year}`,
  );
}

export interface TransactionInput {
  amount: number;
  date: string;
  description: string;
  type: TransactionType;
  category: string;
}

export async function createTransaction(
  data: TransactionInput,
): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "INSERT INTO transactions (amount, date, description, type, category_id) VALUES (?, ?, ?, ?, ?)",
    data.amount,
    data.date,
    data.description,
    data.type,
    data.category,
  );
}

export async function updateTransaction(
  id: number,
  data: TransactionInput,
): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "UPDATE transactions SET amount = ?, date = ?, description = ?, type = ?, category_id = ? WHERE id = ?",
    data.amount,
    data.date,
    data.description,
    data.type,
    data.category,
    id,
  );
  // Se a despesa é uma compra de cartão, a compra acompanha (valor, data, descrição e categoria).
  db.runSync(
    "UPDATE card_purchases SET amount = ?, date = ?, description = ?, category = ? WHERE transaction_id = ?",
    data.amount,
    data.date,
    data.description,
    data.category,
    id,
  );
}

/**
 * Exclusão com prazo: só marca `deleted_at` (não some da tabela). A transação sai na hora de todas as listas e
 * cálculos, mas fica na Lixeira por alguns dias, com a chance de ser restaurada antes de sumir de vez (ver
 * restoreTransaction e purgeExpiredDeletedTransactions). Se for a despesa de uma compra de cartão, a compra some
 * junto (ver getAllCardPurchases) e volta se a exclusão for desfeita.
 */
export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "UPDATE transactions SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL",
    new Date().toISOString(),
    id,
  );
}

/** Desfaz a exclusão: a transação volta a valer, como se nunca tivesse sido apagada. */
export async function restoreTransaction(id: number): Promise<void> {
  const db = await getDatabase();
  db.runSync("UPDATE transactions SET deleted_at = NULL WHERE id = ?", id);
}

/** As transações na Lixeira (excluídas, ainda não apagadas de vez), da mais recente para a mais antiga. */
export async function getDeletedTransactions(): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    // id DESC desempata quando duas exclusões caem no mesmo milissegundo.
    "SELECT * FROM transactions WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC, id DESC",
  );
}

/** Apaga uma transação da Lixeira de vez (não dá mais para desfazer). */
export async function permanentlyDeleteTransaction(id: number): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    db.runSync("DELETE FROM transactions WHERE id = ?", id);
    pruneCardPurchases(db);
  });
}

/**
 * Limpeza da Lixeira: apaga de vez quem já passou dos dias de prazo. Roda ao abrir o painel (ver
 * context/TransactionsContext) — não é um agendamento em segundo plano, só acontece na próxima vez que o app abrir.
 * Devolve quantas foram apagadas.
 */
export async function purgeExpiredDeletedTransactions(now: Date = new Date()): Promise<number> {
  const db = await getDatabase();
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let purged = 0;
  db.withTransactionSync(() => {
    const result = db.runSync(
      "DELETE FROM transactions WHERE deleted_at IS NOT NULL AND deleted_at <= ?",
      cutoff,
    );
    purged = result.changes;
    if (purged > 0) pruneCardPurchases(db);
  });
  return purged;
}

/** Apaga todas as transações de um mês/ano específico (formato DD/MM/AAAA). */
export async function deleteTransactionsByMonth(
  monthNumber: string,
  year: string,
): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "DELETE FROM transactions WHERE date LIKE ?",
    `%/${monthNumber}/${year}`,
  );
  pruneCardPurchases(db);
}

/** Busca todas as ocorrências de uma série recorrente/parcelada, em ordem cronológica. */
export async function getTransactionsByGroupId(
  groupId: string,
): Promise<TransactionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TransactionRow>(
    "SELECT * FROM transactions WHERE recurrence_group_id = ? AND deleted_at IS NULL ORDER BY id ASC",
    groupId,
  );
}

/** Apaga todas as ocorrências de uma série recorrente/parcelada. */
export async function deleteTransactionsByGroupId(
  groupId: string,
): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "DELETE FROM transactions WHERE recurrence_group_id = ?",
    groupId,
  );
  pruneCardPurchases(db);
}

/**
 * Apaga uma ocorrência e todas as seguintes da mesma série ("esta e as
 * futuras"). Como as ocorrências são inseridas em ordem cronológica dentro
 * da mesma transação, o id crescente já reflete a ordem da série.
 */
export async function deleteTransactionsFromIdInGroup(
  groupId: string,
  fromId: number,
): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "DELETE FROM transactions WHERE recurrence_group_id = ? AND id >= ?",
    groupId,
    fromId,
  );
  pruneCardPurchases(db);
}

/**
 * Cria uma transação recorrente: gera a ocorrência atual + as próximas
 * `monthsAhead - 1`, mesmo dia todo mês (ajustado quando o mês de destino
 * não tem esse dia), todas com o mesmo valor e categoria.
 */
export async function createRecurringTransactions(
  data: TransactionInput,
  monthsAhead: number,
): Promise<void> {
  const db = await getDatabase();
  const groupId = generateRecurrenceGroupId();
  const totalMonths = Math.max(MIN_RECURRING_MONTHS, monthsAhead);

  db.withTransactionSync(() => {
    for (let i = 0; i < totalMonths; i++) {
      const date = i === 0 ? data.date : addMonthsToDateString(data.date, i);
      db.runSync(
        "INSERT INTO transactions (amount, date, description, type, category_id, recurrence_group_id, recurrence_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
        data.amount,
        date,
        data.description,
        data.type,
        data.category,
        groupId,
        "recurring",
      );
    }
  });
}

/** Grava várias transações de uma vez (importação de backup ou extrato), numa única transação do banco. */
export async function importTransactions(
  rows: TransactionInput[],
): Promise<void> {
  const db = await getDatabase();
  db.withTransactionSync(() => {
    for (const row of rows) {
      db.runSync(
        "INSERT INTO transactions (amount, date, description, type, category_id) VALUES (?, ?, ?, ?, ?)",
        row.amount,
        row.date,
        row.description,
        row.type,
        row.category,
      );
    }
  });
}

/**
 * Cria uma transação recorrente num dia fixo do mês, a partir do mês atual
 * (usado no onboarding, onde o usuário informa só o "dia do mês").
 */
export async function createRecurringOnDay(
  data: Omit<TransactionInput, "date">,
  dayOfMonth: number,
  months: number,
): Promise<void> {
  const db = await getDatabase();
  const groupId = generateRecurrenceGroupId();
  const dates = getMonthlyDates(
    dayOfMonth,
    Math.max(MIN_RECURRING_MONTHS, months),
  );

  db.withTransactionSync(() => {
    for (const date of dates) {
      db.runSync(
        "INSERT INTO transactions (amount, date, description, type, category_id, recurrence_group_id, recurrence_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
        data.amount,
        date,
        data.description,
        data.type,
        data.category,
        groupId,
        "recurring",
      );
    }
  });
}

/**
 * Cria as parcelas que ainda faltam de uma compra parcelada já em
 * andamento. `data.amount` é o valor de CADA parcela e `data.date` a data da
 * próxima parcela (a de número `startNumber`, de `total`).
 */
export async function createRemainingInstallments(
  data: TransactionInput,
  startNumber: number,
  total: number,
): Promise<void> {
  const db = await getDatabase();
  const groupId = generateRecurrenceGroupId();
  const plan = planRemainingInstallments(
    data.description,
    startNumber,
    total,
    data.date,
  );

  db.withTransactionSync(() => {
    for (const item of plan) {
      db.runSync(
        "INSERT INTO transactions (amount, date, description, type, category_id, recurrence_group_id, recurrence_type, installment_number, installment_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        data.amount,
        item.date,
        item.description,
        data.type,
        data.category,
        groupId,
        "installment",
        item.number,
        total,
      );
    }
  });
}

/**
 * Cria uma compra parcelada: divide `data.amount` (valor total da compra)
 * em `installmentCount` parcelas, uma por mês, com a descrição marcada
 * "(k/N)" pra identificar cada parcela na listagem.
 */
export async function createInstallmentTransactions(
  data: TransactionInput,
  installmentCount: number,
): Promise<void> {
  const db = await getDatabase();
  const groupId = generateRecurrenceGroupId();
  const amounts = splitAmountIntoInstallments(data.amount, installmentCount);

  db.withTransactionSync(() => {
    for (let i = 0; i < installmentCount; i++) {
      const date = i === 0 ? data.date : addMonthsToDateString(data.date, i);
      const description = `${data.description} (${i + 1}/${installmentCount})`;
      db.runSync(
        "INSERT INTO transactions (amount, date, description, type, category_id, recurrence_group_id, recurrence_type, installment_number, installment_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        amounts[i],
        date,
        description,
        data.type,
        data.category,
        groupId,
        "installment",
        i + 1,
        installmentCount,
      );
    }
  });
}
