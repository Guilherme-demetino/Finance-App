import React from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { DisplayTransaction } from "../../types";
import { TransactionHistoryRow } from "./TransactionHistoryRow";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-reanimated", () => {
  const RN = jest.requireActual("react-native");
  const chain = () => {
    const animation: Record<string, () => unknown> = {};
    for (const method of ["duration", "delay"]) animation[method] = () => animation;
    return animation;
  };
  return {
    __esModule: true,
    default: { View: RN.View },
    FadeIn: chain(),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

function baseItem(over: Partial<DisplayTransaction> = {}): DisplayTransaction {
  return {
    id: "1",
    description: "Padaria",
    amount: 12.5,
    type: "expense",
    date: "05/09/2026",
    category: "Alimentação",
    color: "#f00",
    icon: "cart-outline",
    recurrenceType: null,
    recurrenceGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    account: "Conta principal",
    transferGroupId: null,
    ...over,
  };
}

function mount(
  props: Partial<React.ComponentProps<typeof TransactionHistoryRow>> &
    Pick<React.ComponentProps<typeof TransactionHistoryRow>, "onEdit" | "onDelete" | "onDeleteTransferGroup" | "onOpenSeries">,
) {
  const merged = { animationDelay: 0, item: baseItem(), ...props };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<TransactionHistoryRow {...merged} />);
  });
  return { tree, item: merged.item };
}

describe("TransactionHistoryRow", () => {
  it("mostra descrição, valor com sinal e data com a conta", () => {
    const { tree } = mount({
      onEdit: jest.fn(),
      onDelete: jest.fn(),
      onDeleteTransferGroup: jest.fn(),
      onOpenSeries: jest.fn(),
    });

    const text = textOf(tree);
    expect(text).toContain("Padaria");
    expect(text).toContain("-");
    expect(text).toContain("05/09/2026 · Conta principal");
  });

  it("sem conta: mostra só a data", () => {
    const { tree } = mount({
      item: baseItem({ account: undefined }),
      onEdit: jest.fn(),
      onDelete: jest.fn(),
      onDeleteTransferGroup: jest.fn(),
      onOpenSeries: jest.fn(),
    });

    expect(textOf(tree)).toContain("05/09/2026");
    expect(textOf(tree)).not.toContain("·");
  });

  it("editar chama onEdit com a transação", () => {
    const onEdit = jest.fn();
    const { tree, item } = mount({
      onEdit,
      onDelete: jest.fn(),
      onDeleteTransferGroup: jest.fn(),
      onOpenSeries: jest.fn(),
    });

    const editButton = tree.root.findAllByType(TouchableOpacity)[0];
    act(() => editButton.props.onPress());

    expect(onEdit).toHaveBeenCalledWith(item);
  });

  it("apagar uma transação normal chama onDelete com o id", () => {
    const onDelete = jest.fn();
    const { tree } = mount({
      onEdit: jest.fn(),
      onDelete,
      onDeleteTransferGroup: jest.fn(),
      onOpenSeries: jest.fn(),
    });

    // [0] editar, [1] apagar (sem série, já que recurrenceType é null).
    const deleteButton = tree.root.findAllByType(TouchableOpacity)[1];
    act(() => deleteButton.props.onPress());

    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("transferência: não tem botão de editar e apagar chama onDeleteTransferGroup", () => {
    const onDelete = jest.fn();
    const onDeleteTransferGroup = jest.fn();
    const { tree } = mount({
      item: baseItem({ transferGroupId: "tr-1" }),
      onEdit: jest.fn(),
      onDelete,
      onDeleteTransferGroup,
      onOpenSeries: jest.fn(),
    });

    // Sem botão de editar: só sobra o de apagar.
    const buttons = tree.root.findAllByType(TouchableOpacity);
    expect(buttons).toHaveLength(1);

    act(() => buttons[0].props.onPress());

    expect(onDeleteTransferGroup).toHaveBeenCalledWith("tr-1");
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("transação recorrente: mostra o botão de série e chama onOpenSeries", () => {
    const onOpenSeries = jest.fn();
    const { tree, item } = mount({
      item: baseItem({ recurrenceType: "recurring", recurrenceGroupId: "rec-1" }),
      onEdit: jest.fn(),
      onDelete: jest.fn(),
      onDeleteTransferGroup: jest.fn(),
      onOpenSeries,
    });

    // [0] editar, [1] apagar, [2] série.
    const seriesButton = tree.root.findAllByType(TouchableOpacity)[2];
    act(() => seriesButton.props.onPress());

    expect(onOpenSeries).toHaveBeenCalledWith(item);
  });
});
