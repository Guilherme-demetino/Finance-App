import { getDatabase } from "./sqlite";

/**
 * Transferência entre contas: duas transações (uma saída, uma entrada), com o mesmo valor e data,
 * ligadas por `transfer_group_id`. Não é receita nem despesa de verdade — fica de fora das análises
 * por categoria, orçamento e comparativo mensal (ver hooks/useCategoryBudgets, useMonthComparison e
 * useTransactions), mas conta no saldo de cada conta envolvida.
 */
export const TRANSFER_CATEGORY = "Transferência entre contas";

function generateTransferGroupId(): string {
  return `tr-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export interface TransferInput {
  amount: number;
  date: string; // DD/MM/AAAA
  fromAccount: string;
  toAccount: string;
}

export async function createTransfer(input: TransferInput): Promise<void> {
  const db = await getDatabase();
  const groupId = generateTransferGroupId();
  db.withTransactionSync(() => {
    db.runSync(
      "INSERT INTO transactions (amount, date, description, type, category_id, account, transfer_group_id) VALUES (?, ?, ?, 'expense', ?, ?, ?)",
      input.amount,
      input.date,
      `Transferência para ${input.toAccount}`,
      TRANSFER_CATEGORY,
      input.fromAccount,
      groupId,
    );
    db.runSync(
      "INSERT INTO transactions (amount, date, description, type, category_id, account, transfer_group_id) VALUES (?, ?, ?, 'income', ?, ?, ?)",
      input.amount,
      input.date,
      `Transferência de ${input.fromAccount}`,
      TRANSFER_CATEGORY,
      input.toAccount,
      groupId,
    );
  });
}

/** Apaga as duas pontas da transferência com prazo, igual a uma transação comum (ver utils/trash). */
export async function deleteTransferGroup(transferGroupId: string): Promise<void> {
  const db = await getDatabase();
  db.runSync(
    "UPDATE transactions SET deleted_at = ? WHERE transfer_group_id = ? AND deleted_at IS NULL",
    new Date().toISOString(),
    transferGroupId,
  );
}
