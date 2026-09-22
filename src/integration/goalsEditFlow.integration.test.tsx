import React from "react";
import { Text as RNText, TextInput, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import DashboardBudgetScreen from "../app/dashboard/budget";
import { SavingsModalsContainer } from "../components/dashboard/SavingsModalsContainer";
import { useAlertState } from "../context/AlertContext";
import { DashboardProviders } from "../context/DashboardProviders";
import { getCategoryBudgets, setCategoryBudget } from "../database/categoryBudgets";
import { createSavingsGoal, getAllSavingsGoals } from "../database/savingsGoals";
import { resetDatabase } from "../database/sqlite";
import { createTransaction } from "../database/transactions";
import { createSqlJsDatabase } from "../test/sqliteFake";

/**
 * Integração: editar metas de economia e metas por categoria na tela do Orçamento, pelos botões de
 * verdade, com providers e banco de verdade (SQLite em memória). Só os módulos nativos e a animação
 * são trocados.
 */
const mockState: { db: unknown } = { db: null };

jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));
jest.mock("expo-image-picker", () => ({}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(),
  OrientationLock: { LANDSCAPE: 1, PORTRAIT_UP: 2 },
}));
jest.mock("react-native-reanimated", () => jest.requireActual("../test/reanimatedMock").createReanimatedMock());
// O calendário tem testes próprios.
jest.mock("../components/forms/CalendarPicker", () => ({ CalendarPicker: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.setTimeout(20_000);

const pad = (n: number) => String(n).padStart(2, "0");
const now = new Date();
const MONTH = pad(now.getMonth() + 1);
const YEAR = String(now.getFullYear());
const firstOfMonth = `01/${MONTH}/${YEAR}`;

async function seed() {
  await createSavingsGoal({ name: "Viagem", targetAmount: 5000, savedAmount: 1250.5, deadline: "31/12/2030", createdDate: "01/09/2026" });
  await createSavingsGoal({ name: "Carro", targetAmount: 30000, savedAmount: 0, deadline: null, createdDate: "01/09/2026" });
  // O gasto do mês é o que faz a categoria aparecer na lista de metas.
  await createTransaction({ description: "Mercado", amount: 300, type: "expense", category: "Alimentação", date: firstOfMonth });
  await createTransaction({ description: "Cinema", amount: 50, type: "expense", category: "Lazer", date: firstOfMonth });
  await setCategoryBudget("Alimentação", MONTH, YEAR, 500, false);
}

const seen = {} as { alert: ReturnType<typeof useAlertState> };
function Probe() {
  Object.assign(seen, { alert: useAlertState() });
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

/** Botões pelo rótulo de acessibilidade ou, na falta dele, pelo texto (o mais interno por último). */
const buttons = (label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .filter(
      (node) =>
        node.props.accessibilityLabel === label ||
        (node.props.accessibilityLabel === undefined && node.findAllByType(RNText).some((t) => flat(t.props.children) === label)),
    );
const has = (label: string) => buttons(label).length > 0;
const press = async (label: string) => {
  const found = buttons(label);
  if (found.length === 0) throw new Error(`botão "${label}" não encontrado`);
  await act(async () => {
    found[found.length - 1].props.onPress();
  });
  await settle();
};
const field = (label: string) => {
  const found = tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === label);
  if (!found) throw new Error(`campo "${label}" não encontrado`);
  return found;
};
const typeInto = async (label: string, value: string) => {
  await act(async () => {
    field(label).props.onChangeText(value);
  });
};

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
        <DashboardBudgetScreen />
        <SavingsModalsContainer />
      </DashboardProviders>,
    );
    mounted.push(tree);
  });
  await settle(80);
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.restoreAllMocks();
});

const goalNamed = async (name: string) => (await getAllSavingsGoals()).find((goal) => goal.name === name)!;
const categoryGoal = async (category: string) =>
  (await getCategoryBudgets(MONTH, YEAR)).find((row) => row.category.toLowerCase() === category.toLowerCase());

describe("botões de editar na tela do Orçamento", () => {
  it("cada meta de economia e cada categoria têm o botão Editar", () => {
    for (const name of ["Viagem", "Carro"]) expect(has(`Editar meta ${name}`)).toBe(true);
    for (const name of ["Alimentação", "Lazer"]) expect(has(`Editar meta de ${name}`)).toBe(true);
  });
});

