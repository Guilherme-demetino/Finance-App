import type { DebtRow, TransactionRow } from "../types";
import {
  collectDueItems,
  DEFAULT_REMINDER_SETTINGS,
  formatReminderTime,
  parseDueDate,
  parseReminderSettings,
  planReminders,
  reminderDaysLabel,
  reminderHourLabel,
  type DueItem,
  type ReminderSettings,
} from "./dueReminders";

// Sábado, 19/09/2026, 10:00 (horário local).
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

const expense = (over: Partial<TransactionRow> = {}): TransactionRow => ({
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

const item = (over: Partial<DueItem> = {}): DueItem => ({
  id: "x",
  label: "Aluguel",
  amount: 1500,
  due: new Date(2026, 8, 21),
  kind: "pay",
  ...over,
});

const settings = (over: Partial<ReminderSettings> = {}): ReminderSettings => ({
  ...DEFAULT_REMINDER_SETTINGS,
  enabled: true,
  ...over,
});

describe("parseDueDate", () => {
  it("lê DD/MM/AAAA, com ou sem zero à esquerda", () => {
    expect(parseDueDate("21/09/2026")).toEqual(new Date(2026, 8, 21));
    expect(parseDueDate("1/9/2026")).toEqual(new Date(2026, 8, 1));
  });

  it("recusa o que não é data de verdade (não vira hoje em silêncio)", () => {
    for (const bad of ["31/02/2026", "", "abc", "2026-09-21", "21/13/2026", null, undefined]) {
      expect(parseDueDate(bad)).toBeNull();
    }
  });
});

describe("parseReminderSettings", () => {
  it("sem nada salvo: desligado, 1 dia antes, às 09:00", () => {
    expect(parseReminderSettings({ enabled: null, daysBefore: null, hour: null })).toEqual({
      enabled: false,
      daysBefore: 1,
      hour: 9,
    });
  });

  it("lê o que foi salvo e ignora valores fora das opções", () => {
    expect(parseReminderSettings({ enabled: "1", daysBefore: "7", hour: "18" })).toEqual({
      enabled: true,
      daysBefore: 7,
      hour: 18,
    });
    expect(parseReminderSettings({ enabled: "talvez", daysBefore: "5", hour: "25" })).toEqual({
      enabled: false,
      daysBefore: 1,
      hour: 9,
    });
  });
});

describe("collectDueItems", () => {
  const collect = (debts: DebtRow[], transactions: TransactionRow[] = []) =>
    collectDueItems({ debts, transactions, today: NOW });

  it("dívida a pagar e a receber, com o verbo certo", () => {
    const items = collect([debt(), debt({ id: 2, person: "João", type: "lent" })]);

    expect(items.map((i) => [i.label, i.kind])).toEqual([
      ["Pagar Maria", "pay"],
      ["Cobrar João", "receive"],
    ]);
  });

  it("deixa de fora dívida quitada, sem vencimento, com data inválida e já vencida; vence hoje entra", () => {
    const items = collect([
      debt({ id: 1, status: "settled" }),
      debt({ id: 2, due_date: null }),
      debt({ id: 3, due_date: "31/02/2026" }),
      debt({ id: 4, due_date: "18/09/2026" }),
      debt({ id: 5, due_date: "19/09/2026" }),
    ]);

    expect(items.map((i) => i.id)).toEqual(["debt-5"]);
  });

  it("parcela mostra o número; recorrente usa só o nome; sem descrição usa a categoria", () => {
    const items = collect(
      [],
      [
        expense(),
        expense({
          id: 11,
          description: "Internet",
          recurrence_type: "recurring",
          installment_number: null,
          installment_total: null,
        }),
        expense({ id: 12, description: "  ", category_id: "moradia" }),
      ],
    );

    expect(items.map((i) => i.label)).toEqual(["Notebook (parcela 2/5)", "Internet", "moradia (parcela 2/5)"]);
  });

  it("parcela que já vem salva como Notebook (2/5) não repete o número", () => {
    const [only] = collect([], [expense({ description: "Notebook (2/5)" })]);

    expect(only.label).toBe("Notebook (2/5)");
  });

  it("ignora receita, transação avulsa, data passada e data inválida", () => {
    const items = collect(
      [],
      [
        expense({ id: 1, type: "income" }),
        expense({ id: 2, recurrence_type: null }),
        expense({ id: 3, date: "10/09/2026" }),
        expense({ id: 4, date: "xx" }),
        expense({ id: 5 }),
      ],
    );

    expect(items.map((i) => i.id)).toEqual(["transaction-5"]);
  });
});

describe("planReminders", () => {
  it("1 dia antes, às 09:00 (o padrão): chega na véspera do vencimento", () => {
    const [reminder] = planReminders({
      items: [item({ label: "Pagar Maria", amount: 100 })],
      settings: settings(),
      now: NOW,
    });

    expect(reminder.fireAt).toEqual(new Date(2026, 8, 20, 9, 0));
    expect(reminder.title).toBe("Pagar Maria vence amanhã");
    expect(reminder.body).toBe("R$ 100,00 · 21/09/2026");
    expect(reminder.id).toBe("due-reminder-20260921");
  });

  it("no dia avisa no próprio vencimento; 3 dias antes diz em 3 dias", () => {
    const [sameDay] = planReminders({ items: [item()], settings: settings({ daysBefore: 0, hour: 8 }), now: NOW });
    expect(sameDay.fireAt).toEqual(new Date(2026, 8, 21, 8, 0));
    expect(sameDay.title).toBe("Aluguel vence hoje");

    const [early] = planReminders({
      items: [item({ due: new Date(2026, 8, 25) })],
      settings: settings({ daysBefore: 3 }),
      now: NOW,
    });
    expect(early.fireAt).toEqual(new Date(2026, 8, 22, 9, 0));
    expect(early.title).toBe("Aluguel vence em 3 dias");
  });

  it("se o horário de aviso já passou mas o vencimento não, avisa no dia do vencimento", () => {
    const [reminder] = planReminders({ items: [item()], settings: settings({ daysBefore: 7 }), now: NOW });

    expect(reminder.fireAt).toEqual(new Date(2026, 8, 21, 9, 0));
    expect(reminder.title).toBe("Aluguel vence hoje");
  });

  it("vence hoje e a hora do aviso já passou: não agenda nada", () => {
    const today = item({ due: new Date(2026, 8, 19) });

    expect(planReminders({ items: [today], settings: settings({ hour: 9 }), now: NOW })).toEqual([]);
    // Ainda dá tempo se o horário for à noite.
    expect(planReminders({ items: [today], settings: settings({ hour: 20 }), now: NOW })).toHaveLength(1);
  });

  it("vários vencimentos no mesmo dia viram um aviso só, pagamentos antes dos recebimentos", () => {
    const [reminder, ...rest] = planReminders({
      items: [
        item({ id: "a", label: "Cobrar João", amount: 50, kind: "receive" }),
        item({ id: "b", label: "Pagar Maria", amount: 100 }),
        item({ id: "c", label: "Aluguel", amount: 1500 }),
      ],
      settings: settings(),
      now: NOW,
    });

    expect(rest).toEqual([]);
    expect(reminder.itemCount).toBe(3);
    expect(reminder.title).toBe("3 vencimentos amanhã");
    expect(reminder.body).toBe("• Aluguel: R$ 1.500,00\n• Pagar Maria: R$ 100,00\n• Cobrar João: R$ 50,00");
  });

  it("aviso com muitas linhas resume o resto", () => {
    const many = Array.from({ length: 8 }, (_, i) => item({ id: String(i), label: `Conta ${i}` }));

    const [reminder] = planReminders({ items: many, settings: settings(), now: NOW });

    expect(reminder.body.split("\n")).toHaveLength(7);
    expect(reminder.body.endsWith("e mais 2")).toBe(true);
    expect(reminder.itemCount).toBe(8);
  });

  it("dias diferentes viram avisos diferentes, do mais próximo ao mais distante", () => {
    const reminders = planReminders({
      items: [item({ id: "far", due: new Date(2026, 9, 5) }), item({ id: "near", due: new Date(2026, 8, 21) })],
      settings: settings(),
      now: NOW,
    });

    expect(reminders.map((r) => r.id)).toEqual(["due-reminder-20260921", "due-reminder-20261005"]);
  });

  it("não agenda além de 60 dias e limita a 40 avisos", () => {
    const beyond = item({ due: new Date(2026, 11, 25) });
    expect(planReminders({ items: [beyond], settings: settings(), now: NOW })).toEqual([]);

    // 50 dias seguidos ainda cabem no horizonte; só o teto de 40 corta.
    const dense = Array.from({ length: 50 }, (_, i) => item({ id: String(i), due: new Date(2026, 8, 21 + i) }));
    const planned = planReminders({ items: dense, settings: settings(), now: NOW });
    expect(planned).toHaveLength(40);
    expect(planned[0].id).toBe("due-reminder-20260921");
  });
});

describe("rótulos", () => {
  it("antecedência, hora e horário do aviso", () => {
    expect(reminderDaysLabel(0)).toBe("No dia");
    expect(reminderDaysLabel(1)).toBe("1 dia antes");
    expect(reminderDaysLabel(7)).toBe("7 dias antes");
    expect(reminderHourLabel(9)).toBe("09:00");
    expect(formatReminderTime(new Date(2026, 8, 20, 9, 0))).toBe("20/09 às 09:00");
  });
});
