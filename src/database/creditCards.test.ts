import { createSqlJsDatabase } from "../test/sqliteFake";
import { planPurchase } from "../utils/creditCards";

// Banco de verdade em memória no lugar do expo-sqlite.
const mockState: { db: unknown } = { db: null };
jest.mock("expo-sqlite", () => ({
  openDatabaseSync: () => mockState.db,
}));

async function load() {
  jest.resetModules();
  mockState.db = await createSqlJsDatabase();
  const sqlite = jest.requireActual<typeof import("./sqlite")>("./sqlite");
  await sqlite.resetDatabase();
  return {
    cards: jest.requireActual<typeof import("./creditCards")>("./creditCards"),
    transactions: jest.requireActual<typeof import("./transactions")>("./transactions"),
    sqlite,
    db: mockState.db,
  };
}

type Modules = Awaited<ReturnType<typeof load>>;

async function newCard(m: Modules, over: Partial<Parameters<Modules["cards"]["createCreditCard"]>[0]> = {}) {
  const id = await m.cards.createCreditCard({ name: "Nubank", closingDay: 28, dueDay: 5, limit: 5000, ...over });
  const [card] = (await m.cards.getAllCreditCards()).filter((row) => row.id === id);
  return card;
}

describe("cartões", () => {
  it("cria, lê e edita um cartão (o nome perde os espaços das pontas)", async () => {
    const m = await load();

    const id = await m.cards.createCreditCard({ name: "  Nubank  ", closingDay: 28, dueDay: 5, limit: null });
    expect(await m.cards.getAllCreditCards()).toEqual([{ id, name: "Nubank", closing_day: 28, due_day: 5, credit_limit: null }]);

    await m.cards.updateCreditCard(id, { name: "Nubank Ultravioleta", closingDay: 10, dueDay: 17, limit: 8000 });
    expect((await m.cards.getAllCreditCards())[0]).toMatchObject({ name: "Nubank Ultravioleta", closing_day: 10, due_day: 17, credit_limit: 8000 });
  });

  it("os ids são novos a cada cartão", async () => {
    const m = await load();

    const a = await m.cards.createCreditCard({ name: "A", closingDay: 1, dueDay: 10, limit: null });
    const b = await m.cards.createCreditCard({ name: "B", closingDay: 1, dueDay: 10, limit: null });

    expect(b).toBeGreaterThan(a);
  });
});