describe("editar meta de economia (tela + banco)", () => {
  it("abre o formulário preenchido, salva as mudanças no banco e atualiza o cartão", async () => {
    await press("Editar meta Viagem");

    expect(screenText()).toContain("Editar meta de economia");
    expect(field("Nome da meta").props.value).toBe("Viagem");
    expect(field("Valor da meta").props.value).toBe("5.000,00");
    expect(field("Valor já guardado").props.value).toBe("1.250,50");

    await act(async () => {
      field("Nome da meta").props.onChangeText("Viagem ao Japão");
    });
    await typeInto("Valor da meta", "900000");
    await typeInto("Valor já guardado", "150000");
    await press("Salvar alterações");
    await settle(80);

    expect(await goalNamed("Viagem ao Japão")).toMatchObject({ target_amount: 9000, saved_amount: 1500, deadline: "31/12/2030" });
    expect((await getAllSavingsGoals()).map((goal) => goal.name).sort()).toEqual(["Carro", "Viagem ao Japão"]);
    const text = screenText();
    expect(text).toContain("Viagem ao Japão");
    expect(text).toContain("R$ 1.500,00 de R$ 9.000,00");
    expect(seen.alert.alertMessage).toBe("Meta de economia atualizada.");
    // O formulário fecha.
    expect(has("Salvar alterações")).toBe(false);
  });

  it("só a meta editada muda; a outra fica igual", async () => {
    await press("Editar meta Viagem");
    await typeInto("Valor da meta", "1000000");
    await press("Salvar alterações");
    await settle(80);

    expect(await goalNamed("Carro")).toMatchObject({ target_amount: 30000, saved_amount: 0 });
  });

  it("dá para tirar o prazo da meta", async () => {
    await press("Editar meta Viagem");

    await press("Remover prazo");
    await press("Salvar alterações");
    await settle(80);

    expect((await goalNamed("Viagem")).deadline).toBeNull();
  });

  it("nome apagado: avisa e não altera nada no banco", async () => {
    await press("Editar meta Viagem");
    await act(async () => {
      field("Nome da meta").props.onChangeText("   ");
    });

    await press("Salvar alterações");

    expect(screenText()).toContain("Preencha o nome da meta e o valor que você quer juntar.");
    expect(await goalNamed("Viagem")).toMatchObject({ target_amount: 5000 });
  });

  it("editar não vira criar: sem duplicar a meta", async () => {
    await press("Editar meta Carro");
    await typeInto("Valor da meta", "4000000");
    await press("Salvar alterações");
    await settle(80);

    expect(await getAllSavingsGoals()).toHaveLength(2);
    expect(await goalNamed("Carro")).toMatchObject({ target_amount: 40000 });
  });

  it("editar outra meta depois abre o formulário com os dados dela", async () => {
    await press("Editar meta Viagem");
    await press("Salvar alterações");
    await settle(80);

    await press("Editar meta Carro");

    expect(field("Nome da meta").props.value).toBe("Carro");
    expect(field("Valor da meta").props.value).toBe("30.000,00");
    expect(field("Valor já guardado").props.value).toBe("");
  });
});

describe("editar metas por categoria (tela + banco)", () => {
  it("abre com a meta atual, salva o novo valor no banco e atualiza o cartão", async () => {
    await press("Editar meta de Alimentação");
    expect(field("Valor da meta de Alimentação").props.value).toBe("500,00");

    await typeInto("Valor da meta de Alimentação", "75000");
    await press("Salvar meta de Alimentação");
    await settle(80);

    expect(await categoryGoal("Alimentação")).toMatchObject({ amount: 750 });
    expect(screenText()).toContain("R$ 300,00 de R$ 750,00");
    expect(screenText()).toContain("R$ 450,00 restantes");
  });

  it("define a meta de uma categoria que ainda não tinha", async () => {
    expect(await categoryGoal("Lazer")).toBeUndefined();

    await press("Editar meta de Lazer");
    expect(field("Valor da meta de Lazer").props.value).toBe("");
    await typeInto("Valor da meta de Lazer", "20000");
    await press("Salvar meta de Lazer");
    await settle(80);

    expect(await categoryGoal("Lazer")).toMatchObject({ amount: 200 });
    expect(screenText()).toContain("R$ 50,00 de R$ 200,00");
  });

  it("remover meta: pede confirmação, apaga do banco e o cartão volta a convidar para definir", async () => {
    await press("Editar meta de Alimentação");
    await press("Remover meta de Alimentação");
    expect(await categoryGoal("Alimentação")).toMatchObject({ amount: 500 }); // ainda não

    await press("Remover");
    await settle(80);

    expect(await categoryGoal("Alimentação")).toBeUndefined();
    expect(screenText()).toContain("R$ 300,00 gastos • toque para definir uma meta");
    // A categoria e os gastos continuam.
    expect(has("Editar meta de Alimentação")).toBe(true);
  });

  it("cancelar a remoção mantém a meta", async () => {
    await press("Editar meta de Alimentação");
    await press("Remover meta de Alimentação");

    await press("Cancelar");

    expect(await categoryGoal("Alimentação")).toMatchObject({ amount: 500 });
  });

  it("salvar vazio avisa e não mexe na meta que existe", async () => {
    await press("Editar meta de Alimentação");
    await typeInto("Valor da meta de Alimentação", "");

    await press("Salvar meta de Alimentação");

    expect(screenText()).toContain('Digite um valor maior que zero, ou use "Remover meta".');
    expect(await categoryGoal("Alimentação")).toMatchObject({ amount: 500 });
  });

  it("remover a meta de uma categoria não mexe nas de outras", async () => {
    await setCategoryBudget("Lazer", MONTH, YEAR, 200, false);
    await act(async () => {
      tree.update(
        <DashboardProviders>
          <Probe />
          <DashboardBudgetScreen />
          <SavingsModalsContainer />
        </DashboardProviders>,
      );
    });
    await press("Editar meta de Alimentação");
    await press("Remover meta de Alimentação");
    await press("Remover");
    await settle(80);

    expect(await categoryGoal("Alimentação")).toBeUndefined();
    expect(await categoryGoal("Lazer")).toMatchObject({ amount: 200 });
  });
});
