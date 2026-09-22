import React from "react";
import { Text as RNText, TextInput, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { TransferModal } from "./TransferModal";

const mockAccounts = {
  options: [
    { id: 1, name: "Carteira", color: "#111111" },
    { id: 2, name: "Poupança", color: "#222222" },
  ],
  refresh: jest.fn(),
};
const mockCreateTransfer = jest.fn();

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../hooks/useAccounts", () => ({ useAccounts: () => mockAccounts }));
jest.mock("../database/transfers", () => ({ createTransfer: (...args: unknown[]) => mockCreateTransfer(...args) }));
jest.mock("../database/accounts", () => ({ createAccount: jest.fn() }));
jest.mock("./forms/CalendarPicker", () => ({ CalendarPicker: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

function mount(props: Partial<React.ComponentProps<typeof TransferModal>> = {}) {
  const full: React.ComponentProps<typeof TransferModal> = {
    visible: true,
    onClose: jest.fn(),
    onDone: jest.fn(),
    ...props,
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<TransferModal {...full} />);
  });
  mounted.push(tree);
  return { tree, props: full };
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
  mockCreateTransfer.mockReset().mockResolvedValue(undefined);
  mockAccounts.refresh.mockReset();
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  mounted.length = 0;
});

describe("TransferModal", () => {
  it("fechado, não desenha nada", () => {
    const { tree } = mount({ visible: false });
    expect(tree.toJSON()).toBeNull();
  });

  it("sem valor: avisa e não grava nada", async () => {
    const { tree } = mount();

    // handleSave é assíncrona: o próprio onPress devolve uma promise, então act() precisa ser aguardado
    // mesmo aqui, senão a atualização do erro não é processada antes da checagem abaixo.
    await act(async () => {
      button(tree, "Transferir").props.onPress();
    });

    expect(textOf(tree)).toContain("Insira um valor válido.");
    expect(mockCreateTransfer).not.toHaveBeenCalled();
  });

  it("sem escolher origem/destino: avisa e não grava nada", async () => {
    const { tree } = mount();
    const amount = tree.root.findAllByType(TextInput)[0];
    act(() => amount.props.onChangeText("50000"));

    await act(async () => {
      button(tree, "Transferir").props.onPress();
    });

    expect(textOf(tree)).toContain("Escolha a conta de origem e a de destino.");
    expect(mockCreateTransfer).not.toHaveBeenCalled();
  });

  it("origem igual ao destino: avisa e não grava nada", async () => {
    const { tree } = mount();
    const amount = tree.root.findAllByType(TextInput)[0];
    act(() => amount.props.onChangeText("50000"));

    // As duas listas de contas ("De" e "Para") têm os mesmos rótulos: a primeira ocorrência de "Carteira" é
    // sempre a de "De" (vem antes na árvore) e a segunda é sempre a de "Para".
    const carteiraButtons = tree.root
      .findAllByType(TouchableOpacity)
      .filter((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === "Carteira"));
    act(() => carteiraButtons[0].props.onPress()); // De: Carteira
    act(() => carteiraButtons[1].props.onPress()); // Para: Carteira também

    await act(async () => {
      button(tree, "Transferir").props.onPress();
    });

    expect(textOf(tree)).toContain("não podem ser a mesma conta");
    expect(mockCreateTransfer).not.toHaveBeenCalled();
  });

  it("preenchido corretamente: grava e chama onDone", async () => {
    const { tree, props } = mount();
    const amount = tree.root.findAllByType(TextInput)[0];
    act(() => amount.props.onChangeText("50000"));

    const carteiraButtons = tree.root
      .findAllByType(TouchableOpacity)
      .filter((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === "Carteira"));
    act(() => carteiraButtons[0].props.onPress()); // De: Carteira
    const poupancaButtons = tree.root
      .findAllByType(TouchableOpacity)
      .filter((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === "Poupança"));
    act(() => poupancaButtons[1].props.onPress()); // Para: Poupança (a segunda ocorrência, na lista "Para")

    await act(async () => {
      button(tree, "Transferir").props.onPress();
    });

    expect(mockCreateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500, fromAccount: "Carteira", toAccount: "Poupança" }),
    );
    expect(props.onDone).toHaveBeenCalledTimes(1);
  });
});
