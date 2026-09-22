import { createSqlJsDatabase } from "../test/sqliteFake";

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
    subs: jest.requireActual<typeof import("./subscriptions")>("./subscriptions"),
    sqlite,
  };
}

type Modules = Awaited<ReturnType<typeof load>>;

const NETFLIX: import("./subscriptions").SubscriptionData = { name: "  Netflix ", amount: 39.9, cycle: "monthly", billingDay: 5, billingMonth: null, category: "Lazer", matchText: "" };

async function create(m: Modules, over: Partial<typeof NETFLIX> = {}, today = "01/08/2026") {
  const id = await m.subs.createSubscription({ ...NETFLIX, ...over }, today);
  return (await m.subs.getAllSubscriptions()).find((row) => row.id === id)!;
}

describe("assinaturas", () => {
  it("cria com o nome sem espaços, ativa, valendo desde hoje e sem o texto de cobrança", async () => {
    const m = await load();

    const row = await create(m);

    expect(row).toEqual({
      id: row.id,
      name: "Netflix",
      amount: 39.9,
      cycle: "monthly",
      billing_day: 5,
      billing_month: null,
      category: "Lazer",
      match_text: null,
      active: 1,
      created_date: "01/08/2026",
      price_since: "01/08/2026",
      ignored_amount: null,
    });
  });

  it("anual guarda o mês; mensal descarta o mês que vier", async () => {
    const m = await load();

    const yearly = await create(m, { name: "Discord", cycle: "yearly", billingMonth: 8, amount: 183.26 });
    const monthly = await create(m, { name: "Spotify", billingMonth: 8 });

    expect(yearly.billing_month).toBe(8);
    expect(monthly.billing_month).toBeNull();
  });

  it("lista as ativas primeiro, por nome", async () => {
    const m = await load();
    const b = await create(m, { name: "Beta" });
    await create(m, { name: "alfa" });
    await m.subs.setSubscriptionActive(b.id, false);
    await create(m, { name: "Zeta" });

    expect((await m.subs.getAllSubscriptions()).map((row) => row.name)).toEqual(["alfa", "Zeta", "Beta"]);
  });

  it("editar sem mudar o valor não cria reajuste", async () => {
    const m = await load();
    const row = await create(m);

    await m.subs.updateSubscription(row.id, { ...NETFLIX, name: "Netflix Premium", matchText: " netflix " }, "10/09/2026");

    const [edited] = await m.subs.getAllSubscriptions();
    expect(edited).toMatchObject({ name: "Netflix Premium", match_text: "netflix", price_since: "01/08/2026" });
    expect(await m.subs.getAllPriceChanges()).toEqual([]);
  });

  it("mudar o valor anota o reajuste, passa a valer desde hoje e limpa a cobrança ignorada", async () => {
    const m = await load();
    const row = await create(m);
    await m.subs.ignoreDetectedPrice(row.id, 44.9);

    await m.subs.updateSubscription(row.id, { ...NETFLIX, amount: 49.9 }, "10/09/2026");

    const [edited] = await m.subs.getAllSubscriptions();
    expect(edited).toMatchObject({ amount: 49.9, price_since: "10/09/2026", ignored_amount: null });
    expect(await m.subs.getAllPriceChanges()).toEqual([{ id: expect.any(Number), subscription_id: row.id, date: "10/09/2026", old_amount: 39.9, new_amount: 49.9 }]);
  });

  it("aceitar o reajuste achado usa a data da cobrança, e aceitar o mesmo valor não faz nada", async () => {
    const m = await load();
    const row = await create(m);

    await m.subs.applyDetectedPrice(row.id, 44.9, "05/09/2026");
    await m.subs.applyDetectedPrice(row.id, 44.9, "05/09/2026");

    expect((await m.subs.getAllSubscriptions())[0]).toMatchObject({ amount: 44.9, price_since: "05/09/2026" });
    expect(await m.subs.getAllPriceChanges()).toHaveLength(1);
  });

  it("pausar e reativar", async () => {
    const m = await load();
    const row = await create(m);

    await m.subs.setSubscriptionActive(row.id, false);
    expect((await m.subs.getAllSubscriptions())[0].active).toBe(0);

    await m.subs.setSubscriptionActive(row.id, true);
    expect((await m.subs.getAllSubscriptions())[0].active).toBe(1);
  });

  it("excluir apaga a assinatura e o histórico de reajustes dela, e só dela", async () => {
    const m = await load();
    const a = await create(m);
    const b = await create(m, { name: "Spotify", amount: 21.9 });
    await m.subs.updateSubscription(a.id, { ...NETFLIX, amount: 45 }, "10/09/2026");
    await m.subs.updateSubscription(b.id, { ...NETFLIX, name: "Spotify", amount: 25 }, "10/09/2026");

    await m.subs.deleteSubscription(a.id);

    expect((await m.subs.getAllSubscriptions()).map((row) => row.name)).toEqual(["Spotify"]);
    expect((await m.subs.getAllPriceChanges()).map((change) => change.subscription_id)).toEqual([b.id]);
  });

  it("zerar os dados do app apaga as assinaturas e os reajustes", async () => {
    const m = await load();
    const row = await create(m);
    await m.subs.updateSubscription(row.id, { ...NETFLIX, amount: 50 }, "10/09/2026");

    await m.sqlite.resetDatabase();

    expect(await m.subs.getAllSubscriptions()).toEqual([]);
    expect(await m.subs.getAllPriceChanges()).toEqual([]);
  });
});
