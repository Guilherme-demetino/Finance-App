import type { SubscriptionPriceChangeRow, SubscriptionRow, TransactionRow } from "../types";
import {
  chargeNeedle,
  daysUntilCharge,
  detectPriceChange,
  detectPriceChanges,
  formatPercent,
  monthlyEquivalent,
  monthlyImpact,
  nextChargeDate,
  recentPriceChanges,
  summarizeSubscriptions,
  validateSubscription,
  type SubscriptionInput,
} from "./subscriptions";

let nextId = 1;
const sub = (over: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  id: nextId++,
  name: "Netflix",
  amount: 39.9,
  cycle: "monthly",
  billing_day: 5,
  billing_month: null,
  category: "Lazer",
  match_text: null,
  active: 1,
  created_date: "01/01/2026",
  price_since: "01/01/2026",
  ignored_amount: null,
  ...over,
});

const tx = (over: Partial<TransactionRow> = {}): TransactionRow => ({
  id: nextId++,
  amount: 39.9,
  date: "05/08/2026",
  description: "Netflix",
  type: "expense",
  category_id: "Lazer",
  recurrence_group_id: null,
  recurrence_type: null,
  installment_number: null,
  installment_total: null,
  ...over,
});

const TODAY = new Date(2026, 8, 21); // 21/09/2026
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("total das assinaturas", () => {
  it("a anual entra dividida por 12", () => {
    expect(monthlyEquivalent(sub({ amount: 40 }))).toBe(40);
    expect(monthlyEquivalent(sub({ amount: 120, cycle: "yearly", billing_month: 3 }))).toBe(10);
  });

  it("soma só as ativas, com o total do ano e as pausadas contadas à parte", () => {
    const summary = summarizeSubscriptions([
      sub({ amount: 39.9 }),
      sub({ amount: 21.9 }),
      sub({ amount: 240, cycle: "yearly", billing_month: 6 }),
      sub({ amount: 100, active: 0 }),
    ]);

    expect(summary).toEqual({ monthlyTotal: 81.8, yearlyTotal: 981.6, activeCount: 3, pausedCount: 1 });
  });

  it("sem assinaturas tudo é zero", () => {
    expect(summarizeSubscriptions([])).toEqual({ monthlyTotal: 0, yearlyTotal: 0, activeCount: 0, pausedCount: 0 });
  });
});

describe("próxima cobrança", () => {
  it("mensal: este mês se o dia ainda não passou (hoje conta), senão o mês que vem", () => {
    expect(nextChargeDate(sub({ billing_day: 25 }), TODAY)).toEqual(day(2026, 9, 25));
    expect(nextChargeDate(sub({ billing_day: 21 }), TODAY)).toEqual(day(2026, 9, 21));
    expect(nextChargeDate(sub({ billing_day: 5 }), TODAY)).toEqual(day(2026, 10, 5));
  });

  it("dia 31 vale o último dia do mês curto", () => {
    expect(nextChargeDate(sub({ billing_day: 31 }), day(2026, 2, 10))).toEqual(day(2026, 2, 28));
  });

  it("vira o ano", () => {
    expect(nextChargeDate(sub({ billing_day: 5 }), day(2026, 12, 20))).toEqual(day(2027, 1, 5));
  });

  it("anual: no mês e dia dela, neste ano ou no próximo", () => {
    const yearly = (billing_month: number, billing_day = 10) => sub({ cycle: "yearly", billing_month, billing_day });

    expect(nextChargeDate(yearly(12), TODAY)).toEqual(day(2026, 12, 10));
    expect(nextChargeDate(yearly(3), TODAY)).toEqual(day(2027, 3, 10));
  });

  it("conta os dias até a cobrança", () => {
    expect(daysUntilCharge(sub({ billing_day: 21 }), TODAY)).toBe(0);
    expect(daysUntilCharge(sub({ billing_day: 25 }), TODAY)).toBe(4);
    expect(daysUntilCharge(sub({ billing_day: 5 }), TODAY)).toBe(14);
  });
});

