import React from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { TransactionModal } from "./TransactionModal";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
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
  };
});
jest.mock("../../database/categories", () => ({ getAllCategories: async () => [] }));
jest.mock("../../hooks/useAccounts", () => ({
  useAccounts: () => ({ options: [{ id: null, name: "Conta principal", color: "#111111" }], remove: jest.fn(), refresh: jest.fn() }),
}));

const mockScan = {
  scanReceiptFromCamera: jest.fn(),
  scanReceiptFromLibrary: jest.fn(),
};
jest.mock("../../services/receiptScan", () => ({
  scanReceiptFromCamera: (...args: unknown[]) => mockScan.scanReceiptFromCamera(...args),
  scanReceiptFromLibrary: (...args: unknown[]) => mockScan.scanReceiptFromLibrary(...args),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

function baseProps(over: Partial<React.ComponentProps<typeof TransactionModal>> = {}): React.ComponentProps<typeof TransactionModal> {
  return {
    visible: true,
    onClose: jest.fn(),
    transactionType: "expense",
    setTransactionType: jest.fn(),
    transactionTitle: "",
    setTransactionTitle: jest.fn(),
    transactionAmount: "",
    setTransactionAmount: jest.fn(),
    transactionDate: "22/09/2026",
    setTransactionDate: jest.fn(),
    transactionCategory: "Alimentação",
    setTransactionCategory: jest.fn(),
    transactionAccount: "Conta principal",
    setTransactionAccount: jest.fn(),
    isRecurring: false,
    setIsRecurring: jest.fn(),
    recurringMonths: 12,
    setRecurringMonths: jest.fn(),
    installmentCount: 1,
    setInstallmentCount: jest.fn(),
    isEditing: false,
    formatCurrency: (value: string) => value,
    onSave: jest.fn(),
    onDeleteCategory: jest.fn(),
    ...over,
  };
}

async function mount(over: Partial<React.ComponentProps<typeof TransactionModal>> = {}) {
  const props = baseProps(over);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<TransactionModal {...props} />);
  });
  mounted.push(tree);
  return { tree, props };
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
    .filter((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === label));
  if (found.length === 0) throw new Error(`botão "${label}" não encontrado`);
  return found[found.length - 1];
}

beforeEach(() => {
  mockScan.scanReceiptFromCamera.mockReset();
  mockScan.scanReceiptFromLibrary.mockReset();
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  mounted.length = 0;
});

describe("escanear recibo (dentro do formulário de transação)", () => {
  it("some ao editar uma transação existente", async () => {
    const { tree } = await mount({ isEditing: true });

    expect(textOf(tree)).not.toContain("Fotografar recibo");
  });

  it("aparece ao criar uma transação nova", async () => {
    const { tree } = await mount();

    expect(textOf(tree)).toContain("Fotografar recibo");
  });

  it("leitura com sucesso: preenche título, valor, data e categoria", async () => {
    mockScan.scanReceiptFromCamera.mockResolvedValue({
      status: "ok",
      text: "SUPERMERCADO BOM PRECO\nTOTAL R$ 38,60\nDATA 15/09/2026",
    });
    const { tree, props } = await mount();

    await act(async () => {
      button(tree, "Fotografar recibo").props.onPress();
    });

    expect(props.setTransactionType).toHaveBeenCalledWith("expense");
    expect(props.setTransactionTitle).toHaveBeenCalledWith("SUPERMERCADO BOM PRECO");
    expect(props.setTransactionAmount).toHaveBeenCalledWith("38,60");
    expect(props.setTransactionDate).toHaveBeenCalledWith("15/09/2026");
    expect(props.setTransactionCategory).toHaveBeenCalledWith("Alimentação");
  });

  it("cancelar a foto não mexe em nada nem mostra erro", async () => {
    mockScan.scanReceiptFromCamera.mockResolvedValue({ status: "cancelled" });
    const { tree, props } = await mount();

    await act(async () => {
      button(tree, "Fotografar recibo").props.onPress();
    });

    expect(props.setTransactionTitle).not.toHaveBeenCalled();
    expect(textOf(tree)).not.toContain("Não foi possível");
  });

  it("sem texto legível: mostra o aviso e não preenche nada", async () => {
    mockScan.scanReceiptFromCamera.mockResolvedValue({ status: "no-text" });
    const { tree, props } = await mount();

    await act(async () => {
      button(tree, "Fotografar recibo").props.onPress();
    });

    expect(textOf(tree)).toContain("Não encontrei nenhum texto legível");
    expect(props.setTransactionTitle).not.toHaveBeenCalled();
  });

  it("permissão negada: mostra o aviso certo", async () => {
    mockScan.scanReceiptFromCamera.mockResolvedValue({ status: "permission-denied" });
    const { tree } = await mount();

    await act(async () => {
      button(tree, "Fotografar recibo").props.onPress();
    });

    expect(textOf(tree)).toContain("Sem permissão para usar a câmera ou a galeria.");
  });

  it("aparelho sem suporte: mostra o aviso certo", async () => {
    mockScan.scanReceiptFromCamera.mockResolvedValue({ status: "unsupported" });
    const { tree } = await mount();

    await act(async () => {
      button(tree, "Fotografar recibo").props.onPress();
    });

    expect(textOf(tree)).toContain("não suporta a leitura de recibo por foto");
  });

  it("o botão da galeria chama a função certa", async () => {
    mockScan.scanReceiptFromLibrary.mockResolvedValue({ status: "cancelled" });
    const { tree } = await mount();

    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: "Escolher foto do recibo na galeria" }).props.onPress();
    });

    expect(mockScan.scanReceiptFromLibrary).toHaveBeenCalledTimes(1);
    expect(mockScan.scanReceiptFromCamera).not.toHaveBeenCalled();
  });
});
