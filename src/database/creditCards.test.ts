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

describe("compras no cartão", () => {
  it("grava a compra à vista e as parcelas, cada uma na sua fatura, todas de uma vez", async () => {
    const m = await load();
    const card = await newCard(m);
    const rows = planPurchase({ card, description: "Notebook", totalAmount: 3000, date: new Date(2026, 8, 21), category: "Outros", installments: 3, groupId: "g1" });

    await m.cards.addCardPurchases(rows);

    const stored = await m.cards.getAllCardPurchases();
    expect(stored.map((p) => [p.invoice_ref, p.amount, p.installment_number, p.installment_total, p.installment_group_id])).toEqual([
      ["2026-10", 1000, 1, 3, "g1"],
      ["2026-11", 1000, 2, 3, "g1"],
      ["2026-12", 1000, 3, 3, "g1"],
    ]);
  });

  it("uma compra que falha no meio não deixa parcelas pela metade (tudo ou nada)", async () => {
    const m = await load();
    const card = await newCard(m);
    const rows = planPurchase({ card, description: "X", totalAmount: 90, date: new Date(2026, 8, 21), category: "Outros", installments: 3, groupId: "g" });
    // Uma linha com card_id nulo estoura a restrição NOT NULL na terceira parcela.
    const broken = rows.map((row, index) => (index === 2 ? { ...row, card_id: null as unknown as number } : row));

    await expect(m.cards.addCardPurchases(broken)).rejects.toThrow();

    expect(await m.cards.getAllCardPurchases()).toEqual([]);
  });

  it("edita uma compra e apaga uma ou uma série inteira", async () => {
    const m = await load();
    const card = await newCard(m);
    await m.cards.addCardPurchases(planPurchase({ card, description: "Mercado", totalAmount: 50, date: new Date(2026, 8, 1), category: "Alimentação", installments: 1, groupId: "a" }));
    await m.cards.addCardPurchases(planPurchase({ card, description: "TV", totalAmount: 200, date: new Date(2026, 8, 1), category: "Outros", installments: 2, groupId: "tv" }));
    const [market] = await m.cards.getAllCardPurchases();

    await m.cards.updateCardPurchase(market.id, { description: "  Supermercado ", amount: 75.5, date: "02/09/2026", category: "Lazer", invoiceRef: "2026-10" });
    expect((await m.cards.getAllCardPurchases())[0]).toMatchObject({ description: "Supermercado", amount: 75.5, date: "02/09/2026", category: "Lazer" });

    await m.cards.deleteCardPurchaseGroup("tv");
    expect((await m.cards.getAllCardPurchases()).map((p) => p.description)).toEqual(["Supermercado"]);

    await m.cards.deleteCardPurchase(market.id);
    expect(await m.cards.getAllCardPurchases()).toEqual([]);
  });
});

describe("apagar várias compras", () => {
  it("apaga as escolhidas de uma vez e deixa as outras", async () => {
    const m = await load();
    const card = await newCard(m);
    await m.cards.addCardPurchases(planPurchase({ card, description: "TV", totalAmount: 300, date: new Date(2026, 8, 1), category: "Outros", installments: 3, groupId: "tv" }));
    const [a, b, c] = await m.cards.getAllCardPurchases();

    await m.cards.deleteCardPurchases([a.id, c.id]);

    expect((await m.cards.getAllCardPurchases()).map((p) => p.id)).toEqual([b.id]);
  });
});

