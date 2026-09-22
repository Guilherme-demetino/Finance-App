import {
  backupFileName,
  BACKUP_VERSION,
  buildBackupFile,
  countBackup,
  describeRestore,
  parseBackup,
  serializeBackup,
  type BackupData,
} from "./backup";

const DATA: BackupData = {
  userName: "Ana",
  categories: [{ id: 1, name: "Pets", color: "#111111", type: "expense" }],
  transactions: [
    {
      id: 1,
      amount: 10.5,
      date: "05/09/2026",
      description: "Padaria",
      type: "expense",
      category_id: "Alimentação",
      recurrence_group_id: null,
      recurrence_type: null,
      installment_number: null,
      installment_total: null,
    },
  ],
  budgets: [{ id: 1, month: "09", year: "2026", amount: 100 }],
  categoryBudgets: [{ id: 1, category: "Pets", month: "09", year: "2026", amount: 20 }],
  debts: [
    {
      id: 1,
      person: "Bia",
      amount: 5,
      type: "borrowed",
      description: null,
      date: "01/09/2026",
      status: "settled",
      settled_date: "02/09/2026",
      due_date: null,
    },
  ],
  savingsGoals: [
    {
      id: 1,
      name: "Viagem",
      target_amount: 1000,
      saved_amount: 10,
      deadline: null,
      created_date: "01/09/2026",
      start_amount: 0,
    },
  ],
  creditCards: [{ id: 1, name: "Nubank", closing_day: 28, due_day: 5, credit_limit: 5000 }],
  cardPurchases: [
    {
      id: 1,
      card_id: 1,
      description: "Notebook (1/2)",
      amount: 1500,
      date: "10/09/2026",
      category: "Outros",
      invoice_ref: "2026-10",
      installment_group_id: "g1",
      installment_number: 1,
      installment_total: 2,
      transaction_id: 1,
    },
  ],
  cardPayments: [{ id: 1, card_id: 1, invoice_ref: "2026-09", paid_date: "05/09/2026", amount: 300, transaction_id: null }],
  subscriptions: [{ id: 1, name: "Netflix", amount: 39.9, cycle: "monthly", billing_day: 5, billing_month: null, category: "Lazer", match_text: "netflix", active: 1, created_date: "01/08/2026", price_since: "10/09/2026", ignored_amount: null }],
  subscriptionPriceChanges: [{ id: 1, subscription_id: 1, date: "10/09/2026", old_amount: 34.9, new_amount: 39.9 }],
};

const NOW = new Date(2026, 8, 19, 20, 30);

/** Um backup válido como objeto simples, para mexer nos campos e ver a validação reagir. */
function raw(): any {
  return JSON.parse(serializeBackup(buildBackupFile(DATA, NOW)));
}
const parse = (value: unknown) => parseBackup(JSON.stringify(value));

