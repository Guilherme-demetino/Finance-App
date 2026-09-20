import { createFakeBudgetDeps, monthWith } from "../test/fakeBudgetAlertDeps";
import {
  BUDGET_ALERT_META,
  disableBudgetAlerts,
  enableBudgetAlerts,
  getBudgetAlertsEnabled,
  resetBudgetAlertState,
  runBudgetAlerts,
  sendTestBudgetAlert,
} from "./budgetAlerts";

const GOALS = { Alimentação: 1000, Lazer: 200 };

beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

/** Alertas ligados, com o ponto de partida já anotado. */
async function ready(spent: Record<string, number>, budget: number | null = null) {
  const fake = createFakeBudgetDeps({ month: monthWith(spent, GOALS, budget) });
  await enableBudgetAlerts(fake.deps);
  return fake;
}

describe("alertas desligados", () => {
  it("por padrão não fazem nada: nem leem o banco nem avisam", async () => {
    const fake = createFakeBudgetDeps({ month: monthWith({ Alimentação: 5000 }, GOALS) });

    await expect(runBudgetAlerts(fake.deps)).resolves.toEqual({ status: "disabled" });

    expect(fake.state.reads).toEqual([]);
    expect(fake.state.notified).toEqual([]);
    expect(await getBudgetAlertsEnabled(fake.deps)).toBe(false);
  });
});

describe("ligar", () => {
  it("pede a permissão, liga e anota o ponto de partida SEM avisar o que já estava perto do limite", async () => {
    const fake = createFakeBudgetDeps({ granted: false, month: monthWith({ Alimentação: 950 }, GOALS) });

    await expect(enableBudgetAlerts(fake.deps)).resolves.toEqual({ status: "enabled" });

    expect(fake.state.requested).toBe(1);
    expect(await getBudgetAlertsEnabled(fake.deps)).toBe(true);
    expect(fake.state.notified).toEqual([]);
    expect(JSON.parse(fake.meta.get(BUDGET_ALERT_META.state) as string)).toMatchObject({
      period: "2026-09",
      items: { "category:alimentação": { level: 1, spent: 950 } },
    });
  });

  it("com a permissão já dada, não pergunta de novo", async () => {
    const fake = createFakeBudgetDeps();

    await enableBudgetAlerts(fake.deps);

    expect(fake.state.requested).toBe(0);
  });

  it("permissão negada: não liga, e diz se ainda dá para pedir de novo", async () => {
    const fake = createFakeBudgetDeps({ granted: false, willGrant: false });

    expect(await enableBudgetAlerts(fake.deps)).toEqual({ status: "denied", canAskAgain: true });
    expect(await enableBudgetAlerts(fake.deps)).toEqual({ status: "denied", canAskAgain: false });

    expect(await getBudgetAlertsEnabled(fake.deps)).toBe(false);
    expect(fake.meta.get(BUDGET_ALERT_META.enabled)).toBeUndefined();
  });
});

describe("avisar quando o gasto cruza o limite", () => {
  it("chegar perto avisa uma vez; estourar avisa de novo; continuar gastando não repete", async () => {
    const fake = await ready({ Alimentação: 300 });

    fake.state.month = monthWith({ Alimentação: 850 }, GOALS);
    await expect(runBudgetAlerts(fake.deps)).resolves.toEqual({ status: "checked", notified: 1 });
    await runBudgetAlerts(fake.deps);
    expect(fake.state.notified).toHaveLength(1);
    expect(fake.state.notified[0]).toMatchObject({
      title: "Alimentação: perto do limite",
      body: "Você já usou 85% da meta do mês (R$ 850,00 de R$ 1.000,00).",
    });

    fake.state.month = monthWith({ Alimentação: 1120 }, GOALS);
    await runBudgetAlerts(fake.deps);
    expect(fake.state.notified).toHaveLength(2);
    expect(fake.state.notified[1]).toMatchObject({
      title: "Alimentação: meta estourada",
      body: "Você passou R$ 120,00 da meta do mês (R$ 1.120,00 de R$ 1.000,00).",
    });

    fake.state.month = monthWith({ Alimentação: 1300 }, GOALS);
    await runBudgetAlerts(fake.deps);
    expect(fake.state.notified).toHaveLength(2);
  });

  it("o orçamento do mês também avisa", async () => {
    const fake = await ready({ Alimentação: 300 }, 2000);

    fake.state.month = monthWith({ Alimentação: 300, Outros: 1500 }, GOALS, 2000);
    await runBudgetAlerts(fake.deps);

    expect(fake.state.notified).toHaveLength(1);
    expect(fake.state.notified[0].title).toBe("Orçamento do mês: quase no limite");
  });

  it("vários limites cruzados juntos viram uma notificação só", async () => {
    const fake = await ready({ Alimentação: 100, Lazer: 10 });

    fake.state.month = monthWith({ Alimentação: 900, Lazer: 250 }, GOALS);
    const result = await runBudgetAlerts(fake.deps);

    expect(result).toEqual({ status: "checked", notified: 2 });
    expect(fake.state.notified).toHaveLength(1);
    expect(fake.state.notified[0]).toMatchObject({
      title: "2 alertas de orçamento",
      body: "• Alimentação: 90% usado\n• Lazer: estourou em R$ 50,00",
    });
  });

  it("lê o mês e o ano de hoje", async () => {
    const fake = await ready({});

    fake.state.reads.length = 0;
    await runBudgetAlerts(fake.deps);

    expect(fake.state.reads).toEqual([["09", "2026"]]);
  });

  it("apagar ou reduzir o gasto e cruzar de novo avisa de novo", async () => {
    const fake = await ready({ Alimentação: 900 });
    fake.state.month = monthWith({ Alimentação: 1100 }, GOALS);
    await runBudgetAlerts(fake.deps);
    expect(fake.state.notified).toHaveLength(1);

    fake.state.month = monthWith({ Alimentação: 200 }, GOALS);
    await runBudgetAlerts(fake.deps);
    fake.state.month = monthWith({ Alimentação: 1100 }, GOALS);
    await runBudgetAlerts(fake.deps);

    expect(fake.state.notified).toHaveLength(2);
  });

  it("virou o mês: recomeça do zero", async () => {
    const fake = await ready({ Alimentação: 1100 });
    fake.state.now = new Date(2026, 9, 2, 9, 0); // outubro
    fake.state.month = monthWith({ Alimentação: 850 }, GOALS);

    await runBudgetAlerts(fake.deps);

    expect(fake.state.notified).toHaveLength(1);
    expect(fake.state.reads.at(-1)).toEqual(["10", "2026"]);
  });
});

