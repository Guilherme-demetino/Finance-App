import type { CardPaymentRow, CardPurchaseRow, CreditCardRow } from "../types";
import {
  detectInvoiceRef,
  isBalanceLine,
  isReceivedPayment,
  isCardInvoicePayment,
  ignoreCardPayments,
  planCardImport,
  splitInstallment,
} from "./cardImport";
import { planBankCsvImport } from "./statements/bankCsv";
import { planPdfImport } from "./statements/bankPdf";
import type { CsvImportPlan, ImportedTransaction } from "./statements/importCsv";

const CARD: CreditCardRow = { id: 1, name: "Nubank", closing_day: 28, due_day: 5, credit_limit: null };
const TODAY = new Date(2026, 9, 10); // 10/10/2026

const line = (over: Partial<ImportedTransaction> = {}): ImportedTransaction => ({
  amount: 50,
  date: "10/09/2026",
  description: "Mercado",
  type: "expense",
  category: "Alimentação",
  ...over,
});

const purchase = (over: Partial<CardPurchaseRow> = {}): CardPurchaseRow => ({
  id: 1,
  card_id: 1,
  description: "Mercado",
  amount: 50,
  date: "10/09/2026",
  category: "Alimentação",
  invoice_ref: "2026-10",
  installment_group_id: null,
  installment_number: null,
  installment_total: null,
  transaction_id: null,
  ...over,
});

const plan = (candidates: ImportedTransaction[], over: Partial<Parameters<typeof planCardImport>[0]> = {}) =>
  planCardImport({ candidates, card: CARD, purchases: [], payments: [], today: TODAY, ...over });

describe("splitInstallment", () => {
  it.each([
    ["Notebook (2/5)", "Notebook", 2, 5],
    ["Notebook 2/5", "Notebook", 2, 5],
    ["Notebook - Parcela 2/5", "Notebook", 2, 5],
    ["NOTEBOOK PARC 02/05", "NOTEBOOK", 2, 5],
    ["Notebook 02 de 05", "Notebook", 2, 5],
    ["Loja Tal (10/12)", "Loja Tal", 10, 12],
  ])("%s → %s %i/%i", (text, base, number, total) => {
    expect(splitInstallment(text)).toEqual({ base, number, total });
  });

  it.each(["Mercado", "Uber 1/1", "Loja 5/2", "Ano 2026", "(3/5)", "Farmácia 1/99"])("%s não tem parcela", (text) => {
    expect(splitInstallment(text)).toEqual({ base: text.trim(), number: null, total: null });
  });
});

describe("linhas de pagamento", () => {
  it("separa o pagamento recebido (crédito na fatura) do saldo da fatura anterior (ignorado)", () => {
    expect(isReceivedPayment("Pagamento recebido")).toBe(true);
    expect(isReceivedPayment("PAGAMENTO DE FATURA")).toBe(true);
    expect(isReceivedPayment("Pagamento em 05 OUT")).toBe(true);
    expect(isReceivedPayment("Pgto fatura anterior")).toBe(false);
    expect(isReceivedPayment("Fatura anterior")).toBe(false);
    expect(isReceivedPayment("Mercado Pague Menos")).toBe(false);
    expect(isReceivedPayment("Pag*Padaria")).toBe(false);
    expect(isBalanceLine("Fatura anterior")).toBe(true);
    expect(isBalanceLine("Saldo restante da fatura anterior")).toBe(true);
    expect(isBalanceLine("Pagamento recebido")).toBe(false);
  });

  it.each([
    "PAGAMENTO FATURA NUBANK",
    "Pagamento da fatura",
    "Pagamento de fatura - Nubank",
    "PAG FATURA CARTAO",
    "Pgto Cartão de Crédito",
    "Fatura cartão Inter",
    "Pagamento cartão Nubank",
  ])("reconhece o pagamento de fatura no extrato: %s", (text) => {
    expect(isCardInvoicePayment(text)).toBe(true);
  });

  it.each([
    "Pix Maria",
    "Compra no cartão de débito - Padaria",
    "Pagamento de fatura de energia",
    "Fatura Vivo internet",
    "Compra no débito - Padaria",
    "Pagamento cartão de débito",
  ])("não confunde com outras despesas: %s", (text) => {
    expect(isCardInvoicePayment(text)).toBe(false);
  });
});

