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
    },
  ],
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
    });
  });

  it("describeRestore compara o backup com o que há no app e avisa que substitui", () => {
    const text = describeRestore(
      { transactions: 2, categories: 0, budgets: 0, categoryBudgets: 0, debts: 0, savingsGoals: 3 },
      buildBackupFile(DATA, NOW),
    );
    expect(text).toContain("Backup de 19/09/2026: 1 transação, 1 dívida, 1 meta de economia, 1 categoria própria.");
    expect(text).toContain("Agora no app: 2 transações, 0 dívidas, 3 metas de economia, 0 categorias próprias.");
    expect(text).toContain("SUBSTITUI");
  });
});
