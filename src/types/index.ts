export type TransactionType = "income" | "expense";

/** Como uma transação se repete: recorrente (todo mês) ou parcelada (N vezes). */
type RecurrenceType = "recurring" | "installment";

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
  /** ISO 8601: quando foi excluída (fica na Lixeira até ser restaurada ou sumir de vez). null = não excluída. */
  deleted_at?: string | null;
  /** Conta/carteira dona da transação (texto livre, como category_id — ver database/accounts). Ausente = conta padrão. */
  account?: string;
}

/** Linha crua da tabela `accounts` — uma conta/carteira (para separar o saldo). */
export interface AccountRow {
  id: number;
  name: string;
  color: string;
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

/** Linha crua da tabela `category_budgets` — uma meta por categoria/mês/ano. */
export interface CategoryBudgetRow {
  id: number;
  category: string;
  month: string; // "01".."12"
  year: string;
  amount: number;
  /** 1 = essa meta vale também nos meses seguintes, até ser mudada ou removida (ver database/categoryBudgets). */
  repeat_monthly: number;
}

/** "lent" = você emprestou (a receber). "borrowed" = você pegou emprestado (a pagar). */
export type DebtType = "lent" | "borrowed";
type DebtStatus = "pending" | "settled";

/** Linha crua da tabela `debts` — fica fora do fluxo normal de receita/despesa até ser quitada. */
export interface DebtRow {
  id: number;
  person: string;
  amount: number;
  type: DebtType;
  description: string | null;
  date: string; // DD/MM/AAAA — data do empréstimo
  status: DebtStatus;
  settled_date: string | null; // DD/MM/AAAA — data em que foi quitada
  due_date: string | null; // DD/MM/AAAA — dia combinado pra receber/pagar
}

/** Linha crua da tabela `credit_cards`: um cartão, com os dias em que a fatura fecha e vence. */
export interface CreditCardRow {
  id: number;
  name: string;
  closing_day: number; // 1 a 31; em mês mais curto vale o último dia
  due_day: number; // 1 a 31; em mês mais curto vale o último dia
  credit_limit: number | null;
  /** Conta que paga a fatura: as despesas das compras deste cartão entram nela. Mudar vale só para compras novas. Ausente = conta padrão. */
  account?: string;
}

/**
 * Linha crua da tabela `card_purchases`: uma compra no cartão (ou uma parcela dela). Fica fora do
 * saldo até a fatura ser paga.
 */
export interface CardPurchaseRow {
  id: number;
  card_id: number;
  description: string;
  amount: number;
  date: string; // DD/MM/AAAA — data da compra; cada parcela traz a data em que foi cobrada
  category: string;
  /** Fatura em que a compra cai: AAAA-MM do mês de VENCIMENTO da fatura. Gravada na compra: mudar o dia de fechamento não mexe no que já foi lançado. */
  invoice_ref: string;
  installment_group_id: string | null;
  installment_number: number | null;
  installment_total: number | null;
  /** Despesa que essa compra gerou nas despesas do app (na data da compra). Nula para créditos (valor negativo). */
  transaction_id: number | null;
}

/** Linha crua da tabela `card_invoice_payments`: a fatura foi paga (gera uma despesa no saldo). */
export interface CardPaymentRow {
  id: number;
  card_id: number;
  invoice_ref: string; // AAAA-MM do vencimento
  paid_date: string; // DD/MM/AAAA
  amount: number;
  /** A despesa criada no saldo por este pagamento (null se foi apagada à mão). */
  transaction_id: number | null;
}

/** Linha crua da tabela `savings_goals` — meta de economia, separada do saldo. */
export interface SavingsGoalRow {
  id: number;
  name: string;
  target_amount: number;
  saved_amount: number;
  deadline: string | null; // DD/MM/AAAA
  created_date: string; // DD/MM/AAAA
  /** Quanto já estava guardado quando a meta foi criada: não conta como ritmo na projeção. */
  start_amount: number;
}

export type SubscriptionCycle = "monthly" | "yearly";

/**
 * Linha crua da tabela `subscriptions` — uma assinatura recorrente (streaming, academia, software...). É só o controle do
 * que você paga: não cria despesas (as cobranças entram pelo cartão ou pelo extrato).
 */
export interface SubscriptionRow {
  id: number;
  name: string;
  amount: number;
  cycle: SubscriptionCycle;
  billing_day: number; // 1–31
  billing_month: number | null; // 1–12, só nas anuais
  category: string;
  /** Texto que aparece nas cobranças (ex.: "netflix"); sem ele vale o nome. Serve para achar reajustes. */
  match_text: string | null;
  active: number; // 1 = ativa, 0 = pausada/cancelada
  created_date: string; // DD/MM/AAAA
  /** Desde quando o valor atual vale (a criação ou o último reajuste): só cobranças a partir daí contam para o alerta. */
  price_since: string; // DD/MM/AAAA
  /** Valor de uma cobrança diferente que o usuário mandou ignorar. */
  ignored_amount: number | null;
}

/** Linha crua da tabela `subscription_price_changes` — cada vez que o valor de uma assinatura mudou. */
export interface SubscriptionPriceChangeRow {
  id: number;
  subscription_id: number;
  date: string; // DD/MM/AAAA
  old_amount: number;
  new_amount: number;
}

/** Rascunhos do onboarding — ficam só em memória até o usuário concluir. */
export interface RecurringDraft {
  id: string;
  type: TransactionType;
  title: string;
  amount: number;
  day: number; // dia do mês em que se repete
  category: string;
}

export interface InstallmentDraft {
  id: string;
  title: string;
  installmentAmount: number; // valor de cada parcela
  startNumber: number; // número da próxima parcela a pagar
  total: number;
  firstDate: string; // DD/MM/AAAA — data da próxima parcela
  category: string;
}

export interface DebtDraft {
  id: string;
  person: string;
  amount: number;
  type: DebtType;
  description: string | null;
  dueDate: string | null;
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
  recurrenceGroupId?: string | null;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  account?: string;
}