describe("compras no cartão viram despesas", () => {
  const expenses = async (m: Modules) => (await m.transactions.getAllTransactions()).slice().reverse();

  it("a compra à vista vira uma despesa na data da compra, com a categoria dela", async () => {
    const m = await load();
    const card = await newCard(m);

    await m.cards.addCardPurchases(planPurchase({ card, description: "Mercado", totalAmount: 80.5, date: new Date(2026, 7, 12), category: "Alimentação", installments: 1, groupId: "a" }));

    const [expense] = await m.transactions.getAllTransactions();
    expect(expense).toMatchObject({ amount: 80.5, date: "12/08/2026", description: "Mercado", type: "expense", category_id: "Alimentação" });
    const [purchase] = await m.cards.getAllCardPurchases();
    expect(purchase.transaction_id).toBe(expense.id);
  });

  it("cada parcela é uma despesa, na data em que é cobrada (mês a mês)", async () => {
    const m = await load();
    const card = await newCard(m); // fecha 28, vence 5
    const rows = planPurchase({ card, description: "Notebook", totalAmount: 3000, date: new Date(2026, 8, 21), category: "Outros", installments: 3, groupId: "g1" });

    await m.cards.addCardPurchases(rows);

    const stored = await m.cards.getAllCardPurchases();
    expect(stored.map((p) => [p.invoice_ref, p.amount, p.installment_number, p.installment_total, p.installment_group_id])).toEqual([
      ["2026-10", 1000, 1, 3, "g1"],
      ["2026-11", 1000, 2, 3, "g1"],
      ["2026-12", 1000, 3, 3, "g1"],
    ]);
    expect((await expenses(m)).map((t) => [t.description, t.date, t.amount])).toEqual([
      ["Notebook (1/3)", "21/09/2026", 1000],
      ["Notebook (2/3)", "21/10/2026", 1000],
      ["Notebook (3/3)", "21/11/2026", 1000],
    ]);
    expect(stored.map((p) => p.transaction_id)).toEqual((await expenses(m)).map((t) => t.id));
  });

  it("crédito da fatura (valor negativo) não vira despesa nem receita", async () => {
    const m = await load();
    const card = await newCard(m);

    await m.cards.addCardPurchases([
      { card_id: card.id, description: "Pagamento recebido", amount: -450, date: "15/08/2026", category: "Crédito na fatura", invoice_ref: "2026-09", installment_group_id: null, installment_number: null, installment_total: null },
    ]);

    expect(await m.transactions.getAllTransactions()).toEqual([]);
    expect((await m.cards.getAllCardPurchases())[0]).toMatchObject({ amount: -450, transaction_id: null });
  });

  it("uma compra que falha no meio não deixa parcelas nem despesas pela metade (tudo ou nada)", async () => {
    const m = await load();
    const card = await newCard(m);
    const rows = planPurchase({ card, description: "X", totalAmount: 90, date: new Date(2026, 8, 21), category: "Outros", installments: 3, groupId: "g" });
    // Uma linha com cartão inexistente estoura na terceira parcela.
    const broken = rows.map((row, index) => (index === 2 ? { ...row, card_id: 999 } : row));

    await expect(m.cards.addCardPurchases(broken)).rejects.toThrow();

    expect(await m.cards.getAllCardPurchases()).toEqual([]);
    expect(await m.transactions.getAllTransactions()).toEqual([]);
  });

  it("editar a compra muda a despesa dela junto", async () => {
    const m = await load();
    const card = await newCard(m);
    await m.cards.addCardPurchases(planPurchase({ card, description: "Mercado", totalAmount: 50, date: new Date(2026, 8, 1), category: "Alimentação", installments: 1, groupId: "a" }));
    const [market] = await m.cards.getAllCardPurchases();

    await m.cards.updateCardPurchase(market.id, { description: "  Supermercado ", amount: 75.5, date: "02/09/2026", category: "Lazer", invoiceRef: "2026-10" });

    expect((await m.cards.getAllCardPurchases())[0]).toMatchObject({ description: "Supermercado", amount: 75.5, date: "02/09/2026", category: "Lazer" });
    expect((await m.transactions.getAllTransactions())[0]).toMatchObject({ description: "Supermercado", amount: 75.5, date: "02/09/2026", category_id: "Lazer" });
  });

  it("apagar uma compra, uma série ou várias tira as despesas delas, e só delas", async () => {
    const m = await load();
    const card = await newCard(m);
    await m.transactions.createTransaction({ amount: 10, date: "01/09/2026", description: "Outra", type: "expense", category: "Lazer" });
    await m.cards.addCardPurchases(planPurchase({ card, description: "Mercado", totalAmount: 50, date: new Date(2026, 8, 1), category: "Alimentação", installments: 1, groupId: "a" }));
    await m.cards.addCardPurchases(planPurchase({ card, description: "TV", totalAmount: 200, date: new Date(2026, 8, 1), category: "Outros", installments: 2, groupId: "tv" }));
    await m.cards.addCardPurchases(planPurchase({ card, description: "Sofá", totalAmount: 300, date: new Date(2026, 8, 1), category: "Moradia", installments: 3, groupId: "sofa" }));
    const all = await m.cards.getAllCardPurchases();
    const market = all.find((p) => p.description === "Mercado")!;
    const sofa = all.filter((p) => p.description === "Sofá");

    await m.cards.deleteCardPurchaseGroup("tv");
    expect((await m.transactions.getAllTransactions()).map((t) => t.description).sort()).toEqual(["Mercado", "Outra", "Sofá (1/3)", "Sofá (2/3)", "Sofá (3/3)"]);

    await m.cards.deleteCardPurchases([sofa[0].id, sofa[2].id]);
    expect((await m.transactions.getAllTransactions()).map((t) => t.description).sort()).toEqual(["Mercado", "Outra", "Sofá (2/3)"]);

    await m.cards.deleteCardPurchase(market.id);
    expect((await m.transactions.getAllTransactions()).map((t) => t.description).sort()).toEqual(["Outra", "Sofá (2/3)"]);
    expect((await m.cards.getAllCardPurchases()).map((p) => p.description)).toEqual(["Sofá"]);
  });
});