describe("parseBackup", () => {
  it("lê de volta o que foi serializado", () => {
    const result = parseBackup(serializeBackup(buildBackupFile(DATA, NOW)));
    expect(result).toEqual({ ok: true, backup: buildBackupFile(DATA, NOW) });
  });

  it("recusa o que não é JSON e o que não é um backup", () => {
    expect(parseBackup("isso não é json")).toMatchObject({ ok: false });
    expect(parse({ format: "outra-coisa", version: 1 })).toMatchObject({
      ok: false,
      error: "Esse arquivo não é um backup do Meu Financeiro.",
    });
    expect(parse([1, 2, 3])).toMatchObject({ ok: false });
    expect(parse(null)).toMatchObject({ ok: false });
  });

  it("recusa backup de uma versão mais nova do app", () => {
    const file = raw();
    file.version = BACKUP_VERSION + 1;
    expect(parse(file)).toMatchObject({
      ok: false,
      error: expect.stringContaining("versão mais nova"),
    });
  });

  it("recusa data de criação inválida", () => {
    const file = raw();
    file.createdAt = "ontem";
    expect(parse(file)).toMatchObject({ ok: false });
  });

  it("recusa lista ausente", () => {
    const file = raw();
    delete file.data.transactions;
    expect(parse(file)).toMatchObject({
      ok: false,
      error: 'Backup inválido: falta a lista "transações".',
    });
  });

  it.each([
    ["valor que não é número", (f: any) => (f.data.transactions[0].amount = "10")],
    ["data fora do formato", (f: any) => (f.data.transactions[0].date = "2026-09-05")],
    ["tipo desconhecido", (f: any) => (f.data.transactions[0].type = "transfer")],
    ["id repetido", (f: any) => f.data.transactions.push({ ...f.data.transactions[0] })],
    ["categoria sem nome", (f: any) => (f.data.categories[0].name = "  ")],
    ["mês inválido no orçamento", (f: any) => (f.data.budgets[0].month = "9")],
    ["orçamento repetido no mesmo mês", (f: any) => f.data.budgets.push({ ...f.data.budgets[0], id: 2 })],
    ["dívida com situação estranha", (f: any) => (f.data.debts[0].status = "paga")],
    ["meta com valor inválido", (f: any) => (f.data.savingsGoals[0].target_amount = null)],
    ["nome de usuário inválido", (f: any) => (f.data.userName = 5)],
    ["cartão com dia de fechamento 0", (f: any) => (f.data.creditCards[0].closing_day = 0)],
    ["cartão com dia de vencimento 32", (f: any) => (f.data.creditCards[0].due_day = 32)],
    ["cartão sem nome", (f: any) => (f.data.creditCards[0].name = " ")],
    ["cartão com limite inválido", (f: any) => (f.data.creditCards[0].credit_limit = "5000")],
    ["compra de um cartão que não existe", (f: any) => (f.data.cardPurchases[0].card_id = 99)],
    ["compra com fatura mal escrita", (f: any) => (f.data.cardPurchases[0].invoice_ref = "2026-13")],
    ["compra com data fora do formato", (f: any) => (f.data.cardPurchases[0].date = "2026-09-10")],
    ["pagamento de um cartão que não existe", (f: any) => (f.data.cardPayments[0].card_id = 99)],
    ["a mesma fatura paga duas vezes", (f: any) => f.data.cardPayments.push({ ...f.data.cardPayments[0], id: 2 })],
    ["lista de cartões que não é lista", (f: any) => (f.data.creditCards = {})],
    ["assinatura sem valor", (f: any) => (f.data.subscriptions[0].amount = 0)],
    ["assinatura com ciclo desconhecido", (f: any) => (f.data.subscriptions[0].cycle = "semanal")],
    ["assinatura com dia de cobrança 0", (f: any) => (f.data.subscriptions[0].billing_day = 0)],
    ["assinatura anual sem mês", (f: any) => Object.assign(f.data.subscriptions[0], { cycle: "yearly", billing_month: null })],
    ["assinatura com situação inválida", (f: any) => (f.data.subscriptions[0].active = 2)],
    ["reajuste de uma assinatura que não existe", (f: any) => (f.data.subscriptionPriceChanges[0].subscription_id = 99)],
    ["reajuste com data fora do formato", (f: any) => (f.data.subscriptionPriceChanges[0].date = "2026-09-10")],
  ])("recusa %s", (_name, mutate) => {
    const file = raw();
    mutate(file);
    const result = parse(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Backup inválido");
  });

  it("aponta a tabela e o item com problema", () => {
    const file = raw();
    file.data.debts[0].amount = "x";
    expect(parse(file)).toEqual({
      ok: false,
      error: "Backup inválido: dívidas, item 1 (valor).",
    });
  });

  it("aceita backup de metas sem o valor inicial (versão antiga) e recusa valor inicial inválido", () => {
    const old = raw();
    delete old.data.savingsGoals[0].start_amount;
    expect(parse(old).ok).toBe(true);

    const bad = raw();
    bad.data.savingsGoals[0].start_amount = "muito";
    expect(parse(bad)).toEqual({ ok: false, error: "Backup inválido: metas de economia, item 1 (valor inicial)." });
  });

  it("aceita backup das versões antigas, sem assinaturas: leem como listas vazias", () => {
    const file = raw();
    file.version = 2;
    delete file.data.subscriptions;
    delete file.data.subscriptionPriceChanges;

    const result = parse(file);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.data.subscriptions).toEqual([]);
      expect(result.backup.data.subscriptionPriceChanges).toEqual([]);
    }
  });

  it("aceita backup da versão 1, sem cartões: as listas de cartão leem como vazias", () => {
    const file = raw();
    file.version = 1;
    delete file.data.creditCards;
    delete file.data.cardPurchases;
    delete file.data.cardPayments;

    const result = parse(file);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.data.creditCards).toEqual([]);
      expect(result.backup.data.cardPurchases).toEqual([]);
      expect(result.backup.data.cardPayments).toEqual([]);
    }
  });

  it("aceita backup sem nome (null) e listas vazias", () => {
    const empty: BackupData = {
      userName: null,
      categories: [],
      transactions: [],
      budgets: [],
      categoryBudgets: [],
      debts: [],
      savingsGoals: [],
    };
    expect(parseBackup(serializeBackup(buildBackupFile(empty, NOW))).ok).toBe(true);
  });
});

describe("nome do arquivo e textos", () => {
  it("backupFileName usa a data local", () => {
    expect(backupFileName(NOW)).toBe("meu-financeiro-backup-2026-09-19.json");
  });

  it("countBackup conta cada tabela", () => {
    expect(countBackup(DATA)).toEqual({
      transactions: 1,
      categories: 1,
      budgets: 1,
      categoryBudgets: 1,
      debts: 1,
      savingsGoals: 1,
      creditCards: 1,
      cardPurchases: 1,
      subscriptions: 1,
    });
  });

  it("describeRestore compara o backup com o que há no app e avisa que substitui", () => {
    const text = describeRestore(
      { transactions: 2, categories: 0, budgets: 0, categoryBudgets: 0, debts: 0, savingsGoals: 3, creditCards: 0, cardPurchases: 0, subscriptions: 0 },
      buildBackupFile(DATA, NOW),
    );
    expect(text).toContain("Backup de 19/09/2026: 1 transação, 1 dívida, 1 meta de economia, 1 categoria própria, 1 cartão, 1 compra no cartão, 1 assinatura.");
    expect(text).toContain("Agora no app: 2 transações, 0 dívidas, 3 metas de economia, 0 categorias próprias.");
    // Quem não usa cartão não vê o assunto no texto.
    expect(text).not.toContain("0 cartões");
    expect(text).toContain("SUBSTITUI");
  });
});
