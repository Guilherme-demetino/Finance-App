import { createFakeScheduler } from "../test/fakeReminderScheduler";
import type { DebtRow, TransactionRow } from "../types";
import {
  disableDueReminders,
  enableDueReminders,
  getReminderSettings,
  previewDueReminders,
  REMINDER_META,
  sendTestReminder,
  syncDueReminders,
  TEST_REMINDER_ID,
  updateReminderTiming,
  type DueReminderDeps,
} from "./dueReminders";

// Sábado, 19/09/2026, 10:00.
const NOW = new Date(2026, 8, 19, 10, 0);

const debt = (over: Partial<DebtRow> = {}): DebtRow => ({
  id: 1,
  person: "Maria",
  amount: 100,
  type: "borrowed",
  description: null,
  date: "01/09/2026",
  status: "pending",
  settled_date: null,
  due_date: "21/09/2026",
  ...over,
});

const installment = (over: Partial<TransactionRow> = {}): TransactionRow => ({
  id: 10,
  amount: 250,
  date: "25/09/2026",
  description: "Notebook",
  type: "expense",
  category_id: "outros",
  recurrence_group_id: "g1",
  recurrence_type: "installment",
  installment_number: 2,
  installment_total: 5,
  ...over,
});

function setup(scheduler = createFakeScheduler(), initial: { debts?: DebtRow[]; rows?: TransactionRow[]; meta?: Record<string, string> } = {}) {
  const meta = new Map<string, string>(Object.entries(initial.meta ?? {}));
  const data = { debts: initial.debts ?? [], rows: initial.rows ?? [] };
  const deps: DueReminderDeps = {
    getMeta: async (key) => meta.get(key) ?? null,
    setMeta: async (key, value) => {
      meta.set(key, value);
    },
    readDebts: async () => data.debts,
    readRecurringExpenses: async () => data.rows,
    scheduler: scheduler.scheduler,
    now: () => NOW,
  };
  return { deps, meta, data, ...scheduler };
}

const ON = { [REMINDER_META.enabled]: "1" };

