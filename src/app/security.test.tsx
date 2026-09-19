import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import SecurityScreen from "./security";

const mockStore = new Map<string, string>();
const mockReplace = jest.fn();
const mockAlert: { props: { title: string; message: string } | null } = {
  props: null,
};

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
jest.mock("../database/security", () => ({
  getLegacyPin: async () => null,
  clearLegacyPin: async () => {},
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

// A primeira execução a frio compila a tela e o React Native; sem folga, o primeiro teste pode estourar.
jest.setTimeout(20_000);

const PIN_KEY = "finance_app_pin";
const LOCKOUT_KEY = "finance_app_pin_lockout";

// Telas montadas no teste: desmontadas no fim, para o contador de bloqueio não seguir rodando.
const mounted: ReactTestRenderer[] = [];

async function mountScreen(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<SecurityScreen />);
  });
  mounted.push(tree);
  return tree;
}

/** Digita os quatro dígitos, tecla por tecla, como o usuário. */
async function typePin(tree: ReactTestRenderer, pin: string) {
  for (const digit of pin) {
    const key = tree.root
      .findAllByType(TouchableOpacity)
      .find((node) => {
        const label = node.findAllByType(Text)[0];
        return label?.props.children === digit;
      });
    if (!key) throw new Error(`tecla ${digit} não encontrada`);
    await act(async () => {
      key.props.onPress();
    });
  }
}

function screenText(tree: ReactTestRenderer): string {
  return tree.root
    .findAllByType(Text)
    .map((node) => [node.props.children].flat().join(""))
    .join(" | ");
}

describe("tela de PIN: bloqueio por tentativas erradas", () => {
  // Relógio controlado: Date.now() anda só quando o teste manda.
  let clockOffset = 0;
  const realNow = Date.now();

  /** Passa o tempo e espera o contador da tela (que confere a cada 500 ms) perceber. */
  async function advanceClock(ms: number) {
    clockOffset += ms;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
  }

  beforeEach(() => {
    mockStore.clear();
    mockStore.set(PIN_KEY, "1234");
    mockReplace.mockClear();
    mockAlert.props = null;
    clockOffset = 0;
    jest.spyOn(Date, "now").mockImplementation(() => realNow + clockOffset);
  });

  afterEach(() => {
    act(() => {
      mounted.splice(0).forEach((tree) => tree.unmount());
    });
    jest.restoreAllMocks();
  });

  it("PIN certo entra no dashboard", async () => {
    const tree = await mountScreen();
    await typePin(tree, "1234");
    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("avisa quantas tentativas restam e só bloqueia no 5º erro", async () => {
    const tree = await mountScreen();

    await typePin(tree, "0000");
    expect(mockAlert.props?.message).toBe(
      "Restam 4 tentativas antes de um bloqueio temporário.",
    );
    await typePin(tree, "0000");
    await typePin(tree, "0000");
    await typePin(tree, "0000");
    expect(mockAlert.props?.message).toBe(
      "Restam 1 tentativa antes de um bloqueio temporário.",
    );
    expect(screenText(tree)).not.toContain("Muitas tentativas");

    await typePin(tree, "0000");
    expect(mockAlert.props?.message).toBe(
      "Por segurança, o PIN ficou bloqueado por 30 segundos.",
    );
    expect(screenText(tree)).toContain("Muitas tentativas incorretas");
    expect(screenText(tree)).toContain("0:30");
  });

  it("bloqueado, nem o PIN certo entra", async () => {
    const tree = await mountScreen();
    for (let i = 0; i < 5; i++) await typePin(tree, "0000");

    await typePin(tree, "1234");

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("o bloqueio sobrevive a fechar e abrir o app", async () => {
    const first = await mountScreen();
    for (let i = 0; i < 5; i++) await typePin(first, "0000");
    expect(JSON.parse(mockStore.get(LOCKOUT_KEY)!).failures).toBe(5);
    act(() => first.unmount());
    mounted.splice(mounted.indexOf(first), 1);

    const reopened = await mountScreen();
    expect(screenText(reopened)).toContain("Muitas tentativas incorretas");

    await typePin(reopened, "1234");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("depois do tempo o teclado volta e o PIN certo zera a contagem", async () => {
    const tree = await mountScreen();
    for (let i = 0; i < 5; i++) await typePin(tree, "0000");
    expect(screenText(tree)).toContain("Muitas tentativas");

    await advanceClock(31_000);
    expect(screenText(tree)).not.toContain("Muitas tentativas");

    await typePin(tree, "1234");
    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    expect(mockStore.has(LOCKOUT_KEY)).toBe(false);
  });

  it("errar de novo depois do bloqueio bloqueia por mais tempo", async () => {
    const tree = await mountScreen();
    for (let i = 0; i < 5; i++) await typePin(tree, "0000");

    await advanceClock(31_000);

    await typePin(tree, "0000");
    expect(mockAlert.props?.message).toBe(
      "Por segurança, o PIN ficou bloqueado por 1 minuto.",
    );
  });
});