describe("validação do cadastro", () => {
  const input = (over: Partial<SubscriptionInput> = {}): SubscriptionInput => ({
    name: "Netflix",
    amount: 39.9,
    cycle: "monthly",
    billingDay: 5,
    billingMonth: null,
    category: "Lazer",
    matchText: "",
    ...over,
  });

  it("aceita um cadastro completo", () => {
    expect(validateSubscription(input())).toBeNull();
    expect(validateSubscription(input({ cycle: "yearly", billingMonth: 6, matchText: "discord" }))).toBeNull();
  });

  it.each([
    [{ name: "  " }, "Dê um nome à assinatura."],
    [{ amount: null }, "Digite o valor da assinatura."],
    [{ amount: 0 }, "Digite o valor da assinatura."],
    [{ billingDay: 0 }, "O dia da cobrança precisa estar entre 1 e 31."],
    [{ billingDay: 32 }, "O dia da cobrança precisa estar entre 1 e 31."],
    [{ cycle: "yearly" as const, billingMonth: null }, "Nas assinaturas anuais, informe o mês da cobrança (1 a 12)."],
    [{ cycle: "yearly" as const, billingMonth: 13 }, "Nas assinaturas anuais, informe o mês da cobrança (1 a 12)."],
    [{ matchText: "ab" }, "O texto da cobrança precisa ter pelo menos 3 letras."],
  ])("recusa %j", (over, message) => {
    expect(validateSubscription(input(over))).toBe(message);
  });
});

