import React from "react";
import { act, create } from "react-test-renderer";

import { useInlineEntityManager } from "./useInlineEntityManager";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Item {
  id: number;
  name: string;
}

type Result = ReturnType<typeof useInlineEntityManager<Item>>;

function setup(overrides: {
  selectedValue: string;
  setSelectedValue: (value: string) => void;
  fallbackValue: string;
  remove: (item: Item) => Promise<void>;
}) {
  const seen: { value: Result | null } = { value: null };

  function Harness() {
    seen.value = useInlineEntityManager<Item>({
      valueOf: (item) => item.name,
      ...overrides,
    });
    return null;
  }

  act(() => {
    create(<Harness />);
  });

  return seen;
}

describe("useInlineEntityManager", () => {
  it("começa com o modal de criação fechado e nada pra excluir", () => {
    const seen = setup({
      selectedValue: "Conta principal",
      setSelectedValue: jest.fn(),
      fallbackValue: "Conta principal",
      remove: jest.fn(),
    });

    expect(seen.value!.isCreateModalVisible).toBe(false);
    expect(seen.value!.itemToDelete).toBeNull();
  });

  it("abre e fecha o modal de criação", () => {
    const seen = setup({
      selectedValue: "Conta principal",
      setSelectedValue: jest.fn(),
      fallbackValue: "Conta principal",
      remove: jest.fn(),
    });

    act(() => seen.value!.openCreateModal());
    expect(seen.value!.isCreateModalVisible).toBe(true);

    act(() => seen.value!.closeCreateModal());
    expect(seen.value!.isCreateModalVisible).toBe(false);
  });

  it("cancelDelete limpa o item pendente sem chamar remove", () => {
    const remove = jest.fn();
    const seen = setup({
      selectedValue: "Conta principal",
      setSelectedValue: jest.fn(),
      fallbackValue: "Conta principal",
      remove,
    });

    act(() => seen.value!.requestDelete({ id: 1, name: "Carteira" }));
    expect(seen.value!.itemToDelete).toEqual({ id: 1, name: "Carteira" });

    act(() => seen.value!.cancelDelete());
    expect(seen.value!.itemToDelete).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it("confirmDelete chama remove e, se o item excluído era o selecionado, volta pro valor padrão", async () => {
    const setSelectedValue = jest.fn();
    const remove = jest.fn().mockResolvedValue(undefined);
    const seen = setup({
      selectedValue: "Carteira",
      setSelectedValue,
      fallbackValue: "Conta principal",
      remove,
    });

    act(() => seen.value!.requestDelete({ id: 1, name: "Carteira" }));
    await act(async () => {
      await seen.value!.confirmDelete();
    });

    expect(remove).toHaveBeenCalledWith({ id: 1, name: "Carteira" });
    expect(setSelectedValue).toHaveBeenCalledWith("Conta principal");
    expect(seen.value!.itemToDelete).toBeNull();
  });

  it("confirmDelete chama remove mas mantém o valor selecionado se não era o excluído", async () => {
    const setSelectedValue = jest.fn();
    const remove = jest.fn().mockResolvedValue(undefined);
    const seen = setup({
      selectedValue: "Conta principal",
      setSelectedValue,
      fallbackValue: "Conta principal",
      remove,
    });

    act(() => seen.value!.requestDelete({ id: 1, name: "Carteira" }));
    await act(async () => {
      await seen.value!.confirmDelete();
    });

    expect(remove).toHaveBeenCalledWith({ id: 1, name: "Carteira" });
    expect(setSelectedValue).not.toHaveBeenCalled();
  });

  it("confirmDelete sem item pendente não chama remove", async () => {
    const remove = jest.fn();
    const seen = setup({
      selectedValue: "Conta principal",
      setSelectedValue: jest.fn(),
      fallbackValue: "Conta principal",
      remove,
    });

    await act(async () => {
      await seen.value!.confirmDelete();
    });

    expect(remove).not.toHaveBeenCalled();
  });
});
