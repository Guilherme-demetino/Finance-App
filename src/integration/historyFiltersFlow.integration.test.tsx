import React from "react";
import { Text as RNText, TextInput, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { useAccountFilter } from "../context/AccountFilterContext";
import { DashboardProviders } from "../context/DashboardProviders";
import { useTransactionsData } from "../context/TransactionsContext";
import DashboardHistoryScreen from "../app/dashboard/history";
import { resetDatabase } from "../database/sqlite";
import { createTransaction } from "../database/transactions";
import { createSqlJsDatabase } from "../test/sqliteFake";

/**
 * Integração: a tela do histórico com filtros avançados, pelo modal de verdade, com providers e
 * banco de verdade (SQLite em memória). Só os módulos nativos e a animação são trocados.
 */
const mockState: { db: unknown } = { db: null };

jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));
jest.mock("expo-image-picker", () => ({}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(),
  OrientationLock: { LANDSCAPE: 1, PORTRAIT_UP: 2 },
}));
jest.mock("react-native-reanimated", () => {
  const RN = jest.requireActual("react-native");
  const chain = () => {
    const animation: Record<string, () => unknown> = {};
    for (const method of ["duration", "delay", "springify", "damping"]) animation[method] = () => animation;
    return animation;
  };
  return {
    __esModule: true,
    default: { View: RN.View, ScrollView: RN.ScrollView },
    FadeIn: chain(),
    FadeInDown: chain(),
    useAnimatedScrollHandler: () => () => {},
    useSharedValue: (initial: number) => {
      const { useRef } = jest.requireActual<typeof import("react")>("react");
      return useRef({ value: initial, get: () => initial, set: () => {} }).current;
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.setTimeout(20_000);

const pad = (n: number) => String(n).padStart(2, "0");
const now = new Date();
const thisMonth = (day: number) => `${pad(day)}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
const previous = new Date(now.getFullYear(), now.getMonth() - 1, 15);
const previousMonth = `15/${pad(previous.getMonth() + 1)}/${previous.getFullYear()}`;
const lastYear = `20/12/${now.getFullYear() - 1}`;

// Tudo do mês atual no dia 1 (sempre no passado); o mês anterior no dia 15 (dentro dos últimos 90 dias);
// e um lançamento de dezembro do ano passado (fora deles, na maior parte do ano).
async function seed() {
  const add = (description: string, amount: number, type: "income" | "expense", category: string, date: string) =>
    createTransaction({ description, amount, type, category, date });
  await add("Mercado", 50, "expense", "Alimentação", thisMonth(1));
  await add("Cinema", 120, "expense", "Lazer", thisMonth(1));
  await add("Salário", 3000, "income", "Salário", thisMonth(1));
  await add("Aluguel", 900, "expense", "Moradia", previousMonth);
  await add("Pizza", 80, "expense", "Alimentação", previousMonth);
  await add("Viagem", 1500, "expense", "Lazer", lastYear);
}

const seen = {} as { data: ReturnType<typeof useTransactionsData>; accountFilter: ReturnType<typeof useAccountFilter> };
function Probe() {
  Object.assign(seen, { data: useTransactionsData(), accountFilter: useAccountFilter() });
  return null;
}

const mounted: ReactTestRenderer[] = [];
let tree: ReactTestRenderer;
const settle = (ms = 40) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const screenText = () =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

/** Descrições das transações que aparecem na lista (para não depender do resto do texto). */
const listed = () => ["Mercado", "Cinema", "Salário", "Aluguel", "Pizza", "Viagem"].filter((name) => screenText().includes(name));

/** Botões pelo rótulo de acessibilidade ou, na falta dele, pelo texto (do mais externo ao mais interno). */
const byLabel = (label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .filter(
      (node) =>
        node.props.accessibilityLabel === label ||
        (node.props.accessibilityLabel === undefined && node.findAllByType(RNText).some((t) => flat(t.props.children) === label)),
    );
const has = (label: string) => byLabel(label).length > 0;
const press = async (label: string) => {
  const found = byLabel(label);
  if (found.length === 0) throw new Error(`botão "${label}" não encontrado`);
  await act(async () => {
    found[found.length - 1].props.onPress();
  });
  await settle();
};
const typeInto = async (label: string, digits: string) => {
  const input = tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === label);
  if (!input) throw new Error(`campo "${label}" não encontrado`);
  await act(async () => {
    input.props.onChangeText(digits);
  });
};

const openFilters = () => press("Filtros avançados");
const apply = () => press("Aplicar filtros");

beforeAll(async () => {
  mockState.db = await createSqlJsDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  await seed();
  jest.spyOn(console, "error").mockImplementation(() => {});
  await act(async () => {
    tree = create(
      <DashboardProviders>
        <Probe />
        <DashboardHistoryScreen />
      </DashboardProviders>,
    );
    mounted.push(tree);
  });
  await settle();
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.restoreAllMocks();
});

describe("histórico com filtros avançados (tela + banco)", () => {
  it("sem filtros mostra só o mês selecionado, como sempre", () => {
    expect(listed()).toEqual(["Mercado", "Cinema", "Salário"]);
    expect(screenText()).toContain("Filtros");
    expect(screenText()).not.toContain("Filtros (");
    expect(has("Apagar todas as transações do período")).toBe(true);
  });

  it("faixa de valor: só o que está dentro, com o resumo do que apareceu", async () => {
    await openFilters();
    await typeInto("Valor mínimo", "10000"); // R$ 100,00
    await typeInto("Valor máximo", "500000"); // R$ 5.000,00
    await apply();

    expect(listed()).toEqual(["Cinema", "Salário"]);
    const text = screenText();
    expect(text).toContain("Filtros (1)");
    expect(text).toContain("Valor: R$ 100,00 a R$ 5.000,00");
    expect(text).toContain("2 transações");
    expect(text).toContain("Receitas R$ 3.000,00");
    expect(text).toContain("Despesas R$ 120,00");
  });

  it("várias categorias: aparecem as de qualquer uma delas", async () => {
    await openFilters();
    await press("Categoria Alimentação");
    await press("Categoria Lazer");
    await apply();

    expect(listed()).toEqual(["Mercado", "Cinema"]);
    expect(screenText()).toContain("Categorias: Alimentação, Lazer");
  });

  it("período personalizado busca fora do mês: os últimos 90 dias trazem o mês anterior", async () => {
    await openFilters();
    await press("Período: Personalizado");
    await press("Usar Últimos 90 dias");
    await apply();

    expect(listed()).toEqual(["Mercado", "Cinema", "Salário", "Aluguel", "Pizza"]);
    expect(listed()).not.toContain("Viagem");
    expect(screenText()).toContain("5 transações");
  });

  it("período personalizado também respeita a conta em foco", async () => {
    await act(async () => {
      await createTransaction({ description: "Financiamento", amount: 900, type: "expense", category: "Moradia", date: previousMonth, account: "Poupança" });
    });
    await settle();

    await openFilters();
    await press("Período: Personalizado");
    await press("Usar Últimos 90 dias");
    await apply();
    expect(screenText()).toContain("Financiamento");
    expect(listed()).toEqual(["Mercado", "Cinema", "Salário", "Aluguel", "Pizza"]);

    await act(async () => {
      seen.accountFilter.setSelectedAccount("Poupança");
    });
    await settle();

    expect(screenText()).toContain("Financiamento");
    expect(listed()).toEqual([]);
  });

  it("os três filtros juntos: período, categoria e valor", async () => {
    await openFilters();
    await press("Período: Personalizado");
    await press("Usar Últimos 90 dias");
    await press("Categoria Alimentação");
    await typeInto("Valor mínimo", "6000"); // R$ 60,00: tira o Mercado (50) e mantém a Pizza (80)
    await apply();

    expect(listed()).toEqual(["Pizza"]);
    expect(screenText()).toContain("Filtros (3)");
    expect(screenText()).toContain("1 transação");
  });

  it("a busca por texto continua valendo junto com os filtros", async () => {
    await openFilters();
    await press("Período: Personalizado");
    await press("Usar Últimos 90 dias");
    await apply();

    const search = tree.root.findAllByType(TextInput).find((node) => String(node.props.placeholder).startsWith("Buscar"));
    await act(async () => {
      search?.props.onChangeText("piz");
    });

    expect(listed()).toEqual(["Pizza"]);
  });

  it("cada etiqueta remove só o seu filtro; 'Limpar filtros' volta ao mês", async () => {
    await openFilters();
    await press("Categoria Lazer");
    await typeInto("Valor mínimo", "10000");
    await apply();
    expect(listed()).toEqual(["Cinema"]);

    await press("Remover filtro: Valor: a partir de R$ 100,00");
    expect(listed()).toEqual(["Cinema"]); // ainda só Lazer
    expect(screenText()).toContain("Filtros (1)");

    await press("Limpar todos os filtros");
    expect(listed()).toEqual(["Mercado", "Cinema", "Salário"]);
    expect(screenText()).not.toContain("Filtros (");
  });

  it("nada casa: mensagem de que nenhuma transação foi encontrada", async () => {
    await openFilters();
    await typeInto("Valor mínimo", "99999900");
    await apply();

    expect(listed()).toEqual([]);
    expect(screenText()).toContain("Nenhuma transação encontrada");
    expect(screenText()).toContain("0 transações");
  });

  it("com filtro ativo, o 'apagar tudo' some: ele apagaria o mês inteiro, não o que aparece", async () => {
    await openFilters();
    await press("Categoria Lazer");
    await apply();

    expect(has("Apagar todas as transações do período")).toBe(false);

    await press("Limpar todos os filtros");
    expect(has("Apagar todas as transações do período")).toBe(true);
  });

  it("apagar uma transação com o período ativo atualiza a lista do período", async () => {
    await openFilters();
    await press("Período: Personalizado");
    await press("Usar Últimos 90 dias");
    await apply();
    expect(listed()).toContain("Cinema");

    const cinema = seen.data.formattedTransactions.find((item) => item.description === "Cinema");
    await act(async () => {
      await seen.data.handleDeleteTransaction(cinema!.id);
    });
    await settle(80);

    expect(listed()).toEqual(["Mercado", "Salário", "Aluguel", "Pizza"]);
    expect(screenText()).toContain("4 transações");
  });

  it("as categorias padrão do app ficam disponíveis mesmo sem transações delas no que está listado", async () => {
    await openFilters();

    for (const name of ["Transporte", "Saúde", "Moradia", "Investimentos"]) {
      expect(has(`Categoria ${name}`)).toBe(true);
    }
    // Sem repetir a que já aparece na lista.
    expect(byLabel("Categoria Lazer")).toHaveLength(1);
  });

  it("o formulário reabre com o que estava aplicado", async () => {
    await openFilters();
    await press("Categoria Moradia");
    await typeInto("Valor máximo", "100000");
    await apply();

    await press("Filtros avançados, 2 ativos");

    const max = tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === "Valor máximo");
    expect(max?.props.value).toBe("1.000,00");
    expect(byLabel("Categoria Moradia")[0].props.accessibilityState.checked).toBe(true);
  });
});
