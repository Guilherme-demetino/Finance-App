import type { CardPaymentRow, CardPurchaseRow, CreditCardRow } from "../types";
import {
  addMonthsToRef,
  buildInvoice,
  cardUsage,
  currentInvoiceRef,
  formatRef,
  invoiceDates,
  purchaseExpenseDescription,
  invoiceRefFor,
  invoiceStatus,
  listInvoices,
  parseRef,
  planPurchase,
  purchaseBlockedByPayment,
  refOf,
  unpaidInvoiceDues,
  validateCard,
  validatePurchase,
} from "./creditCards";
import { formatDateToString } from "./dates";

const card = (over: Partial<CreditCardRow> = {}): CreditCardRow => ({
  id: 1,
  name: "Nubank",
  closing_day: 28,
  due_day: 5,
  credit_limit: null,
  ...over,
});

let nextId = 1;
const purchase = (over: Partial<CardPurchaseRow> = {}): CardPurchaseRow => ({
  id: nextId++,
  card_id: 1,
  description: "Compra",
  amount: 100,
  date: "10/09/2026",
  category: "Alimentação",
  invoice_ref: "2026-10",
  installment_group_id: null,
  installment_number: null,
  installment_total: null,
  transaction_id: null,
  ...over,
});

const payment = (over: Partial<CardPaymentRow> = {}): CardPaymentRow => ({
  id: nextId++,
  card_id: 1,
  invoice_ref: "2026-10",
  paid_date: "05/10/2026",
  amount: 100,
  transaction_id: 9,
  ...over,
});

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const fmt = (date: Date) => formatDateToString(date);

describe("referência AAAA-MM", () => {
  it("monta, lê e soma meses, virando o ano", () => {
    expect(refOf(2026, 9)).toBe("2026-10");
    expect(refOf(2026, 12)).toBe("2027-01"); // mês além de dezembro
    expect(refOf(2026, -1)).toBe("2025-12");
    expect(parseRef("2026-10")).toEqual({ year: 2026, monthIndex: 9 });
    for (const bad of ["2026-13", "2026-00", "26-10", "2026/10", "", "2026-1"]) expect(parseRef(bad)).toBeNull();
    expect(addMonthsToRef("2026-11", 3)).toBe("2027-02");
    expect(addMonthsToRef("2026-03", -3)).toBe("2025-12");
  });

  it("rótulo curto do mês e do ano", () => {
    expect(formatRef("2026-10")).toBe("OUT/2026");
    expect(formatRef("2027-01")).toBe("JAN/2027");
    expect(formatRef("lixo")).toBe("lixo");
  });
});

describe("em que fatura cai a compra", () => {
  const c = card({ closing_day: 28, due_day: 5 }); // fecha dia 28, vence dia 5 do mês seguinte

  it("até o dia do fechamento (inclusive) vai para a fatura que fecha neste mês", () => {
    expect(invoiceRefFor(day(2026, 9, 10), c)).toBe("2026-10");
    expect(invoiceRefFor(day(2026, 9, 28), c)).toBe("2026-10");
  });

  it("depois do fechamento vai para a fatura do mês seguinte", () => {
    expect(invoiceRefFor(day(2026, 9, 29), c)).toBe("2026-11");
    expect(invoiceRefFor(day(2026, 9, 30), c)).toBe("2026-11");
  });

  it("vencimento maior que o fechamento fica no mesmo mês do fechamento", () => {
    const early = card({ closing_day: 5, due_day: 15 });

    expect(invoiceRefFor(day(2026, 9, 5), early)).toBe("2026-09");
    expect(invoiceRefFor(day(2026, 9, 6), early)).toBe("2026-10");
  });

  it("vira o ano", () => {
    expect(invoiceRefFor(day(2026, 12, 10), c)).toBe("2027-01");
    expect(invoiceRefFor(day(2026, 12, 29), c)).toBe("2027-02");
  });

  it("dia 31 em mês curto vale o último dia do mês", () => {
    const end = card({ closing_day: 31, due_day: 10 });

    expect(invoiceRefFor(day(2026, 1, 31), end)).toBe("2026-02"); // fecha 31/01, vence 10/02
    expect(invoiceRefFor(day(2026, 2, 28), end)).toBe("2026-03"); // fevereiro fecha dia 28
    expect(invoiceRefFor(day(2026, 3, 1), end)).toBe("2026-04");
  });

  it("fevereiro bissexto: dia 30 de fechamento vale 29", () => {
    const c30 = card({ closing_day: 30, due_day: 10 });

    expect(invoiceRefFor(day(2028, 2, 29), c30)).toBe("2028-03");
    expect(invoiceRefFor(day(2028, 3, 1), c30)).toBe("2028-04");
  });

  it("a fatura de hoje é a que recebe as compras de hoje", () => {
    expect(currentInvoiceRef(c, day(2026, 9, 21))).toBe("2026-10");
  });
});