describe("pagar a fatura", () => {
  const pay = (m: Modules, cardId: number, over = {}) => m.cards.payInvoice({ cardId, ref: "2026-10", amount: 1250.5, paidDate: "05/10/2026", ...over });

  it("só marca a fatura como paga: não cria outra despesa (o gasto já foi contado nas compras)", async () => {
    const m = await load();
    const card = await newCard(m);
    await m.cards.addCardPurchases(planPurchase({ card, description: "TV", totalAmount: 1250.5, date: new Date(2026, 8, 21), category: "Outros", installments: 1, groupId: "g" }));

    await pay(m, card.id);

    expect(await m.transactions.getAllTransactions()).toHaveLength(1); // só a despesa da compra
    const [payment] = await m.cards.getAllCardPayments();
    expect(payment).toMatchObject({ card_id: card.id, invoice_ref: "2026-10", paid_date: "05/10/2026", amount: 1250.5, transaction_id: null });
  });

  it("recusa pagar a mesma fatura duas vezes", async () => {
    const m = await load();
    const card = await newCard(m);
    await pay(m, card.id);

    await expect(pay(m, card.id)).rejects.toThrow("Essa fatura já está paga.");

    expect(await m.cards.getAllCardPayments()).toHaveLength(1);
  });

  it("faturas diferentes ou de outro cartão pagam de forma independente", async () => {
    const m = await load();
    const a = await newCard(m);
    const b = await newCard(m, { name: "Inter" });

    await pay(m, a.id);
    await pay(m, a.id, { ref: "2026-11" });
    await pay(m, b.id);

    expect(await m.cards.getAllCardPayments()).toHaveLength(3);
  });

  it("desfazer apaga só o registro do pagamento: as despesas não mudam, e dá para pagar de novo", async () => {
    const m = await load();
    const card = await newCard(m);
    await m.cards.addCardPurchases(planPurchase({ card, description: "TV", totalAmount: 100, date: new Date(2026, 8, 21), category: "Outros", installments: 1, groupId: "g" }));
    await pay(m, card.id);

    await m.cards.undoInvoicePayment(card.id, "2026-10");

    expect(await m.cards.getAllCardPayments()).toEqual([]);
    expect(await m.transactions.getAllTransactions()).toHaveLength(1);
    await pay(m, card.id);
    expect(await m.cards.getAllCardPayments()).toHaveLength(1);
  });

  it("desfazer o que não foi pago não faz nada", async () => {
    const m = await load();
    const card = await newCard(m);

    await expect(m.cards.undoInvoicePayment(card.id, "2026-10")).resolves.toBeUndefined();
  });
});