describe("quando não dá para avisar", () => {
  it("sem permissão do Android: não calcula nem avança; ao voltar a permissão, avisa o que cruzou", async () => {
    const fake = await ready({ Alimentação: 300 });
    fake.state.granted = false;
    fake.state.month = monthWith({ Alimentação: 850 }, GOALS);

    await expect(runBudgetAlerts(fake.deps)).resolves.toEqual({ status: "no-permission" });
    expect(fake.state.notified).toHaveLength(0);

    fake.state.granted = true;
    await runBudgetAlerts(fake.deps);
    expect(fake.state.notified).toHaveLength(1);
  });

  it("se a notificação falha, o estado não avança e a próxima vez tenta de novo", async () => {
    const fake = await ready({ Alimentação: 300 });
    fake.state.month = monthWith({ Alimentação: 850 }, GOALS);
    fake.state.notifyError = new Error("sem canal");

    await expect(runBudgetAlerts(fake.deps)).rejects.toThrow("sem canal");
    expect(fake.state.notified).toHaveLength(0);

    fake.state.notifyError = null;
    await runBudgetAlerts(fake.deps);
    expect(fake.state.notified).toHaveLength(1);
  });

  it("duas verificações ao mesmo tempo avisam uma vez só", async () => {
    const fake = await ready({ Alimentação: 300 });
    fake.state.month = monthWith({ Alimentação: 850 }, GOALS);

    await Promise.all([runBudgetAlerts(fake.deps), runBudgetAlerts(fake.deps), runBudgetAlerts(fake.deps)]);

    expect(fake.state.notified).toHaveLength(1);
  });
});

describe("recomeçar", () => {
  it("depois de esquecer o que foi avisado (restaurar ou zerar), o próximo cálculo é silencioso", async () => {
    const fake = await ready({ Alimentação: 100 });
    await resetBudgetAlertState(fake.deps);
    fake.state.month = monthWith({ Alimentação: 1500 }, GOALS);

    await expect(runBudgetAlerts(fake.deps)).resolves.toEqual({ status: "checked", notified: 0 });

    expect(fake.state.notified).toEqual([]);

    // Daí em diante volta a avisar: o que cruza depois do ponto de partida é novidade.
    fake.state.month = monthWith({ Alimentação: 1500, Lazer: 190 }, GOALS);
    await runBudgetAlerts(fake.deps);
    expect(fake.state.notified).toHaveLength(1);
    expect(fake.state.notified[0].title).toBe("Lazer: perto do limite");
  });

  it("desligar apaga o estado; ligar de novo anota um novo ponto de partida", async () => {
    const fake = await ready({ Alimentação: 100 });

    await disableBudgetAlerts(fake.deps);
    expect(await getBudgetAlertsEnabled(fake.deps)).toBe(false);
    expect(fake.meta.get(BUDGET_ALERT_META.state)).toBe("");
    await expect(runBudgetAlerts(fake.deps)).resolves.toEqual({ status: "disabled" });

    fake.state.month = monthWith({ Alimentação: 950 }, GOALS);
    await enableBudgetAlerts(fake.deps);
    expect(fake.state.notified).toEqual([]);
  });
});

describe("alerta de teste", () => {
  it("manda um exemplo na hora", async () => {
    const fake = createFakeBudgetDeps();

    await expect(sendTestBudgetAlert(fake.deps)).resolves.toEqual({ status: "sent" });

    expect(fake.state.notified).toEqual([
      expect.objectContaining({ id: "budget-alert-test", title: "Teste de alerta: Alimentação" }),
    ]);
  });

  it("sem permissão, pede; se negarem, não manda", async () => {
    const fake = createFakeBudgetDeps({ granted: false, willGrant: false });

    await expect(sendTestBudgetAlert(fake.deps)).resolves.toEqual({ status: "denied", canAskAgain: true });

    expect(fake.state.notified).toEqual([]);
  });
});