describe("syncDueReminders", () => {
  it("desligado: não agenda nada e cancela o que sobrou, sem mexer em notificações de outra origem", async () => {
    const t = setup(undefined, { debts: [debt()] });
    t.state.scheduled.set("due-reminder-20260920", { id: "due-reminder-20260920", title: "x", body: "", date: NOW });
    t.state.scheduled.set(TEST_REMINDER_ID, { id: TEST_REMINDER_ID, title: "teste", body: "", date: NOW });
    t.state.scheduled.set("outra-coisa", { id: "outra-coisa", title: "y", body: "", date: NOW });

    await expect(syncDueReminders(t.deps)).resolves.toEqual({ status: "disabled" });

    expect([...t.state.scheduled.keys()].sort()).toEqual(["outra-coisa", TEST_REMINDER_ID]);
  });

  it("ligado: agenda uma notificação por dia de vencimento, dívidas e parcelas juntas", async () => {
    const t = setup(undefined, {
      meta: ON,
      debts: [debt()],
      rows: [installment(), installment({ id: 11, description: "Celular", installment_number: 1, installment_total: 3, date: "25/09/2026" })],
    });

    await expect(syncDueReminders(t.deps)).resolves.toEqual({ status: "scheduled", count: 2 });

    const scheduled = [...t.state.scheduled.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
    expect(scheduled.map((r) => [r.id, r.title, r.date])).toEqual([
      ["due-reminder-20260921", "Pagar Maria vence amanhã", new Date(2026, 8, 20, 9, 0)],
      ["due-reminder-20260925", "2 vencimentos amanhã", new Date(2026, 8, 24, 9, 0)],
    ]);
    expect(scheduled[1].body).toBe("• Celular (parcela 1/3): R$ 250,00\n• Notebook (parcela 2/5): R$ 250,00");
    expect(t.state.prepared).toBeGreaterThan(0);
  });

  it("reagenda conforme os dados mudam: dívida quitada ou apagada some, nova aparece, sem duplicar", async () => {
    const t = setup(undefined, { meta: ON, debts: [debt(), debt({ id: 2, person: "João", due_date: "23/09/2026" })] });
    await syncDueReminders(t.deps);
    expect([...t.state.scheduled.keys()].sort()).toEqual(["due-reminder-20260921", "due-reminder-20260923"]);

    t.data.debts = [debt({ id: 2, person: "João", due_date: "23/09/2026" }), debt({ id: 3, person: "Ana", due_date: "30/09/2026" })];
    await syncDueReminders(t.deps);
    expect([...t.state.scheduled.keys()].sort()).toEqual(["due-reminder-20260923", "due-reminder-20260930"]);

    await syncDueReminders(t.deps);
    expect(t.state.scheduled.size).toBe(2);
  });

  it("sem permissão do Android: cancela o que havia e avisa que não agendou", async () => {
    const t = setup(createFakeScheduler({ granted: false }), { meta: ON, debts: [debt()] });
    t.state.scheduled.set("due-reminder-20260921", { id: "due-reminder-20260921", title: "x", body: "", date: NOW });

    await expect(syncDueReminders(t.deps)).resolves.toEqual({ status: "no-permission" });

    expect(t.state.scheduled.size).toBe(0);
  });

  it("sincronizações ao mesmo tempo rodam uma depois da outra (não se atropelam)", async () => {
    const t = setup(undefined, { meta: ON, debts: [debt()] });
    const log: string[] = [];
    const originalRead = t.deps.readDebts;
    t.deps.readDebts = async () => {
      log.push("lê");
      await new Promise((resolve) => setTimeout(resolve, 5));
      return originalRead();
    };
    const originalSchedule = t.deps.scheduler.schedule;
    t.deps.scheduler.schedule = async (reminder) => {
      log.push("agenda");
      await originalSchedule(reminder);
    };

    await Promise.all([syncDueReminders(t.deps), syncDueReminders(t.deps)]);

    expect(log).toEqual(["lê", "agenda", "lê", "agenda"]);
    expect(t.state.scheduled.size).toBe(1);
  });

  it("uma sincronização que falha não trava as seguintes", async () => {
    const t = setup(undefined, { meta: ON, debts: [debt()] });
    const originalRead = t.deps.readDebts;
    t.deps.readDebts = async () => {
      throw new Error("banco fora do ar");
    };
    await expect(syncDueReminders(t.deps)).rejects.toThrow("banco fora do ar");

    t.deps.readDebts = originalRead;
    await expect(syncDueReminders(t.deps)).resolves.toEqual({ status: "scheduled", count: 1 });
  });
});

describe("ligar e desligar", () => {
  it("ligar pede a permissão, salva e agenda", async () => {
    const t = setup(createFakeScheduler({ granted: false, willGrant: true }), { debts: [debt()] });

    await expect(enableDueReminders(t.deps)).resolves.toEqual({ status: "enabled", count: 1 });

    expect(t.state.requested).toBe(1);
    expect(t.meta.get(REMINDER_META.enabled)).toBe("1");
    expect(t.state.scheduled.size).toBe(1);
  });

  it("com a permissão já dada, não pergunta de novo", async () => {
    const t = setup(undefined, { debts: [debt()] });

    await enableDueReminders(t.deps);

    expect(t.state.requested).toBe(0);
  });

  it("permissão negada: não liga nem agenda, e diz se ainda dá para pedir de novo", async () => {
    const t = setup(createFakeScheduler({ granted: false, willGrant: false }), { debts: [debt()] });

    await expect(enableDueReminders(t.deps)).resolves.toEqual({ status: "denied", canAskAgain: true });
    await expect(enableDueReminders(t.deps)).resolves.toEqual({ status: "denied", canAskAgain: false });

    expect(t.meta.get(REMINDER_META.enabled)).toBeUndefined();
    expect(t.state.scheduled.size).toBe(0);
  });

  it("desligar salva e cancela tudo", async () => {
    const t = setup(undefined, { meta: ON, debts: [debt()] });
    await syncDueReminders(t.deps);
    expect(t.state.scheduled.size).toBe(1);

    await disableDueReminders(t.deps);

    expect(t.meta.get(REMINDER_META.enabled)).toBe("0");
    expect(t.state.scheduled.size).toBe(0);
  });
});

describe("preferências", () => {
  it("mudar a antecedência ou a hora reagenda e é lembrado", async () => {
    const t = setup(undefined, { meta: ON, debts: [debt()] });
    await syncDueReminders(t.deps);

    await updateReminderTiming(t.deps, { daysBefore: 0, hour: 18 });

    expect(await getReminderSettings(t.deps)).toEqual({ enabled: true, daysBefore: 0, hour: 18 });
    const [reminder] = [...t.state.scheduled.values()];
    expect(reminder.date).toEqual(new Date(2026, 8, 21, 18, 0));
    expect(reminder.title).toBe("Pagar Maria vence hoje");
  });

  it("os próximos avisos aparecem mesmo com os lembretes desligados (sem agendar nada)", async () => {
    const t = setup(undefined, { debts: [debt()] });

    const preview = await previewDueReminders(t.deps);

    expect(preview.map((r) => r.title)).toEqual(["Pagar Maria vence amanhã"]);
    expect(t.state.scheduled.size).toBe(0);
  });
});

describe("notificação de teste", () => {
  it("agenda para daqui a 5 segundos e a sincronização não a cancela", async () => {
    const t = setup(undefined, { meta: ON });

    await expect(sendTestReminder(t.deps)).resolves.toEqual({ status: "sent" });
    await syncDueReminders(t.deps);

    const test = t.state.scheduled.get(TEST_REMINDER_ID);
    expect(test?.date).toEqual(new Date(NOW.getTime() + 5000));
  });

  it("sem permissão, pede; se negarem, não agenda", async () => {
    const t = setup(createFakeScheduler({ granted: false, willGrant: false }));

    await expect(sendTestReminder(t.deps)).resolves.toEqual({ status: "denied", canAskAgain: true });

    expect(t.state.scheduled.size).toBe(0);
  });
});