describe("datas de uma fatura", () => {
  it("fechamento, vencimento e o dia em que ela começa", () => {
    const dates = invoiceDates("2026-10", card({ closing_day: 28, due_day: 5 }));

    expect(fmt(dates.closing)).toBe("28/09/2026");
    expect(fmt(dates.due)).toBe("05/10/2026");
    expect(fmt(dates.periodStart)).toBe("29/08/2026");
  });

  it("vencimento no mesmo mês do fechamento", () => {
    const dates = invoiceDates("2026-09", card({ closing_day: 5, due_day: 15 }));

    expect(fmt(dates.closing)).toBe("05/09/2026");
    expect(fmt(dates.due)).toBe("15/09/2026");
    expect(fmt(dates.periodStart)).toBe("06/08/2026");
  });

  it("virada de ano e mês curto", () => {
    const january = invoiceDates("2027-01", card({ closing_day: 28, due_day: 5 }));
    expect([fmt(january.periodStart), fmt(january.closing), fmt(january.due)]).toEqual(["29/11/2026", "28/12/2026", "05/01/2027"]);

    const february = invoiceDates("2026-02", card({ closing_day: 10, due_day: 31 }));
    expect([fmt(february.closing), fmt(february.due)]).toEqual(["10/02/2026", "28/02/2026"]);
  });

  it("recusa uma fatura inválida", () => {
    expect(() => invoiceDates("2026-13", card())).toThrow("Fatura inválida");
  });

  it("as duas regras concordam: toda compra do ano cai numa fatura cujo período a contém", () => {
    const cards = [
      card({ closing_day: 28, due_day: 5 }),
      card({ closing_day: 5, due_day: 15 }),
      card({ closing_day: 31, due_day: 10 }),
      card({ closing_day: 1, due_day: 28 }),
      card({ closing_day: 10, due_day: 10 }),
      card({ closing_day: 30, due_day: 1 }),
      card({ closing_day: 15, due_day: 31 }),
    ];

    for (const c of cards) {
      for (const year of [2026, 2028]) {
        for (let n = 0; n < 366; n++) {
          const date = new Date(year, 0, 1 + n);
          if (date.getFullYear() !== year) continue;
          const dates = invoiceDates(invoiceRefFor(date, c), c);
          const inside = date >= dates.periodStart && date <= dates.closing;
          if (!inside) throw new Error(`${fmt(date)} fora da fatura (${fmt(dates.periodStart)} a ${fmt(dates.closing)}) do cartão ${c.closing_day}/${c.due_day}`);
        }
      }
    }
  });
});

describe("situação da fatura", () => {
  const dates = invoiceDates("2026-10", card()); // fecha 28/09, vence 05/10
  const status = (today: Date, total = 100, paid = false) => invoiceStatus({ dates, total, paid, today });

  it("aberta até o dia do fechamento, inclusive", () => {
    expect(status(day(2026, 9, 1))).toBe("open");
    expect(status(day(2026, 9, 28))).toBe("open");
  });

  it("fechada do dia seguinte até o vencimento, inclusive", () => {
    expect(status(day(2026, 9, 29))).toBe("closed");
    expect(status(day(2026, 10, 5))).toBe("closed");
  });

  it("vencida depois do vencimento sem pagar", () => {
    expect(status(day(2026, 10, 6))).toBe("overdue");
  });

  it("paga vale em qualquer data; sem compras não tem o que pagar", () => {
    expect(status(day(2026, 12, 1), 100, true)).toBe("paid");
    expect(status(day(2026, 9, 1), 0)).toBe("empty");
    expect(status(day(2026, 12, 1), 0)).toBe("empty");
  });

  it("a hora do dia não muda nada", () => {
    expect(status(new Date(2026, 8, 28, 23, 59))).toBe("open");
    expect(status(new Date(2026, 9, 5, 23, 59))).toBe("closed");
  });
});

