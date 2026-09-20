import React from "react";
import { Linking, Switch, Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { BUDGET_ALERT_META } from "../services/budgetAlerts";
import { createFakeBudgetDeps } from "../test/fakeBudgetAlertDeps";
import { BudgetAlertsCard } from "./BudgetAlertsCard";

const mockEnv: { fake: ReturnType<typeof createFakeBudgetDeps> | null } = { fake: null };

jest.mock("../services/budgetAlertsDeps", () => ({
  realBudgetAlertDeps: new Proxy(
    {},
    { get: (_target, key) => (mockEnv.fake?.deps as unknown as Record<string | symbol, unknown>)[key] },
  ),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

async function mount() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<BudgetAlertsCard />);
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

const toggle = (tree: ReactTestRenderer) => tree.root.findByType(Switch);
const hasButton = (tree: ReactTestRenderer, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .some((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === label));
function button(tree: ReactTestRenderer, label: string) {
  const found = tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === label));
  if (!found) throw new Error(`botão "${label}" não encontrado`);
  return found;
}

beforeEach(() => {
  mockEnv.fake = createFakeBudgetDeps();
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.restoreAllMocks();
});

describe("cartão Alertas de orçamento", () => {
  it("começa desligado e explica o que faz, com o limite de 80% igual ao dos avisos do Início", async () => {
    const tree = await mount();
    const text = textOf(tree);

    expect(toggle(tree).props.value).toBe(false);
    expect(text).toContain("Alertas de orçamento");
    expect(text).toContain("chega a 80% da meta do mês ou passa dela");
    expect(text).toContain("Vale também para o orçamento do mês");
    expect(text).toContain("Cada aviso vem uma vez por mês e por categoria");
    expect(text).toContain("o que já estava perto do limite não vira aviso");
  });

  it("ligar pede a permissão, liga e guarda", async () => {
    mockEnv.fake = createFakeBudgetDeps({ granted: false, willGrant: true });
    const tree = await mount();

    await act(async () => {
      await toggle(tree).props.onValueChange(true);
    });

    expect(mockEnv.fake.state.requested).toBe(1);
    expect(toggle(tree).props.value).toBe(true);
    expect(mockEnv.fake.meta.get(BUDGET_ALERT_META.enabled)).toBe("1");
  });

  it("permissão negada: continua desligado e explica; na segunda recusa, manda para as configurações", async () => {
    mockEnv.fake = createFakeBudgetDeps({ granted: false, willGrant: false });
    const tree = await mount();

    await act(async () => {
      await toggle(tree).props.onValueChange(true);
    });
    expect(toggle(tree).props.value).toBe(false);
    expect(textOf(tree)).toContain("Sem a permissão de notificação o app não consegue avisar");

    await act(async () => {
      await toggle(tree).props.onValueChange(true);
    });
    expect(textOf(tree)).toContain("As notificações do app estão bloqueadas no Android");
  });

  it("desligar apaga o estado e desliga", async () => {
    const tree = await mount();
    await act(async () => {
      await toggle(tree).props.onValueChange(true);
    });

    await act(async () => {
      await toggle(tree).props.onValueChange(false);
    });

    expect(toggle(tree).props.value).toBe(false);
    expect(mockEnv.fake?.meta.get(BUDGET_ALERT_META.enabled)).toBe("0");
    expect(mockEnv.fake?.meta.get(BUDGET_ALERT_META.state)).toBe("");
  });

  it("ligado mas bloqueado nas configurações do Android: avisa e leva às configurações", async () => {
    mockEnv.fake = createFakeBudgetDeps({ granted: false });
    mockEnv.fake.meta.set(BUDGET_ALERT_META.enabled, "1");
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    const tree = await mount();

    expect(textOf(tree)).toContain("As notificações estão bloqueadas para o app no Android, então nenhum alerta chega.");
    await act(async () => {
      button(tree, "Abrir configurações do Android").props.onPress();
    });

    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it("o botão de teste manda um alerta de exemplo", async () => {
    const tree = await mount();

    await act(async () => {
      await button(tree, "Enviar alerta de teste").props.onPress();
    });

    expect(mockEnv.fake?.state.notified).toEqual([expect.objectContaining({ id: "budget-alert-test" })]);
    expect(textOf(tree)).toContain("Alerta de teste enviado");
  });

  it("teste sem permissão: pede e, se negarem, explica", async () => {
    mockEnv.fake = createFakeBudgetDeps({ granted: false, willGrant: false });
    const tree = await mount();

    await act(async () => {
      await button(tree, "Enviar alerta de teste").props.onPress();
    });

    expect(mockEnv.fake.state.notified).toEqual([]);
    expect(textOf(tree)).toContain("Sem a permissão de notificação");
  });

  it("enquanto lê o estado, o botão de teste ainda não aparece", () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<BudgetAlertsCard />);
    });
    mounted.push(tree);

    expect(hasButton(tree, "Enviar alerta de teste")).toBe(false);
    expect(toggle(tree).props.disabled).toBe(true);
  });
});