describe("alerta de reajuste", () => {
  it("a cobrança mais recente veio mais cara: mostra de quanto para quanto e o percentual", () => {
    const alert = detectPriceChange(sub({ amount: 39.9 }), [tx({ amount: 39.9, date: "05/07/2026" }), tx({ amount: 44.9, date: "05/09/2026" })], TODAY);

    expect(alert).toMatchObject({ name: "Netflix", oldAmount: 39.9, newAmount: 44.9, chargeDate: "05/09/2026", difference: 5, percent: 12.53 });
  });

  it("cobrança igual ao valor cadastrado não alerta", () => {
    expect(detectPriceChange(sub(), [tx({ date: "05/09/2026" })], TODAY)).toBeNull();
  });

  it("sem cobrança nenhuma nas despesas não há o que comparar", () => {
    expect(detectPriceChange(sub(), [], TODAY)).toBeNull();
    expect(detectPriceChange(sub(), [tx({ description: "Spotify", amount: 99, date: "05/09/2026" })], TODAY)).toBeNull();
  });

  it("só a cobrança mais recente conta: se ela voltou ao valor de antes, sem alerta", () => {
    const charges = [tx({ amount: 44.9, date: "05/08/2026" }), tx({ amount: 39.9, date: "05/09/2026" })];

    expect(detectPriceChange(sub({ amount: 39.9 }), charges, TODAY)).toBeNull();
  });

  it("reajuste para baixo também é avisado, com percentual negativo", () => {
    const alert = detectPriceChange(sub({ amount: 50 }), [tx({ amount: 40, date: "05/09/2026" })], TODAY);

    expect(alert).toMatchObject({ difference: -10, percent: -20 });
  });

  it("variação menor que 1% (câmbio, arredondamento) não alerta", () => {
    expect(detectPriceChange(sub({ amount: 100 }), [tx({ amount: 100.5, date: "05/09/2026" })], TODAY)).toBeNull();
  });

  it("só olha cobranças depois de o valor atual valer (a data do último reajuste ou da criação)", () => {
    const charges = [tx({ amount: 44.9, date: "05/07/2026" })];

    expect(detectPriceChange(sub({ price_since: "10/08/2026" }), charges, TODAY)).toBeNull();
    expect(detectPriceChange(sub({ price_since: "01/07/2026" }), charges, TODAY)).not.toBeNull();
  });

  it("ignora o IOF, que é outra linha com o mesmo nome", () => {
    const charges = [tx({ description: 'IOF de "Discord* Nitroyearly"', amount: 6.41, date: "12/08/2026" })];

    expect(detectPriceChange(sub({ name: "Discord", amount: 183.26 }), charges, TODAY)).toBeNull();
  });

  it("acha a cobrança pelo texto configurado, sem ligar para maiúsculas e acentos", () => {
    const subscription = sub({ name: "Música", amount: 21.9, match_text: "Spotify" });

    expect(chargeNeedle(subscription)).toBe("spotify");
    expect(detectPriceChange(subscription, [tx({ description: "SPOTIFY AB *PREMIUM", amount: 23.9, date: "10/09/2026" })], TODAY)).toMatchObject({ newAmount: 23.9 });
  });

  it("nome curto demais (menos de 3 letras) não casa com nada", () => {
    expect(detectPriceChange(sub({ name: "TV", amount: 10 }), [tx({ description: "TV Cabo", amount: 99, date: "05/09/2026" })], TODAY)).toBeNull();
  });

  it("receita e cobrança no futuro não contam", () => {
    const charges = [tx({ type: "income", amount: 99, date: "05/09/2026" }), tx({ amount: 99, date: "05/10/2026" })];

    expect(detectPriceChange(sub(), charges, TODAY)).toBeNull();
  });

  it("assinatura pausada não alerta", () => {
    expect(detectPriceChange(sub({ active: 0 }), [tx({ amount: 99, date: "05/09/2026" })], TODAY)).toBeNull();
  });

  it("cobrança que o usuário mandou ignorar não alerta de novo, mas outro valor sim", () => {
    const subscription = sub({ ignored_amount: 44.9 });

    expect(detectPriceChange(subscription, [tx({ amount: 44.9, date: "05/09/2026" })], TODAY)).toBeNull();
    expect(detectPriceChange(subscription, [tx({ amount: 49.9, date: "05/09/2026" })], TODAY)).not.toBeNull();
  });

  it("no mesmo dia vale a despesa mais nova (maior id)", () => {
    const charges = [tx({ id: 10, amount: 39.9, date: "05/09/2026" }), tx({ id: 11, amount: 44.9, date: "05/09/2026" })];

    expect(detectPriceChange(sub(), charges, TODAY)?.newAmount).toBe(44.9);
  });

  it("lista os alertas dos maiores reajustes primeiro", () => {
    const small = sub({ name: "Netflix", amount: 40 });
    const big = sub({ name: "Spotify", amount: 20 });
    const charges = [tx({ description: "Netflix", amount: 42, date: "05/09/2026" }), tx({ description: "Spotify", amount: 30, date: "06/09/2026" })];

    expect(detectPriceChanges([small, big], charges, TODAY).map((alert) => alert.name)).toEqual(["Spotify", "Netflix"]);
  });

  it("uma anual pesa 1/12 no total mensal", () => {
    const alert = detectPriceChange(sub({ cycle: "yearly", billing_month: 8, amount: 120 }), [tx({ amount: 180, date: "05/09/2026" })], TODAY)!;

    expect(monthlyImpact(alert, "yearly")).toBe(5);
    expect(monthlyImpact(alert, "monthly")).toBe(60);
  });
});

describe("reajustes recentes e formatação", () => {
  const change = (over: Partial<SubscriptionPriceChangeRow>): SubscriptionPriceChangeRow => ({ id: nextId++, subscription_id: 1, date: "01/09/2026", old_amount: 10, new_amount: 12, ...over });

  it("só os dos últimos 90 dias, do mais recente para o mais antigo", () => {
    const recent = recentPriceChanges([change({ date: "01/06/2026" }), change({ date: "15/09/2026" }), change({ date: "10/08/2026" })], TODAY);

    expect(recent.map((c) => c.date)).toEqual(["15/09/2026", "10/08/2026"]);
  });

  it("formata o percentual com sinal e vírgula", () => {
    expect(formatPercent(12.53)).toBe("+12,5%");
    expect(formatPercent(-8)).toBe("-8,0%");
    expect(formatPercent(0)).toBe("+0,0%");
  });
});
