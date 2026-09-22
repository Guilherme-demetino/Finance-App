import React from "react";
import { Text as RNText, TextInput, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import SubscriptionsScreen from "../app/dashboard/subscriptions";
import { SubscriptionsCard } from "../components/subscriptions/SubscriptionsCard";
import { DashboardProviders } from "../context/DashboardProviders";
import { useTransactionsMutations } from "../context/TransactionsContext";
import { getAllPriceChanges, getAllSubscriptions } from "../database/subscriptions";
import { resetDatabase } from "../database/sqlite";
import { createTransaction } from "../database/transactions";
import { createSqlJsDatabase } from "../test/sqliteFake";
import { formatDateToString } from "../utils/dates";

/**
 * Integração das assinaturas: o painel, a tela, o cartão do Início e o banco de verdade (SQLite em memória).
 * Só o roteador e os módulos nativos são trocados.
 */
const mockState: { db: unknown } = { db: null };
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() };

jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-print", () => ({ printAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: async () => false, shareAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: class {}, Paths: { cache: "cache" } }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(),
  OrientationLock: { LANDSCAPE: 1, PORTRAIT_UP: 2 },
}));
jest.mock("react-native-reanimated", () => jest.requireActual("../test/reanimatedMock").createReanimatedMock());

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.setTimeout(20_000);

const mounted: ReactTestRenderer[] = [];

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

const field = (tree: ReactTestRenderer, label: string) => {
  const found = tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === label);
  if (!found) throw new Error(`campo "${label}" não encontrado`);
  return found;
};

/** O botão mais interno com esse rótulo ou texto (o último achado). */
function button(tree: ReactTestRenderer, label: string) {
  const matches = tree.root
    .findAllByType(TouchableOpacity)
    .filter(
      (node) =>
        node.props.accessibilityLabel === label || node.findAllByType(RNText).some((t) => flat(t.props.children) === label),
    );
  if (matches.length === 0) throw new Error(`botão "${label}" não encontrado\n${textOf(tree)}`);
  return matches[matches.length - 1];
}

const press = async (tree: ReactTestRenderer, label: string) => {
  await act(async () => {
    await button(tree, label).props.onPress();
  });
};
const type = (tree: ReactTestRenderer, label: string, value: string) => act(() => field(tree, label).props.onChangeText(value));
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });

async function mountScreen(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <DashboardProviders>
        <SubscriptionsScreen />
      </DashboardProviders>,
    );
  });
  mounted.push(tree);
  await settle();
  return tree;
}

async function mountCard(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <DashboardProviders>
        <SubscriptionsCard />
      </DashboardProviders>,
    );
  });
  mounted.push(tree);
  await settle();
  return tree;
}

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateToString(date);
};

/** Cadastra uma assinatura pelo formulário. */
async function createViaForm(tree: ReactTestRenderer, values: { name: string; cents: string; day: string; match?: string }) {
  await press(tree, "Adicionar assinatura");
  type(tree, "Nome da assinatura", values.name);
  type(tree, "Valor da assinatura", values.cents);
  type(tree, "Dia da cobrança", values.day);
  if (values.match) type(tree, "Texto da cobrança", values.match);
  await press(tree, "Criar assinatura");
  await settle();
}

/** Uma assinatura já cadastrada há um mês, para as cobranças recentes contarem. */
async function seed(name: string, amount: number, over: { matchText?: string; cycle?: "monthly" | "yearly"; billingMonth?: number | null } = {}) {
  const { createSubscription } = jest.requireActual<typeof import("../database/subscriptions")>("../database/subscriptions");
  return createSubscription(
    { name, amount, cycle: over.cycle ?? "monthly", billingDay: 5, billingMonth: over.billingMonth ?? null, category: "Lazer", matchText: over.matchText ?? "" },
    daysAgo(40),
  );
}

async function charge(description: string, amount: number, date: string) {
  await createTransaction({ amount, date, description, type: "expense", category: "Lazer" });
}

beforeAll(async () => {
  mockState.db = await createSqlJsDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  Object.values(mockRouter).forEach((fn) => fn.mockReset());
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
  jest.restoreAllMocks();
});

