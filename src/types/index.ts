export type TransactionType = "income" | "expense";

/** Como uma transação se repete: recorrente (todo mês) ou parcelada (N vezes). */
export type RecurrenceType = "recurring" | "installment";

/** Linha crua da tabela `transactions` no SQLite. */
export interface TransactionRow {
  id: number;
  amount: number;
  date: string; // DD/MM/AAAA
  description: string;
  type: TransactionType;
  category_id: string;
  recurrence_group_id?: string | null;
  recurrence_type?: RecurrenceType | null;
  installment_number?: number | null;
  installment_total?: number | null;
}

/** Linha crua da tabela `categories` no SQLite. */
export interface CategoryRow {
  id: number;
  name: string;
  color: string;
  type: TransactionType;
}

/** Linha crua da tabela `users` no SQLite. */
export interface UserRow {
  id: number;
  name: string;
  avatar: string | null;
}

/** Linha crua da tabela `budgets` no SQLite — um valor por mês/ano. */
export interface BudgetRow {
  id: number;
  month: string; // "01".."12"
  year: string;
  amount: number;
}

/** Transação já enriquecida com a cor da categoria, usada na tela do dashboard. */
export interface EnrichedTransaction extends TransactionRow {
  category: string;
  color: string;
}

/** Como uma transação nova deve ser salva: única, recorrente ou parcelada. */
export type TransactionRepeatMode =
  | { kind: "single" }
  | { kind: "recurring"; months: number }
  | { kind: "installment"; count: number };

/** Formato usado para exibição na listagem (id como string, ícone resolvido). */
export interface DisplayTransaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  category?: string;
  color: string;
  icon: string;
  recurrenceType?: RecurrenceType | null;
}