describe("conciliação das compras do cartão com as despesas", () => {
  const rawDb = (m: Modules) => m.db as unknown as { runSync: (sql: string, ...params: unknown[]) => { lastInsertRowId: number } };

  it("compra sem despesa (lançada antes desta regra) ganha a dela, uma vez só", async () => {
    const m = await load();
    const card = await newCard(m);
    rawDb(m).runSync(
      "INSERT INTO card_purchases (card_id, description, amount, date, category, invoice_ref, installment_group_id, installment_number, installment_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      card.id, "Notebook", 300, "10/08/2026", "Outros", "2026-10", "g", 2, 5,
    );

    expect(await m.cards.reconcileCardTransactions()).toBe(1);

    const [expense] = await m.transactions.getAllTransactions();
    expect(expense).toMatchObject({ amount: 300, description: "Notebook (2/5)", category_id: "Outros", date: "10/08/2026" });
    expect((await m.cards.getAllCardPurchases())[0].transaction_id).toBe(expense.id);
    expect(await m.cards.reconcileCardTransactions()).toBe(0);
  });

  it("o pagamento de fatura de uma versão anterior perde a despesa própria (senão o gasto contaria em dobro)", async () => {
    const m = await load();
    const card = await newCard(m);
    await m.cards.addCardPurchases(planPurchase({ card, description: "TV", totalAmount: 500, date: new Date(2026, 8, 1), category: "Outros", installments: 1, groupId: "g" }));
    const db = rawDb(m);
    const legacy = db.runSync("INSERT INTO transactions (amount, date, description, type, category_id) VALUES (?, ?, ?, 'expense', ?)", 500, "05/10/2026", "Fatura Nubank OUT/2026", "Cartão de crédito");
    db.runSync("INSERT INTO card_invoice_payments (card_id, invoice_ref, paid_date, amount, transaction_id) VALUES (?, ?, ?, ?, ?)", card.id, "2026-10", "05/10/2026", 500, legacy.lastInsertRowId);

    expect(await m.cards.reconcileCardTransactions()).toBe(1);

    expect((await m.transactions.getAllTransactions()).map((t) => t.description)).toEqual(["TV"]);
    expect((await m.cards.getAllCardPayments())[0]).toMatchObject({ invoice_ref: "2026-10", transaction_id: null });
  });

  it("compra cuja despesa não existe mais sai do cartão", async () => {
    const m = await load();
    const card = await newCard(m);
    rawDb(m).runSync(
      "INSERT INTO card_purchases (card_id, description, amount, date, category, invoice_ref, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      card.id, "Fantasma", 10, "10/08/2026", "Outros", "2026-09", 12345,
    );

    expect(await m.cards.reconcileCardTransactions()).toBe(1);

    expect(await m.cards.getAllCardPurchases()).toEqual([]);
  });

  describe("ajuste único da data das parcelas (antes iam para o dia do fechamento)", () => {
    const seed = (m: Modules, cardId: number, group: string, n: number, date: string, ref: string, expenseDate: string) => {
      const db = rawDb(m);
      const expense = db.runSync("INSERT INTO transactions (amount, date, description, type, category_id) VALUES (?, ?, ?, 'expense', ?)", 50, expenseDate, `X (${n}/3)`, "Outros");
      db.runSync(
        "INSERT INTO card_purchases (card_id, description, amount, date, category, invoice_ref, installment_group_id, installment_number, installment_total, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        cardId, "X", 50, date, "Outros", ref, group, n, 3, expense.lastInsertRowId,
      );
    };

    it("parcela importada volta para a data do arquivo; a lançada à mão vai para a compra mais um mês por parcela", async () => {
      const m = await load();
      const card = await newCard(m); // fecha 28, vence 5: a fatura 2026-09 fechou em 28/08
      seed(m, card.id, "imp-1-x-5000-3", 2, "08/08/2026", "2026-09", "28/08/2026");
      seed(m, card.id, "manual", 2, "10/07/2026", "2026-09", "28/08/2026");

      expect(await m.cards.reconcileCardTransactions()).toBe(2);

      const dates = (await m.transactions.getAllTransactions()).map((t) => t.date).sort();
      expect(dates).toEqual(["08/08/2026", "10/08/2026"]);
      expect(await m.cards.reconcileCardTransactions()).toBe(0);
    });

    it("não mexe numa despesa cuja data o usuário já editou", async () => {
      const m = await load();
      const card = await newCard(m);
      seed(m, card.id, "imp-1-x-5000-3", 2, "08/08/2026", "2026-09", "15/08/2026");

      expect(await m.cards.reconcileCardTransactions()).toBe(0);

      expect((await m.transactions.getAllTransactions())[0].date).toBe("15/08/2026");
    });
  });

  it("créditos (valor negativo) não ganham despesa", async () => {
    const m = await load();
    const card = await newCard(m);
    rawDb(m).runSync(
      "INSERT INTO card_purchases (card_id, description, amount, date, category, invoice_ref) VALUES (?, ?, ?, ?, ?, ?)",
      card.id, "Pagamento recebido", -450, "15/08/2026", "Crédito na fatura", "2026-09",
    );

    expect(await m.cards.reconcileCardTransactions()).toBe(0);

    expect(await m.transactions.getAllTransactions()).toEqual([]);
  });
});

