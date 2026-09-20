import React from "react";
import { Text, TextInput, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import SecurityScreen from "../app/security";
import WelcomeScreen from "../app/index";
import { getUser } from "../database/users";
import { resetDatabase } from "../database/sqlite";
import { createSqlJsDatabase } from "../test/sqliteFake";
import { clearPin, getStoredPin } from "../utils/security";

/**
 * Integração da entrada no app: nome, PIN e desbloqueio, com as telas de
 * verdade e o banco de verdade. Só o que é do aparelho é trocado.
 */
const mockState: { db: unknown } = { db: null };
const mockStore = new Map<string, string>();
const mockReplace = jest.fn();
const mockAlert: { props: { title: string; message: string } | null } = { props: null };

jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}));
jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: async () => false,
  isEnrolledAsync: async () => false,
  authenticateAsync: jest.fn(),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../components/CustomAlert", () => ({
  CustomAlert: (props: { title: string; message: string }) => {
    mockAlert.props = props;
    return null;
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// A primeira execução a frio compila as telas e o React Native.
jest.setTimeout(20_000);

const mounted: ReactTestRenderer[] = [];

async function mountScreen(Screen: React.ComponentType): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Screen />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  mounted.push(tree);
  return tree;
}

function texts(tree: ReactTestRenderer): string {
  return tree.root
    .findAllByType(Text)
    .map((node) => [node.props.children].flat().join(""))
    .join(" | ");
}

function buttonWithText(tree: ReactTestRenderer, label: string) {
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.findAllByType(Text).some((t) => t.props.children === label));
  if (!button) throw new Error(`botão "${label}" não encontrado`);
  return button;
}

async function typePin(tree: ReactTestRenderer, pin: string) {
  for (const digit of pin) {
    const key = buttonWithText(tree, digit);
    await act(async () => {
      key.props.onPress();
    });
  }
}

async function enterName(tree: ReactTestRenderer, name: string) {
  await act(async () => {
    tree.root.findByType(TextInput).props.onChangeText(name);
  });
  await act(async () => {
    await buttonWithText(tree, "Começar").props.onPress();
  });
}

beforeAll(async () => {
  mockState.db = await createSqlJsDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  mockStore.clear();
  mockReplace.mockClear();
  mockAlert.props = null;
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
  jest.restoreAllMocks();
});

describe("primeira abertura: nome, PIN e desbloqueio", () => {
  it("sem nome nem PIN, a tela de boas-vindas fica aberta", async () => {
    const tree = await mountScreen(WelcomeScreen);
    expect(texts(tree)).toContain("Como devemos te chamar?");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("nome vazio não avança", async () => {
    const tree = await mountScreen(WelcomeScreen);

    await enterName(tree, "   ");

    expect(mockAlert.props?.message).toBe("Por favor, digite como gostaria de ser chamado.");
    expect(mockReplace).not.toHaveBeenCalled();
    await expect(getUser()).resolves.toBeNull();
  });

  it("nome salvo vai para o cadastro do PIN", async () => {
    const tree = await mountScreen(WelcomeScreen);

    await enterName(tree, "  Ana  ");

    await expect(getUser()).resolves.toMatchObject({ name: "Ana" });
    expect(mockReplace).toHaveBeenCalledWith("/security");
  });

  it("cadastra o PIN, segue para o pré-cadastro e depois só entra com o PIN certo", async () => {
    // 1) primeiro acesso: cria o PIN
    const setup = await mountScreen(SecurityScreen);
    expect(texts(setup)).toContain("Crie seu PIN de Segurança");
    await typePin(setup, "4321");

    await expect(getStoredPin()).resolves.toBe("4321");
    expect(mockAlert.props?.message).toBe("PIN de segurança cadastrado com sucesso!");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });
    expect(mockReplace).toHaveBeenCalledWith("/onboarding");

    // 2) próxima abertura: pede o PIN
    mockReplace.mockClear();
    const unlock = await mountScreen(SecurityScreen);
    expect(texts(unlock)).toContain("Digite seu PIN");

    await typePin(unlock, "0000");
    expect(mockAlert.props?.message).toBe("Restam 4 tentativas antes de um bloqueio temporário.");
    expect(mockReplace).not.toHaveBeenCalled();

    await typePin(unlock, "4321");
    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("com PIN já cadastrado, a boas-vindas manda direto para pedir o PIN", async () => {
    mockStore.set("finance_app_pin", "4321");

    await mountScreen(WelcomeScreen);

    expect(mockReplace).toHaveBeenCalledWith("/security");
  });
});

describe("zerar o app e começar de novo (regressão do erro 'no such table')", () => {
  it("depois de zerar dá para cadastrar o nome e o PIN de novo, sem reiniciar", async () => {
    // app já usado: nome + PIN
    const first = await mountScreen(WelcomeScreen);
    await enterName(first, "Ana");
    mockStore.set("finance_app_pin", "1111");
    await expect(getUser()).resolves.toMatchObject({ name: "Ana" });

    // o que "Zerar Dados do App" faz
    const { resetDatabase: wipe } = jest.requireActual<typeof import("../database/sqlite")>("../database/sqlite");
    await wipe();
    await clearPin();
    mockReplace.mockClear();

    // volta para a tela de nome e o nome novo é aceito
    const again = await mountScreen(WelcomeScreen);
    expect(mockReplace).not.toHaveBeenCalled();
    await enterName(again, "Bia");

    expect(mockAlert.props?.title).toBe("Sucesso!");
    await expect(getUser()).resolves.toMatchObject({ name: "Bia" });
    expect(mockReplace).toHaveBeenCalledWith("/security");

    // e o PIN também: tela de criação, não de pedir o antigo
    const pin = await mountScreen(SecurityScreen);
    expect(texts(pin)).toContain("Crie seu PIN de Segurança");
    await typePin(pin, "2222");
    await expect(getStoredPin()).resolves.toBe("2222");
  });
});
