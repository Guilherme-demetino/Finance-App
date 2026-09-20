import React from "react";
import { Linking, Switch, Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { createFakeScheduler } from "../test/fakeReminderScheduler";
import type { DebtRow } from "../types";
import RemindersScreen from "./reminders";

const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() };
const mockEnv = {
  meta: new Map<string, string>(),
  debts: [] as DebtRow[],
  fake: null as unknown as ReturnType<typeof createFakeScheduler>,
};

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("../services/dueRemindersDeps", () => {
  const deps = {
    getMeta: async (key: string) => mockEnv.meta.get(key) ?? null,
    setMeta: async (key: string, value: string) => {
      mockEnv.meta.set(key, value);
    },
    readDebts: async () => mockEnv.debts,
    readRecurringExpenses: async () => [],
    get scheduler() {
      return mockEnv.fake.scheduler;
    },
    now: () => new Date(2026, 8, 19, 10, 0),
  };
  return { realDueReminderDeps: deps };
});

// Os alertas de orçamento têm testes próprios; aqui só precisam existir sem tocar no banco.
jest.mock("../services/budgetAlertsDeps", () => {
  const { createFakeBudgetDeps: create } = jest.requireActual("../test/fakeBudgetAlertDeps");
  return { realBudgetAlertDeps: create().deps };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

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

async function mount(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RemindersScreen />);
  });
  mounted.push(tree);
  return tree;
}

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

/** O interruptor dos lembretes de vencimento (a tela tem outro, o dos alertas de orçamento). */
const reminderSwitch = (tree: ReactTestRenderer) => {
  const found = tree.root.findAllByType(Switch).find((node) => node.props.accessibilityLabel === "Avisar antes de vencer");
  if (!found) throw new Error("interruptor dos lembretes não encontrado");
  return found;
};

function button(tree: ReactTestRenderer, label: string) {
  const found = tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === label));
  if (!found) throw new Error(`botão "${label}" não encontrado`);
  return found;
}

beforeEach(() => {
  Object.values(mockRouter).forEach((fn) => fn.mockReset());
  mockEnv.meta.clear();
  mockEnv.debts = [];
  mockEnv.fake = createFakeScheduler();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.restoreAllMocks();
});

describe("tela Lembretes e alertas", () => {
  it("começa desligada, explica e mostra as opções", async () => {
    const tree = await mount();
    const text = textOf(tree);

    expect(reminderSwitch(tree).props.value).toBe(false);
    expect(text).toContain("Avisar antes de vencer");
    expect(text).toContain("No dia | 1 dia antes | 2 dias antes | 3 dias antes | 7 dias antes");
    expect(text).toContain("08:00 | 09:00 | 12:00 | 18:00 | 20:00");
    expect(text).toContain("Nenhuma conta a vencer nos próximos 60 dias");
    expect(button(tree, "1 dia antes").props.accessibilityState.selected).toBe(true);
    expect(button(tree, "09:00").props.accessibilityState.selected).toBe(true);
  });

  it("mostra os próximos avisos mesmo desligada, e sugere ligar", async () => {
    mockEnv.debts = [debt()];

    const text = textOf(await mount());

    expect(text).toContain("20/09 às 09:00");
    expect(text).toContain("Pagar Maria vence amanhã");
    expect(text).toContain("Ligue");
  });

  it("ligar pede a permissão, liga e agenda", async () => {
    mockEnv.debts = [debt()];
    mockEnv.fake = createFakeScheduler({ granted: false, willGrant: true });
    const tree = await mount();

    await act(async () => {
      await reminderSwitch(tree).props.onValueChange(true);
    });

    expect(mockEnv.fake.state.requested).toBe(1);
    expect(reminderSwitch(tree).props.value).toBe(true);
    expect([...mockEnv.fake.state.scheduled.keys()]).toEqual(["due-reminder-20260921"]);
    expect(textOf(tree)).not.toContain("Ligue");
  });

  it("permissão negada: continua desligada e explica o que fazer", async () => {
    mockEnv.fake = createFakeScheduler({ granted: false, willGrant: false });
    const tree = await mount();

    await act(async () => {
      await reminderSwitch(tree).props.onValueChange(true);
    });

    expect(reminderSwitch(tree).props.value).toBe(false);
    expect(textOf(tree)).toContain("Sem a permissão de notificação o app não consegue avisar");

    // Segunda recusa: o Android não pergunta mais, só pelas configurações.
    await act(async () => {
      await reminderSwitch(tree).props.onValueChange(true);
    });
    expect(textOf(tree)).toContain("As notificações do app estão bloqueadas no Android");
  });

  it("ligada mas bloqueada nas configurações do Android: avisa e leva às configurações", async () => {
    mockEnv.meta.set("due_reminders_enabled", "1");
    mockEnv.fake = createFakeScheduler({ granted: false });
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    const tree = await mount();

    expect(textOf(tree)).toContain("As notificações estão bloqueadas para o app no Android");

    await act(async () => {
      button(tree, "Abrir configurações do Android").props.onPress();
    });
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it("trocar a antecedência e a hora reagenda e atualiza os próximos avisos", async () => {
    mockEnv.debts = [debt()];
    const tree = await mount();
    await act(async () => {
      await reminderSwitch(tree).props.onValueChange(true);
    });

    await act(async () => {
      await button(tree, "No dia").props.onPress();
    });
    await act(async () => {
      await button(tree, "18:00").props.onPress();
    });

    expect(button(tree, "No dia").props.accessibilityState.selected).toBe(true);
    expect(button(tree, "18:00").props.accessibilityState.selected).toBe(true);
    expect(textOf(tree)).toContain("21/09 às 18:00");
    expect(textOf(tree)).toContain("Pagar Maria vence hoje");
    expect(mockEnv.fake.state.scheduled.get("due-reminder-20260921")?.date).toEqual(new Date(2026, 8, 21, 18, 0));
  });

  it("desligar cancela os avisos agendados", async () => {
    mockEnv.debts = [debt()];
    const tree = await mount();
    await act(async () => {
      await reminderSwitch(tree).props.onValueChange(true);
    });
    expect(mockEnv.fake.state.scheduled.size).toBe(1);

    await act(async () => {
      await reminderSwitch(tree).props.onValueChange(false);
    });

    expect(reminderSwitch(tree).props.value).toBe(false);
    expect(mockEnv.fake.state.scheduled.size).toBe(0);
  });

  it("o botão de teste agenda uma notificação para poucos segundos", async () => {
    const tree = await mount();

    await act(async () => {
      await button(tree, "Enviar notificação de teste").props.onPress();
    });

    expect(mockEnv.fake.state.scheduled.get("reminder-test")?.date).toEqual(new Date(2026, 8, 19, 10, 0, 5));
    expect(textOf(tree)).toContain("chega em cerca de 5 segundos");
  });

  it("o botão de voltar volta para a tela anterior, ou para o painel se não houver", async () => {
    const tree = await mount();
    const back = tree.root.findAllByType(TouchableOpacity)[0];

    mockRouter.canGoBack.mockReturnValue(true);
    act(() => back.props.onPress());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);

    mockRouter.canGoBack.mockReturnValue(false);
    act(() => back.props.onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith("/dashboard");
  });
});
