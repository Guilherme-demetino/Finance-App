import React from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { TransactionRow } from "../types";
import TrashScreen from "./trash";

const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() };
const mockHook = {
  items: [] as TransactionRow[],
  isLoading: false,
  refresh: jest.fn(),
  restore: jest.fn(),
  removeForever: jest.fn(),
};

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("../hooks/useTrash", () => ({ useTrash: () => mockHook }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

const row = (over: Partial<TransactionRow> = {}): TransactionRow => ({
  id: 1,
  amount: 50,
  date: "01/09/2026",
  description: "Mercado",
  type: "expense",
  category_id: "Alimentação",
  deleted_at: new Date().toISOString(),
  ...over,
});

async function mount(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<TrashScreen />);
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

function button(tree: ReactTestRenderer, label: string) {
  const found = tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === label));
  if (!found) throw new Error(`botão "${label}" não encontrado`);
  return found;
}

beforeEach(() => {
  Object.values(mockRouter).forEach((fn) => fn.mockReset());
  mockHook.items = [];
  mockHook.isLoading = false;
  mockHook.refresh.mockReset();
  mockHook.restore.mockReset();
  mockHook.removeForever.mockReset();
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  mounted.length = 0;
});

describe("tela Lixeira", () => {
  it("vazia: mostra o estado sem itens", async () => {
    const tree = await mount();
    expect(textOf(tree)).toContain("Nenhuma transação excluída no momento.");
  });

  it("lista cada transação com valor, categoria, data e prazo restante", async () => {
    mockHook.items = [row({ description: "Mercado", amount: 50, type: "expense" })];
    const tree = await mount();

    const text = textOf(tree);
    expect(text).toContain("Mercado");
    expect(text).toContain("R$ 50,00");
    expect(text).toContain("Alimentação · 01/09/2026");
    expect(text).toContain("Some em 30 dias");
  });

  it("Restaurar chama a ação sem precisar confirmar", async () => {
    mockHook.items = [row({ id: 7 })];
    const tree = await mount();

    await act(async () => {
      button(tree, "Restaurar").props.onPress();
    });

    expect(mockHook.restore).toHaveBeenCalledWith(7);
  });

  it("Excluir definitivamente pede confirmação antes de apagar de vez", async () => {
    mockHook.items = [row({ id: 7, description: "Mercado" })];
    const tree = await mount();

    act(() => button(tree, "Excluir definitivamente").props.onPress());
    expect(textOf(tree)).toContain("Excluir definitivamente?");
    expect(mockHook.removeForever).not.toHaveBeenCalled();

    await act(async () => {
      button(tree, "Excluir de vez").props.onPress();
    });

    expect(mockHook.removeForever).toHaveBeenCalledWith(7);
  });

  it("cancelar a confirmação não apaga nada", async () => {
    mockHook.items = [row({ id: 7 })];
    const tree = await mount();

    act(() => button(tree, "Excluir definitivamente").props.onPress());
    act(() => button(tree, "Cancelar").props.onPress());

    expect(mockHook.removeForever).not.toHaveBeenCalled();
    expect(textOf(tree)).not.toContain("Excluir definitivamente?");
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