describe("detectInvoiceRef", () => {
  it("é a fatura onde a maioria das compras avulsas cai; parcelas não votam", () => {
    const ref = detectInvoiceRef(
      [
        { date: "10/09/2026", installment: false },
        { date: "15/09/2026", installment: false },
        { date: "29/09/2026", installment: false },
        { date: "01/03/2026", installment: true },
      ],
      CARD,
      TODAY,
    );
    expect(ref).toBe("2026-10");
  });

  it("empate fica com a fatura mais nova; sem compras avulsas, com a atual", () => {
    expect(detectInvoiceRef([{ date: "10/09/2026", installment: false }, { date: "29/09/2026", installment: false }], CARD, TODAY)).toBe("2026-11");
    expect(detectInvoiceRef([{ date: "01/03/2026", installment: true }], CARD, TODAY)).toBe("2026-11");
  });
});

describe("planCardImport: a fatura vira compras", () => {
  it("todas as linhas entram na fatura detectada, inclusive parcelas com a data da compra original", () => {
    const result = plan([
      line({ date: "10/09/2026", description: "Mercado", amount: 50 }),
      line({ date: "15/09/2026", description: "Uber", amount: 20.5, category: "Transporte" }),
      line({ date: "12/03/2026", description: "Notebook (2/5)", amount: 300, category: "Geral" }),
    ]);

    expect(result.ref).toBe("2026-10");
    expect(result.refOptions).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(result.rows.map((row) => [row.description, row.amount, row.invoice_ref, row.installment_number, row.installment_total, row.date])).toEqual([
      ["Mercado", 50, "2026-10", null, null, "10/09/2026"],
      ["Uber", 20.5, "2026-10", null, null, "15/09/2026"],
      ["Notebook", 300, "2026-10", 2, 5, "12/03/2026"],
    ]);
    expect(result.rows[2].installment_group_id).toMatch(/^imp-1-notebook-30000-5$/);
    expect(result.total).toBe(370.5);
    expect(result.duplicates).toBe(0);
    expect(result.blocked).toBeNull();
  });

  it("saldos da fatura anterior ficam de fora, contados à parte", () => {
    const result = plan([
      line(),
      line({ type: "income", description: "Fatura anterior", amount: 900 }),
      line({ description: "Saldo restante da fatura anterior", amount: 10 }),
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.ignoredCredits).toBe(2);
  });

  it("pagamento recebido e estorno são créditos: valor negativo, reduzem o total a pagar e não contam como compra", () => {
    const result = plan([
      line({ amount: 100 }),
      line({ description: "Uber", amount: 50, date: "12/09/2026" }),
      line({ type: "income", description: "Pagamento recebido", amount: 120, date: "15/09/2026" }),
      line({ type: "income", description: "Estorno Loja", amount: 20, date: "16/09/2026" }),
    ]);

    expect(result.rows.map((row) => [row.description, row.amount, row.category])).toEqual([
      ["Mercado", 100, "Alimentação"],
      ["Uber", 50, "Alimentação"],
      ["Pagamento recebido", -120, "Crédito na fatura"],
      ["Estorno Loja", -20, "Crédito na fatura"],
    ]);
    expect(result.purchasesCount).toBe(2);
    expect(result.purchasesTotal).toBe(150);
    expect(result.creditsCount).toBe(2);
    expect(result.creditsTotal).toBe(140);
    expect(result.total).toBe(10);
    expect(result.ignoredCredits).toBe(0);
  });

  it("o pagamento recebido vale também quando o leitor o marca como despesa (PDF sem sinal), e não vota na fatura", () => {
    const result = plan([line({ date: "10/09/2026" }), line({ description: "Pagamento recebido", type: "expense", amount: 20, date: "05/11/2026" })]);

    expect(result.rows.map((row) => row.amount)).toEqual([50, -20]);
    expect(result.ref).toBe("2026-10");
  });

  it("importar de novo o mesmo pagamento recebido não repete", () => {
    const first = plan([line({ type: "income", description: "Pagamento recebido", amount: 30 })]);
    const stored = first.rows.map((row, index) => ({ ...row, id: index + 1, transaction_id: null }));

    const again = plan([line({ type: "income", description: "Pagamento recebido", amount: 30 })], { purchases: stored });

    expect(again.rows).toEqual([]);
    expect(again.duplicates).toBe(1);
  });

  it("ignora linhas com data ou valor inválidos", () => {
    const result = plan([line({ date: "31/02/2026" }), line({ amount: 0 }), line()]);

    expect(result.rows).toHaveLength(1);
  });

  it("não duplica o que já está lançado: mesma data, descrição e valor (sem ligar para maiúsculas e acentos)", () => {
    const result = plan([line({ description: "MERCADO" }), line({ description: "Farmácia", amount: 12 })], {
      purchases: [purchase({ description: "mercado" })],
    });

    expect(result.rows.map((row) => row.description)).toEqual(["Farmácia"]);
    expect(result.duplicates).toBe(1);
  });

  it("compras iguais contam uma a uma: se já tem 1 de 2, só a outra entra", () => {
    const result = plan([line(), line()], { purchases: [purchase()] });

    expect(result.rows).toHaveLength(1);
    expect(result.duplicates).toBe(1);
  });

  it("uma compra de outro cartão não conta como já lançada", () => {
    const result = plan([line()], { purchases: [purchase({ card_id: 2 })] });

    expect(result.rows).toHaveLength(1);
  });

  it("a parcela já lançada à mão é reconhecida mesmo em outra fatura e com outra data", () => {
    const manual = purchase({
      id: 5,
      description: "Notebook",
      amount: 300,
      date: "20/07/2026",
      invoice_ref: "2026-08",
      installment_group_id: "g",
      installment_number: 2,
      installment_total: 5,
    });

    const result = plan([line({ date: "10/09/2026" }), line({ description: "Notebook 2/5", amount: 300, date: "12/03/2026" })], { purchases: [manual] });

    expect(result.rows.map((row) => row.description)).toEqual(["Mercado"]);
    expect(result.duplicates).toBe(1);
  });

  it("outra parcela da mesma compra não é duplicada", () => {
    const manual = purchase({ description: "Notebook", amount: 300, installment_group_id: "g", installment_number: 2, installment_total: 5 });

    const result = plan([line({ description: "Notebook (3/5)", amount: 300 })], { purchases: [manual] });

    expect(result.rows).toHaveLength(1);
    expect(result.duplicates).toBe(0);
  });

  it("importar o mesmo arquivo de novo não lança nada outra vez", () => {
    const candidates = [line(), line({ description: "Uber", amount: 20.5 }), line({ description: "Notebook (2/5)", amount: 300, date: "12/03/2026" })];
    const first = plan(candidates);
    const stored = first.rows.map((row, index) => ({ ...row, id: index + 1, transaction_id: null }));

    const second = plan(candidates, { purchases: stored });

    expect(second.rows).toEqual([]);
    expect(second.duplicates).toBe(3);
  });

  it("dá para escolher outra fatura, e a fatura paga não recebe compras", () => {
    const chosen = plan([line()], { ref: "2026-11" });
    expect(chosen.ref).toBe("2026-11");
    expect(chosen.rows[0].invoice_ref).toBe("2026-11");

    const paid: CardPaymentRow[] = [{ id: 1, card_id: 1, invoice_ref: "2026-10", paid_date: "05/10/2026", amount: 10, transaction_id: null }];
    const blocked = plan([line()], { payments: paid });
    expect(blocked.blocked).toContain("já está paga");
  });

  it("arquivo sem compras novas não é bloqueado nem trava numa fatura paga", () => {
    const paid: CardPaymentRow[] = [{ id: 1, card_id: 1, invoice_ref: "2026-10", paid_date: "05/10/2026", amount: 50, transaction_id: null }];

    const result = plan([line()], { payments: paid, purchases: [purchase()] });

    expect(result.rows).toEqual([]);
    expect(result.blocked).toBeNull();
  });
});

describe("ignoreCardPayments: o extrato não conta o pagamento da fatura", () => {
  const statement = (rows: ImportedTransaction[]): CsvImportPlan => ({ source: "pdf", toImport: rows, totalRows: rows.length, duplicates: 0, invalid: 0 });
  const debit = (over: Partial<ImportedTransaction> = {}) => line({ description: "Pagamento de fatura Nubank", amount: 100, date: "06/10/2026", category: "Geral", ...over });

  it("a linha de pagamento de fatura fica de fora e é contada", () => {
    const pix = line({ description: "Pix Ana", amount: 10 });

    const result = ignoreCardPayments(statement([debit(), pix, debit({ amount: 250, date: "07/10/2026" })]));

    expect(result.toImport).toEqual([pix]);
    expect(result.cardPaymentsIgnored).toBe(2);
  });

  it("receita e despesas comuns passam direto, sem marcar nada como ignorado", () => {
    const plan = statement([line({ description: "Pagamento de fatura estornado", type: "income" }), line({ description: "Mercado" })]);

    const result = ignoreCardPayments(plan);

    expect(result.toImport).toHaveLength(2);
    expect(result.cardPaymentsIgnored).toBeUndefined();
  });

  it("conta de consumo com 'fatura' no nome continua sendo despesa", () => {
    const plan = statement([line({ description: "Pagamento de fatura energia" }), line({ description: "Pgto fatura internet" })]);

    expect(ignoreCardPayments(plan).toImport).toHaveLength(2);
  });
});

describe("fatura em PDF (linhas de texto do arquivo)", () => {
  const LINES = [
    "Fatura do cartão Nubank",
    "Vencimento: 05/10/2026",
    "Total da fatura R$ 250,50",
    "10 SET Mercado Extra R$ 60,00",
    "15 SET Uber *Trip R$ 20,50",
    "20 SET Notebook - Parcela 2/5 R$ 170,00",
    "03 OUT Pagamento recebido R$ 100,00",
  ];

  it("as linhas do PDF viram compras da fatura; o pagamento recebido é crédito e o total impresso fica de fora", () => {
    const pdf = planPdfImport(LINES, [], TODAY);
    if (!pdf.ok) throw new Error(pdf.error);

    const result = plan(pdf.plan.toImport);

    expect(result.rows.map((row) => [row.description, row.amount, row.installment_number])).toEqual([
      ["Mercado Extra", 60, null],
      ["Uber *Trip", 20.5, null],
      ["Notebook", 170, 2],
      ["Pagamento recebido", -100, null],
    ]);
    expect(result.ref).toBe("2026-10");
    expect(result.purchasesTotal).toBe(250.5);
    expect(result.total).toBe(150.5);
  });
});

describe("fatura CSV do Nubank (exemplo real: date,title,amount, sem categoria)", () => {
  const CSV = [
    "date,title,amount",
    "2026-08-03,Uber,18.90",
    "2026-08-03,iFood,47.50",
    "2026-08-04,Supermercado Extra,215.37",
    "2026-08-05,Netflix,39.90",
    "2026-08-06,Posto Ipiranga,120.00",
    "2026-08-08,Farmácia São João,58.20",
    "2026-08-10,Amazon,89.99",
    "2026-08-12,Spotify,21.90",
    "2026-08-14,Restaurante Sabor Caseiro,64.80",
    "2026-08-15,Pagamento recebido,-450.00",
    "2026-08-18,Academia SmartFit,99.90",
    "2026-08-20,Shopee,32.45",
    "2026-08-22,Cinemark,45.00",
    "2026-08-25,Padaria Pão Quente,12.50",
    "2026-08-28,Uber,22.30",
    "2026-08-30,Fatura anterior,-1200.00",
  ].join("\n");

  const read = () => {
    const csv = planBankCsvImport(CSV, []);
    if (!csv.ok) throw new Error(csv.error);
    return csv.plan.toImport;
  };

  it("as 14 compras são despesas e as duas linhas negativas são créditos", () => {
    const lines = read();

    expect(lines.filter((line) => line.type === "expense")).toHaveLength(14);
    expect(lines.filter((line) => line.type === "income").map((line) => line.description)).toEqual(["Pagamento recebido", "Fatura anterior"]);
  });

  it("importa as 14 compras e o pagamento recebido como crédito; 'Fatura anterior' fica de fora", () => {
    const result = plan(read());

    expect(result.rows).toHaveLength(15);
    expect(result.purchasesCount).toBe(14);
    expect(result.purchasesTotal).toBe(888.71); // o gasto do período
    expect(result.creditsCount).toBe(1);
    expect(result.creditsTotal).toBe(450);
    expect(result.total).toBe(438.71); // a pagar
    expect(result.rows.find((row) => row.description === "Pagamento recebido")).toMatchObject({ amount: -450, date: "15/08/2026", category: "Crédito na fatura" });
    expect(result.ignoredCredits).toBe(1);
    expect(result.ref).toBe("2026-09"); // fecha dia 28: compras até 28/08 caem na fatura que vence em 05/09
    expect(result.rows.map((row) => row.description)).toEqual(
      expect.arrayContaining(["Uber", "iFood", "Supermercado Extra", "Farmácia São João", "Padaria Pão Quente"]),
    );
    expect(result.rows.find((row) => row.description === "Netflix")).toMatchObject({ date: "05/08/2026", amount: 39.9, category: "Lazer" });
  });

  it("as duas compras da Uber (datas e valores diferentes) não são tratadas como duplicadas", () => {
    const result = plan(read());

    expect(result.rows.filter((row) => row.description === "Uber").map((row) => row.amount)).toEqual([18.9, 22.3]);
    expect(result.duplicates).toBe(0);
  });

  it("importar de novo não lança nada", () => {
    const first = plan(read());
    const stored = first.rows.map((row, index) => ({ ...row, id: index + 1, transaction_id: null }));

    const again = plan(read(), { purchases: stored });

    expect(again.rows).toEqual([]);
    expect(again.duplicates).toBe(15);
  });
});