describe("montar a fatura", () => {
  const today = day(2026, 9, 21);

  it("soma só as compras daquela fatura e daquele cartão, em centavos exatos", () => {
    const purchases = [
      purchase({ amount: 0.1 }),
      purchase({ amount: 0.2 }),
      purchase({ amount: 500, invoice_ref: "2026-11" }),
      purchase({ amount: 900, card_id: 2 }),
    ];

    const invoice = buildInvoice({ card: card(), ref: "2026-10", purchases, payments: [], today });

    expect(invoice.total).toBe(0.3);
    expect(invoice.purchases).toHaveLength(2);
    expect(invoice).toMatchObject({ label: "OUT/2026", periodStart: "29/08/2026", closingDate: "28/09/2026", dueDate: "05/10/2026", status: "open", payment: null });
  });

  it("compras em ordem de data e, na mesma data, na ordem em que foram lançadas", () => {
    const purchases = [
      purchase({ description: "c", date: "15/09/2026" }),
      purchase({ description: "a", date: "02/09/2026" }),
      purchase({ description: "b", date: "02/09/2026" }),
    ];

    const invoice = buildInvoice({ card: card(), ref: "2026-10", purchases, payments: [], today });

    expect(invoice.purchases.map((p) => p.description)).toEqual(["a", "b", "c"]);
  });

  it("total por categoria, da maior para a menor", () => {
    const purchases = [
      purchase({ category: "Lazer", amount: 50 }),
      purchase({ category: "Alimentação", amount: 80 }),
      purchase({ category: "Lazer", amount: 40 }),
    ];

    const invoice = buildInvoice({ card: card(), ref: "2026-10", purchases, payments: [], today });

    expect(invoice.byCategory).toEqual([
      { category: "Lazer", total: 90 },
      { category: "Alimentação", total: 80 },
    ]);
  });

  it("com pagamento vira paga e guarda o pagamento; fatura vazia é 'Sem compras'", () => {
    const paid = payment();
    const withPayment = buildInvoice({ card: card(), ref: "2026-10", purchases: [purchase()], payments: [paid], today });
    const empty = buildInvoice({ card: card(), ref: "2026-12", purchases: [], payments: [], today });

    expect(withPayment).toMatchObject({ status: "paid", payment: paid });
    expect(empty).toMatchObject({ total: 0, status: "empty", purchases: [] });
  });

  it("pagamento de outro cartão ou de outra fatura não vale", () => {
    const invoice = buildInvoice({
      card: card(),
      ref: "2026-10",
      purchases: [purchase()],
      payments: [payment({ card_id: 2 }), payment({ invoice_ref: "2026-11" })],
      today,
    });

    expect(invoice.status).toBe("open");
    expect(invoice.payment).toBeNull();
  });
});

describe("lista de faturas", () => {
  const today = day(2026, 9, 21);

  it("inclui a atual mesmo vazia, as que têm compra e as que só têm pagamento, em ordem", () => {
    const invoices = listInvoices({
      card: card(),
      purchases: [purchase({ invoice_ref: "2026-12" }), purchase({ invoice_ref: "2026-09" })],
      payments: [payment({ invoice_ref: "2026-08" })],
      today,
    });

    expect(invoices.map((i) => i.ref)).toEqual(["2026-08", "2026-09", "2026-10", "2026-12"]);
    expect(invoices.find((i) => i.ref === "2026-10")?.status).toBe("empty");
  });

  it("ignora compras de outros cartões", () => {
    const invoices = listInvoices({ card: card(), purchases: [purchase({ card_id: 2, invoice_ref: "2027-05" })], payments: [], today });

    expect(invoices.map((i) => i.ref)).toEqual(["2026-10"]);
  });
});

describe("limite do cartão", () => {
  it("usado é tudo o que não foi pago, inclusive parcelas de faturas futuras", () => {
    const usage = cardUsage(
      card({ credit_limit: 1000 }),
      [
        purchase({ amount: 200, invoice_ref: "2026-10" }),
        purchase({ amount: 100, invoice_ref: "2026-11" }),
        purchase({ amount: 300, invoice_ref: "2026-09" }), // paga
      ],
      [payment({ invoice_ref: "2026-09", amount: 300 })],
    );

    expect(usage).toEqual({ used: 300, available: 700, ratio: 0.3 });
  });

  it("sem limite definido: só o usado", () => {
    expect(cardUsage(card({ credit_limit: null }), [purchase({ amount: 50 })], [])).toEqual({ used: 50, available: null, ratio: null });
    expect(cardUsage(card({ credit_limit: 0 }), [purchase({ amount: 50 })], [])).toEqual({ used: 50, available: null, ratio: null });
  });

  it("estourou o limite: disponível negativo e proporção travada em 100%", () => {
    expect(cardUsage(card({ credit_limit: 100 }), [purchase({ amount: 150 })], [])).toEqual({ used: 150, available: -50, ratio: 1 });
  });

  it("não conta compras de outro cartão", () => {
    expect(cardUsage(card({ credit_limit: 100 }), [purchase({ card_id: 2, amount: 90 })], []).used).toBe(0);
  });
});