describe("despesas e compras andam juntas (Histórico)", () => {
  async function withPurchase() {
    const m = await load();
    const card = await newCard(m);
    await m.cards.addCardPurchases(planPurchase({ card, description: "Mercado", totalAmount: 50, date: new Date(2026, 8, 1), category: "Alimentação", installments: 1, groupId: "a" }));
    const [expense] = await m.transactions.getAllTransactions();
    return { m, card, expense };
  }

  it("apagar a despesa no Histórico tira a compra do cartão", async () => {
    const { m, expense } = await withPurchase();

    await m.transactions.deleteTransaction(expense.id);

    expect(await m.cards.getAllCardPurchases()).toEqual([]);
  });

  it("apagar o mês inteiro no Histórico também", async () => {
    const { m } = await withPurchase();

    await m.transactions.deleteTransactionsByMonth("09", "2026");

    expect(await m.cards.getAllCardPurchases()).toEqual([]);
  });

  it("editar a despesa no Histórico muda a compra", async () => {
    const { m, expense } = await withPurchase();

    await m.transactions.updateTransaction(expense.id, { amount: 65, date: "03/09/2026", description: "Feira", type: "expense", category: "Lazer" });

    expect((await m.cards.getAllCardPurchases())[0]).toMatchObject({ amount: 65, date: "03/09/2026", description: "Feira", category: "Lazer" });
  });

  it("mexer numa despesa comum não toca nas compras do cartão", async () => {
    const { m } = await withPurchase();
    await m.transactions.createTransaction({ amount: 10, date: "01/09/2026", description: "Outra", type: "expense", category: "Lazer" });
    const outra = (await m.transactions.getAllTransactions()).find((t) => t.description === "Outra")!;

    await m.transactions.deleteTransaction(outra.id);

    expect(await m.cards.getAllCardPurchases()).toHaveLength(1);
  });
});

describe("apagar cartão e zerar", () => {
  it("apaga o cartão, as compras e os pagamentos dele, e as despesas dessas compras", async () => {
    const m = await load();
    const a = await newCard(m);
    const b = await newCard(m, { name: "Inter" });
    await m.transactions.createTransaction({ amount: 10, date: "01/09/2026", description: "Outra", type: "expense", category: "Lazer" });
    for (const card of [a, b]) {
      await m.cards.addCardPurchases(planPurchase({ card, description: `Compra ${card.name}`, totalAmount: 10, date: new Date(2026, 8, 1), category: "Outros", installments: 1, groupId: "x" }));
    }
    await m.cards.payInvoice({ cardId: a.id, ref: "2026-10", amount: 10, paidDate: "05/10/2026" });

    await m.cards.deleteCreditCard(a.id);

    expect((await m.cards.getAllCreditCards()).map((c) => c.name)).toEqual(["Inter"]);
    expect((await m.cards.getAllCardPurchases()).map((p) => p.card_id)).toEqual([b.id]);
    expect(await m.cards.getAllCardPayments()).toEqual([]);
    expect((await m.transactions.getAllTransactions()).map((t) => t.description).sort()).toEqual(["Compra Inter", "Outra"]);
  });

  it("zerar os dados do app apaga os cartões, as compras e os pagamentos", async () => {
    const m = await load();
    const card = await newCard(m);
    await m.cards.addCardPurchases(planPurchase({ card, description: "Compra", totalAmount: 10, date: new Date(2026, 8, 1), category: "Outros", installments: 1, groupId: "x" }));
    await m.cards.payInvoice({ cardId: card.id, ref: "2026-10", amount: 10, paidDate: "05/10/2026" });

    await m.sqlite.resetDatabase();

    expect(await m.cards.getAllCreditCards()).toEqual([]);
    expect(await m.cards.getAllCardPurchases()).toEqual([]);
    expect(await m.cards.getAllCardPayments()).toEqual([]);
  });
});
