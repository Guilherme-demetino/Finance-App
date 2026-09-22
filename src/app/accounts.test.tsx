import React from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { AccountRow } from "../types";
import AccountsScreen from "./accounts";

const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() };
const mockHook = {
  accounts: [] as AccountRow[],
  isLoading: false,
  remove: jest.fn(),
  refresh: jest.fn(),
};

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("../hooks/useAccounts", () => ({ useAccounts: () => mockHook }));
jest.mock("../database/accounts", () => ({ createAccount: jest.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

const row = (over: Partial<AccountRow> = {}): AccountRow => ({
  id: 1,
  name: "Carteira",
  color: "#111111",
  ...over,
});

async function mount(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AccountsScreen />);
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
  mockHook.accounts = [];
  mockHook.isLoading = false;
  mockHook.remove.mockReset();
  mockHook.refresh.mockReset();
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  mounted.length = 0;
});

describe("tela Contas", () => {
  it("vazia: mostra o estado sem contas além da padrão", async () => {
    const tree = await mount();
    expect(textOf(tree)).toContain("Nenhuma conta cadastrada ainda além da Conta principal.");
  });

  it("lista cada conta cadastrada", async () => {
    mockHook.accounts = [row({ id: 1, name: "Carteira" }), row({ id: 2, name: "Poupança" })];
    const tree = await mount();

    const text = textOf(tree);
    expect(text).toContain("Carteira");
    expect(text).toContain("Poupança");
  });

  it("Excluir pede confirmação antes de apagar a conta", async () => {
    mockHook.accounts = [row({ id: 7, name: "Carteira" })];
    const tree = await mount();

    const deleteButtons = tree.root.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityLabel === "Excluir a conta Carteira");
    act(() => deleteButtons[0].props.onPress());

    expect(textOf(tree)).toContain("Excluir conta");
    expect(mockHook.remove).not.toHaveBeenCalled();

    await act(async () => {
      button(tree, "Excluir").props.onPress();
    });

    expect(mockHook.remove).toHaveBeenCalledWith(7);
  });

  it("cancelar a confirmação não apaga nada", async () => {
    mockHook.accounts = [row({ id: 7, name: "Carteira" })];
    const tree = await mount();

    const deleteButtons = tree.root.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityLabel === "Excluir a conta Carteira");
    act(() => deleteButtons[0].props.onPress());
    act(() => button(tree, "Cancelar").props.onPress());

    expect(mockHook.remove).not.toHaveBeenCalled();
    expect(textOf(tree)).not.toContain("Excluir conta");
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