describe("pagar a fatura", () => {
  const pay = (m: Modules, cardId: number, over = {}) =>
    m.cards.payInvoice({ cardId, cardName: "Nubank", ref: "2026-10", amount: 1250.5, paidDate: "05/10/2026", ...over });

  it("cria a despesa no saldo e anota o pagamento ligado a ela", async () => {
    const m = await load();
    const card = await newCard(m);

    await pay(m, card.id);

    const [expense] = await m.transactions.getAllTransactions();
    expect(expense).toMatchObject({ amount: 1250.5, date: "05/10/2026", type: "expense", category_id: "Cartão de crédito", description: "Fatura Nubank OUT/2026" });
    const [payment] = await m.cards.getAllCardPayments();
    expect(payment).toMatchObject({ card_id: card.id, invoice_ref: "2026-10", paid_date: "05/10/2026", amount: 1250.5, transaction_id: expense.id });
  });

  it("a despesa entra com a data informada (mês da fatura) e o pagamento guarda o dia em que foi feito", async () => {
    const m = await load();
    const card = await newCard(m);

    await pay(m, card.id, { paidDate: "10/09/2026", expenseDate: "28/08/2026" });

    const [expense] = await m.transactions.getAllTransactions();
    expect(expense.date).toBe("28/08/2026");
    expect((await m.cards.getAllCardPayments())[0].paid_date).toBe("10/09/2026");
  });

  it("recusa pagar a mesma fatura duas vezes, sem criar outra despesa", async () => {
    const m = await load();
    const card = await newCard(m);
    await pay(m, card.id);

    await expect(pay(m, card.id)).rejects.toThrow("Essa fatura já está paga.");

    expect(await m.transactions.getAllTransactions()).toHaveLength(1);
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
    expect(await m.transactions.getAllTransactions()).toHaveLength(3);
  });

  it("desfazer apaga o pagamento e a despesa que ele criou, e só ela", async () => {
    const m = await load();
    const card = await newCard(m);
    await m.transactions.createTransaction({ amount: 10, date: "01/10/2026", description: "Outra", type: "expense", category: "Lazer" });
    await pay(m, card.id);

    await m.cards.undoInvoicePayment(card.id, "2026-10");

    expect(await m.cards.getAllCardPayments()).toEqual([]);
    expect((await m.transactions.getAllTransactions()).map((t) => t.description)).toEqual(["Outra"]);
    // E dá para pagar de novo.
    await pay(m, card.id);
    expect(await m.cards.getAllCardPayments()).toHaveLength(1);
  });

  it("desfazer quando a despesa já foi apagada à mão ainda libera a fatura", async () => {
    const m = await load();
    const card = await newCard(m);
    await pay(m, card.id);
    const [expense] = await m.transactions.getAllTransactions();
    await m.transactions.deleteTransaction(expense.id);

    await m.cards.undoInvoicePayment(card.id, "2026-10");

    expect(await m.cards.getAllCardPayments()).toEqual([]);
  });

  it("desfazer o que não foi pago não faz nada", async () => {
    const m = await load();
    const card = await newCard(m);

    await expect(m.cards.undoInvoicePayment(card.id, "2026-10")).resolves.toBeUndefined();
  });
});

describe("limpeza dos pagamentos recebidos lançados por uma versão anterior", () => {
  it("ao abrir o banco, apaga compras de valor negativo e mantém as normais", async () => {
    const m = await load();
    const card = await newCard(m);
    await m.cards.addCardPurchases(planPurchase({ card, description: "Mercado", totalAmount: 50, date: new Date(2026, 8, 1), category: "Outros", installments: 1, groupId: "x" }));
    const db = mockState.db as { runSync: (sql: string, ...params: unknown[]) => unknown };
    db.runSync(
      "INSERT INTO card_purchases (card_id, description, amount, date, category, invoice_ref) VALUES (?, ?, ?, ?, ?, ?)",
      card.id,
      "Pagamento recebido",
      -450,
      "15/08/2026",
      "Pagamento",
      "2026-09",
    );
    expect(await m.cards.getAllCardPurchases()).toHaveLength(2);

    // Reabre o app: o banco é o mesmo, os módulos são novos.
    jest.resetModules();
    await jest.requireActual<typeof import("./sqlite")>("./sqlite").getDatabase();
    const reopened = jest.requireActual<typeof import("./creditCards")>("./creditCards");

    expect((await reopened.getAllCardPurchases()).map((p) => p.description)).toEqual(["Mercado"]);
  });
});