describe("tela de assinaturas", () => {
  it("sem assinaturas explica o que fazer, com total zero", async () => {
    const tree = await mountScreen();

    expect(textOf(tree)).toContain("Nenhuma assinatura ainda");
    expect(textOf(tree)).toContain("R$ 0,00");
  });

  it("cria pelo formulário, mostra a próxima cobrança e soma no total mensal", async () => {
    const tree = await mountScreen();

    await createViaForm(tree, { name: "Netflix", cents: "3990", day: "5" });
    await createViaForm(tree, { name: "Spotify", cents: "2190", day: "10" });

    expect(textOf(tree)).toContain("Assinatura criada.");
    expect(textOf(tree)).toContain("R$ 61,80");
    expect(textOf(tree)).toContain("2 ativas");
    expect(textOf(tree)).toMatch(/Próxima cobrança: \d\d\/\d\d \((hoje|amanhã|em \d+ dias)\)/);
    expect((await getAllSubscriptions()).map((row) => [row.name, row.amount])).toEqual([["Netflix", 39.9], ["Spotify", 21.9]]);
  });

  it("formulário inválido avisa e não grava", async () => {
    const tree = await mountScreen();
    await press(tree, "Adicionar assinatura");

    await press(tree, "Criar assinatura");
    expect(textOf(tree)).toContain("Dê um nome à assinatura.");

    type(tree, "Nome da assinatura", "Netflix");
    await press(tree, "Criar assinatura");
    expect(textOf(tree)).toContain("Digite o valor da assinatura.");
    expect(await getAllSubscriptions()).toEqual([]);
  });

  it("assinatura anual entra no total dividida por 12", async () => {
    await seed("Discord", 120, { cycle: "yearly", billingMonth: 8 });

    const tree = await mountScreen();

    expect(textOf(tree)).toContain("R$ 10,00");
    expect(textOf(tree)).toContain("R$ 120,00 por ano");
    expect(textOf(tree)).toContain("R$ 10,00/mês");
  });

  it("pausar tira do total e reativar devolve", async () => {
    await seed("Netflix", 39.9);
    const tree = await mountScreen();
    expect(textOf(tree)).toContain("R$ 39,90");

    await press(tree, "Pausar assinatura Netflix");

    expect(textOf(tree)).toContain("Assinatura pausada.");
    expect(textOf(tree)).toContain("0 ativas");
    expect(textOf(tree)).toContain("Pausada: não entra no total.");

    await press(tree, "Reativar assinatura Netflix");
    expect(textOf(tree)).toContain("1 ativa");
  });

  it("excluir pede confirmação e apaga a assinatura", async () => {
    await seed("Netflix", 39.9);
    const tree = await mountScreen();

    await press(tree, "Excluir assinatura Netflix");
    expect(textOf(tree)).toContain("Excluir a assinatura Netflix");
    await press(tree, "Excluir");

    expect(textOf(tree)).toContain("Assinatura excluída.");
    expect(await getAllSubscriptions()).toEqual([]);
  });

  it("editar o valor registra o reajuste e mostra de quanto para quanto", async () => {
    await seed("Netflix", 39.9);
    const tree = await mountScreen();

    await press(tree, "Editar assinatura Netflix");
    expect(field(tree, "Valor da assinatura").props.value).toBe("39,90");
    type(tree, "Valor da assinatura", "4490");
    await press(tree, "Salvar alterações");
    await settle();

    expect(textOf(tree)).toContain("Assinatura atualizada.");
    expect(textOf(tree)).toContain(`Reajustada em ${formatDateToString(new Date())}: de R$ 39,90 para R$ 44,90 (+12,5%)`);
    expect(await getAllPriceChanges()).toHaveLength(1);
  });
});