describe("planejar a compra", () => {
  const base = { card: card(), description: "  Notebook  ", totalAmount: 3000, date: day(2026, 9, 21), category: "Outros", groupId: "g1" };

  it("à vista: uma linha, na fatura da data, sem campos de parcela", () => {
    const [only, ...rest] = planPurchase({ ...base, installments: 1 });

    expect(rest).toEqual([]);
    expect(only).toEqual({
      card_id: 1,
      description: "Notebook",
      amount: 3000,
      date: "21/09/2026",
      category: "Outros",
      invoice_ref: "2026-10",
      installment_group_id: null,
      installment_number: null,
      installment_total: null,
    });
  });

  it("parcelada: cada parcela na fatura seguinte, com a data em que é cobrada (mês a mês) e a mesma série", () => {
    const rows = planPurchase({ ...base, installments: 3 });

    expect(rows.map((r) => r.invoice_ref)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(rows.map((r) => [r.installment_number, r.installment_total])).toEqual([[1, 3], [2, 3], [3, 3]]);
    expect(rows.map((r) => r.date)).toEqual(["21/09/2026", "21/10/2026", "21/11/2026"]);
    expect(new Set(rows.map((r) => r.installment_group_id))).toEqual(new Set(["g1"]));
  });

  it("as parcelas somam o total exato, com a diferença na última", () => {
    const rows = planPurchase({ ...base, totalAmount: 100, installments: 3 });

    expect(rows.map((r) => r.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100)).toBe(10000);
  });

  it("a data da parcela num mês mais curto vai para o último dia dele", () => {
    const rows = planPurchase({ ...base, date: day(2026, 1, 31), installments: 3 });

    expect(rows.map((r) => r.date)).toEqual(["31/01/2026", "28/02/2026", "31/03/2026"]);
  });

  it("parcelas atravessam a virada de ano", () => {
    const rows = planPurchase({ ...base, date: day(2026, 12, 10), installments: 3 });

    expect(rows.map((r) => r.invoice_ref)).toEqual(["2027-01", "2027-02", "2027-03"]);
  });

  it("compra depois do fechamento começa na fatura seguinte", () => {
    const rows = planPurchase({ ...base, date: day(2026, 9, 29), installments: 2 });

    expect(rows.map((r) => r.invoice_ref)).toEqual(["2026-11", "2026-12"]);
  });

  it("parcelas fracionadas são arredondadas para baixo e nunca zero", () => {
    expect(planPurchase({ ...base, installments: 2.9 })).toHaveLength(2);
    expect(planPurchase({ ...base, installments: 0 })).toHaveLength(1);
  });
});

describe("compra em fatura já paga", () => {
  it("avisa qual fatura e como resolver; sem pagamento, deixa lançar", () => {
    const paid = [payment({ invoice_ref: "2026-11" })];

    expect(purchaseBlockedByPayment(["2026-10", "2026-11"], paid, 1)).toContain("fatura de NOV/2026 já está paga");
    expect(purchaseBlockedByPayment(["2026-10", "2026-12"], paid, 1)).toBeNull();
    expect(purchaseBlockedByPayment(["2026-11"], paid, 2)).toBeNull(); // pagamento de outro cartão
  });
});

describe("validação", () => {
  const ok = { name: "Nubank", closingDay: 28, dueDay: 5, limit: null };

  it("cartão", () => {
    expect(validateCard(ok)).toBeNull();
    expect(validateCard({ ...ok, limit: 5000 })).toBeNull();
    expect(validateCard({ ...ok, name: "  " })).toBe("Dê um nome ao cartão.");
    expect(validateCard({ ...ok, closingDay: 0 })).toBe("O dia de fechamento precisa estar entre 1 e 31.");
    expect(validateCard({ ...ok, closingDay: 32 })).toBe("O dia de fechamento precisa estar entre 1 e 31.");
    expect(validateCard({ ...ok, closingDay: 5.5 })).toBe("O dia de fechamento precisa estar entre 1 e 31.");
    expect(validateCard({ ...ok, dueDay: NaN })).toBe("O dia de vencimento precisa estar entre 1 e 31.");
    expect(validateCard({ ...ok, limit: 0 })).toBe("O limite precisa ser maior que zero (ou deixe em branco).");
  });

  it("compra", () => {
    const good = { description: "Mercado", amount: 50, installments: 1 };

    expect(validatePurchase(good)).toBeNull();
    expect(validatePurchase({ ...good, description: " " })).toBe("Descreva a compra.");
    expect(validatePurchase({ ...good, amount: null })).toBe("Digite o valor da compra.");
    expect(validatePurchase({ ...good, amount: 0 })).toBe("Digite o valor da compra.");
    expect(validatePurchase({ ...good, installments: 0 })).toContain("de 1 a 48");
    expect(validatePurchase({ ...good, installments: 49 })).toContain("de 1 a 48");
    expect(validatePurchase({ ...good, amount: 0.05, installments: 10 })).toBe("O valor é pequeno demais para tantas parcelas.");
  });
});

describe("faturas a pagar (avisos e lembretes)", () => {
  const today = day(2026, 9, 21);
  const cards = [card(), card({ id: 2, name: "Inter", closing_day: 5, due_day: 15 })];

  it("só as que têm valor e não foram pagas, da que vence primeiro para a que vence depois", () => {
    const dues = unpaidInvoiceDues({
      cards,
      today,
      purchases: [
        purchase({ card_id: 1, invoice_ref: "2026-10", amount: 100 }), // Nubank: vence 05/10
        purchase({ card_id: 1, invoice_ref: "2026-11", amount: 50 }), // Nubank: vence 05/11
        purchase({ card_id: 1, invoice_ref: "2026-09", amount: 70 }), // Nubank: vence 05/09 (vencida)
        purchase({ card_id: 2, invoice_ref: "2026-09", amount: 30 }), // Inter: vence 15/09 (vencida)
        purchase({ card_id: 2, invoice_ref: "2026-10", amount: 20 }), // Inter: paga
      ],
      payments: [payment({ card_id: 2, invoice_ref: "2026-10" })],
    });

    expect(dues.map((d) => [d.cardName, d.ref, d.amount, d.dueDate, d.status])).toEqual([
      ["Nubank", "2026-09", 70, "05/09/2026", "overdue"],
      ["Inter", "2026-09", 30, "15/09/2026", "overdue"],
      ["Nubank", "2026-10", 100, "05/10/2026", "open"],
      ["Nubank", "2026-11", 50, "05/11/2026", "open"],
    ]);
    expect(dues[0].id).toBe("invoice-1-2026-09");
  });

  it("sem compras, nada a pagar", () => {
    expect(unpaidInvoiceDues({ cards, purchases: [], payments: [], today })).toEqual([]);
  });
});

describe("créditos da fatura (valor negativo)", () => {
  const TODAY_AFTER_CLOSING = new Date(2026, 9, 1);
  const invoice = (rows: CardPurchaseRow[]) => buildInvoice({ card: card(), ref: "2026-10", purchases: rows, payments: [], today: TODAY_AFTER_CLOSING });

  it("reduzem o total a pagar, mas o gasto e o total por categoria continuam só com as compras", () => {
    const result = invoice([
      purchase({ amount: 300, category: "Lazer" }),
      purchase({ amount: 100, category: "Alimentação" }),
      purchase({ description: "Pagamento recebido", amount: -150, category: "Crédito na fatura" }),
    ]);

    expect(result.total).toBe(250);
    expect(result.spend).toBe(400);
    expect(result.credits).toBe(150);
    expect(result.status).toBe("closed");
    expect(result.byCategory).toEqual([
      { category: "Lazer", total: 300 },
      { category: "Alimentação", total: 100 },
    ]);
  });

  it("créditos que cobrem tudo deixam a fatura quitada, sem nada a pagar nem aviso", () => {
    const rows = [purchase({ amount: 100 }), purchase({ amount: -100, category: "Crédito na fatura" })];

    const result = invoice(rows);

    expect(result.total).toBe(0);
    expect(result.status).toBe("settled");
    expect(unpaidInvoiceDues({ cards: [card()], purchases: rows, payments: [], today: TODAY_AFTER_CLOSING })).toEqual([]);
  });

  it("uma fatura sem lançamento nenhum segue 'sem compras'", () => {
    expect(invoice([]).status).toBe("empty");
  });

  it("liberam o limite do cartão", () => {
    const rows = [purchase({ amount: 500 }), purchase({ amount: -200, category: "Crédito na fatura" })];

    expect(cardUsage(card({ credit_limit: 1000 }), rows, []).used).toBe(300);
  });
});

describe("a despesa que a compra gera", () => {
  it("a descrição leva o número da parcela, sem repetir quando já está escrito", () => {
    expect(purchaseExpenseDescription({ description: "Mercado", installment_number: null, installment_total: null })).toBe("Mercado");
    expect(purchaseExpenseDescription({ description: "Notebook", installment_number: 2, installment_total: 5 })).toBe("Notebook (2/5)");
    expect(purchaseExpenseDescription({ description: "Notebook (2/5)", installment_number: 2, installment_total: 5 })).toBe("Notebook (2/5)");
  });
});