describe("ajuste único das datas de pagamentos antigos", () => {
  it("leva a despesa para o dia do fechamento (mês da fatura), só uma vez", async () => {
    const m = await load();
    const card = await newCard(m); // fecha 28, vence 5
    // Pagamento feito por uma versão anterior: a despesa ficou no dia do pagamento.
    await m.cards.payInvoice({ cardId: card.id, cardName: "Nubank", ref: "2026-09", amount: 500, paidDate: "10/09/2026" });

    expect(await m.cards.alignCardPaymentDates()).toBe(1);

    const [expense] = await m.transactions.getAllTransactions();
    expect(expense.date).toBe("28/08/2026");
    expect((await m.cards.getAllCardPayments())[0].paid_date).toBe("10/09/2026");
    expect(await m.cards.alignCardPaymentDates()).toBe(0);
  });

  it("não mexe numa despesa cuja data o usuário já editou", async () => {
    const m = await load();
    const card = await newCard(m);
    await m.cards.payInvoice({ cardId: card.id, cardName: "Nubank", ref: "2026-09", amount: 500, paidDate: "10/09/2026" });
    const [expense] = await m.transactions.getAllTransactions();
    await m.transactions.updateTransaction(expense.id, { amount: 500, date: "15/09/2026", description: "Fatura Nubank SET/2026", type: "expense", category: "Cartão de crédito" });

    expect(await m.cards.alignCardPaymentDates()).toBe(0);

    expect((await m.transactions.getAllTransactions())[0].date).toBe("15/09/2026");
  });

  it("pagamento já lançado no mês certo não muda", async () => {
    const m = await load();
    const card = await newCard(m);
    await m.cards.payInvoice({ cardId: card.id, cardName: "Nubank", ref: "2026-09", amount: 500, paidDate: "28/08/2026" });

    expect(await m.cards.alignCardPaymentDates()).toBe(0);
  });
});

describe("apagar cartão e zerar", () => {
  it("apaga o cartão, as compras e os pagamentos dele, mas a despesa do pagamento fica no saldo", async () => {
    const m = await load();
    const a = await newCard(m);
    const b = await newCard(m, { name: "Inter" });
    for (const card of [a, b]) {
      await m.cards.addCardPurchases(planPurchase({ card, description: "Compra", totalAmount: 10, date: new Date(2026, 8, 1), category: "Outros", installments: 1, groupId: "x" }));
    }
    await m.cards.payInvoice({ cardId: a.id, cardName: "Nubank", ref: "2026-10", amount: 10, paidDate: "05/10/2026" });

    await m.cards.deleteCreditCard(a.id);

    expect((await m.cards.getAllCreditCards()).map((c) => c.name)).toEqual(["Inter"]);
    expect((await m.cards.getAllCardPurchases()).map((p) => p.card_id)).toEqual([b.id]);
    expect(await m.cards.getAllCardPayments()).toEqual([]);
    expect(await m.transactions.getAllTransactions()).toHaveLength(1); // o dinheiro saiu de verdade
  });

  it("zerar os dados do app apaga os cartões, as compras e os pagamentos", async () => {
    const m = await load();
    const card = await newCard(m);
    await m.cards.addCardPurchases(planPurchase({ card, description: "Compra", totalAmount: 10, date: new Date(2026, 8, 1), category: "Outros", installments: 1, groupId: "x" }));
    await m.cards.payInvoice({ cardId: card.id, cardName: "Nubank", ref: "2026-10", amount: 10, paidDate: "05/10/2026" });

    await m.sqlite.resetDatabase();

    expect(await m.cards.getAllCreditCards()).toEqual([]);
    expect(await m.cards.getAllCardPurchases()).toEqual([]);
    expect(await m.cards.getAllCardPayments()).toEqual([]);
  });
});