describe("alerta de reajuste", () => {
  it("uma cobrança mais cara nas despesas vira alerta, com o impacto por mês", async () => {
    await seed("Netflix", 39.9);
    await charge("NETFLIX.COM", 44.9, daysAgo(3));

    const tree = await mountScreen();

    expect(textOf(tree)).toContain("Reajuste: Netflix");
    expect(textOf(tree)).toContain("veio R$ 44,90, e você tinha cadastrado R$ 39,90 (+12,5%)");
    expect(textOf(tree)).toContain("No total, +R$ 5,00 por mês.");
  });

  it("'Atualizar' passa o valor cadastrado para o da cobrança, guarda o reajuste e some o alerta", async () => {
    await seed("Netflix", 39.9);
    await charge("Netflix", 44.9, daysAgo(3));
    const tree = await mountScreen();

    await press(tree, "Atualizar o valor de Netflix");
    await settle();

    expect(textOf(tree)).toContain("Valor de Netflix atualizado para R$ 44,90.");
    expect(textOf(tree)).not.toContain("Reajuste: Netflix");
    expect((await getAllSubscriptions())[0].amount).toBe(44.9);
    expect(await getAllPriceChanges()).toEqual([expect.objectContaining({ old_amount: 39.9, new_amount: 44.9 })]);
    expect(textOf(tree)).toContain("R$ 44,90");
  });

  it("'Ignorar' some com o alerta e ele não volta com essa mesma cobrança, mas volta com outro valor", async () => {
    await seed("Netflix", 39.9);
    await charge("Netflix", 44.9, daysAgo(5));
    const tree = await mountScreen();

    await press(tree, "Ignorar o alerta de Netflix");
    await settle();
    expect(textOf(tree)).not.toContain("Reajuste: Netflix");

    // Reabre o painel: continua ignorado.
    act(() => mounted.splice(0).forEach((t) => t.unmount()));
    const again = await mountScreen();
    expect(textOf(again)).not.toContain("Reajuste: Netflix");

    // Uma cobrança nova, com outro valor, alerta de novo.
    await charge("Netflix", 49.9, daysAgo(1));
    act(() => mounted.splice(0).forEach((t) => t.unmount()));
    const third = await mountScreen();
    expect(textOf(third)).toContain("veio R$ 49,90");
  });

  it("acha a cobrança pelo texto definido, e o IOF com o mesmo nome não gera alerta", async () => {
    await seed("Música", 21.9, { matchText: "spotify" });
    await charge("IOF de Spotify", 0.82, daysAgo(2));
    await charge("SPOTIFY AB *PREMIUM", 23.9, daysAgo(3));

    const tree = await mountScreen();

    expect(textOf(tree)).toContain("veio R$ 23,90");
    expect(textOf(tree)).not.toContain("veio R$ 0,82");
  });

  it("cobrança igual ao valor cadastrado não alerta", async () => {
    await seed("Netflix", 39.9);
    await charge("Netflix", 39.9, daysAgo(3));

    const tree = await mountScreen();

    expect(textOf(tree)).not.toContain("Reajuste");
  });

  it("uma despesa lançada com a tela aberta faz o alerta aparecer na hora, sem reabrir", async () => {
    await seed("Netflix", 39.9);
    const captured: { save?: ReturnType<typeof useTransactionsMutations>["saveTransaction"] } = {};
    function Probe() {
      captured.save = useTransactionsMutations().saveTransaction;
      return null;
    }
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <DashboardProviders>
          <SubscriptionsScreen />
          <Probe />
        </DashboardProviders>,
      );
    });
    mounted.push(tree);
    await settle();
    expect(textOf(tree)).not.toContain("Reajuste");

    await act(async () => {
      await captured.save!(null, { amount: 44.9, date: formatDateToString(new Date()), description: "Netflix", type: "expense", category: "Lazer" });
    });
    await settle();

    expect(textOf(tree)).toContain("Reajuste: Netflix");
  });
});

describe("cartão das assinaturas no Início", () => {
  it("sem assinaturas convida a cadastrar", async () => {
    const tree = await mountCard();

    expect(textOf(tree)).toContain("Controle o que você paga todo mês");
  });

  it("mostra o total por mês e quantas estão ativas", async () => {
    await seed("Netflix", 39.9);
    await seed("Spotify", 21.9);

    const tree = await mountCard();

    expect(textOf(tree)).toContain("R$ 61,80 por mês · 2 ativas");
  });

  it("destaca o reajuste e abre a tela de assinaturas ao tocar", async () => {
    await seed("Netflix", 39.9);
    await charge("Netflix", 44.9, daysAgo(2));
    const tree = await mountCard();

    expect(textOf(tree)).toContain("Reajuste em Netflix");
    await press(tree, "Assinaturas: R$ 39,90 por mês, 1 reajuste");

    expect(mockRouter.push).toHaveBeenCalledWith("/dashboard/subscriptions");
  });
});
